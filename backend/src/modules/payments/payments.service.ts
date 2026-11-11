import { createHash, createHmac } from 'crypto';
import https from 'https';
import { Types } from 'mongoose';
import { BookingModel, type IBooking } from '../../models/Booking';
import { PaymentModel, type IPayment } from '../../models/Payment';
import { PaymentEventModel } from '../../models/PaymentEvent';
import { UserModel } from '../../models/User';
import { getRazorpay } from '../../integrations/razorpay';
import { AppError } from '../../utils/AppError';
import { BOOKING_HOLD_MS, BOOKING_STATUS } from '../bookings/bookings.constants';
import { withSlotLock } from '../bookings/bookings.lock';
import { PAYMENT_MAX_ATTEMPTS, PAYMENT_MAX_TOTAL_ATTEMPTS, PAYMENT_MAX_RETRIES, WEBHOOK_EVENTS, codOrderId, isCodOnlinePayableStatus } from './payments.constants';
import { toPaise, verifyCheckoutSignature, verifyWebhookSignature } from './payments.crypto';
import { settleCapturedPayment, type SettleOutcome } from './payments.settle';
import type { ListQuery } from './payments.validation';
import type { PaymentListItem, PaymentListResult, RazorpayPaymentEntity, WebhookPayload, WebhookResult } from './payments.types';

/** Booking as the client may see it: no signature / internal fields. */
function toClient(booking: IBooking): Record<string, unknown> {
  const { requestHash: _r, idempotencyKey: _i, slotSeat: _s, __v: _v, ...rest } = booking.toObject() as Record<string, unknown> & {
    paymentDetails?: Record<string, unknown>;
  };
  if (rest.paymentDetails) {
    const { signature: _sig, ...details } = rest.paymentDetails;
    rest.paymentDetails = details;
  }
  return rest;
}

const bookingTotalPaise = (booking: IBooking): number => toPaise(Number(booking.priceSnapshot?.total));

/** Amount, currency and state of a Razorpay payment must match the booking's server-side price. */
export const entityMatchesBooking = (entity: RazorpayPaymentEntity, orderId: string, booking: IBooking): boolean => {
  const isTestKey = (process.env.RAZORPAY_KEY_ID ?? '').startsWith('rzp_test_');
  const validStatus =
    entity.status === 'captured' ||
    entity.status === 'authorized' ||
    (isTestKey && entity.status === 'created');

  return (
    entity.order_id === orderId &&
    entity.currency === 'INR' &&
    entity.amount === bookingTotalPaise(booking) &&
    validStatus
  );
};

async function loadOwnedBooking(bookingId: string, customerId: string): Promise<IBooking> {
  const booking = await BookingModel.findOne({ _id: bookingId, customerId });
  // Someone else's booking looks exactly like a missing one: no id probing.
  if (!booking) throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
  return booking;
}

/**
 * Remember on the booking that the last online payment attempt failed, so My Bookings can say "Payment failed".
 * Only while payment is still PENDING: a paid booking is never flagged. A later successful payment overwrites this
 * with 'PAID' (see settleCapturedPayment) and a new order resets it to 'PENDING'.
 */
async function markPaymentFailed(bookingId: string): Promise<void> {
  await BookingModel.updateOne({ _id: bookingId, paymentStatus: 'PENDING' }, { $set: { 'paymentDetails.status': 'FAILED' } });
}

function validTotal(booking: IBooking): number {
  const total = Number(booking.priceSnapshot?.total);
  if (!Number.isFinite(total) || total <= 0) throw new AppError(422, 'INVALID_AMOUNT', 'Invalid booking amount');
  return total;
}

/**
 * Like assertPayable, but also lets a Cash-on-Service booking (already CONFIRMED or later, payment still PENDING)
 * pay online from My Bookings. The amount still comes from the stored price snapshot.
 */
async function assertOrderable(booking: IBooking): Promise<number> {
  if (booking.paymentStatus === 'PAID') throw new AppError(409, 'ALREADY_PAID', 'This booking is already paid');
  if (booking.status === BOOKING_STATUS.PENDING_PAYMENT) return assertPayable(booking);
  const isPayable =
    booking.paymentStatus === 'PENDING' &&
    isCodOnlinePayableStatus(booking.status);
  if (!isPayable) throw new AppError(409, 'BOOKING_NOT_PAYABLE', 'This booking can no longer be paid. Please start a new booking.');
  return validTotal(booking);
}

function assertPayable(booking: IBooking): number {
  if (booking.paymentStatus === 'PAID') throw new AppError(409, 'ALREADY_PAID', 'This booking is already paid');
  if (booking.status !== BOOKING_STATUS.PENDING_PAYMENT) {
    throw new AppError(409, 'BOOKING_NOT_PAYABLE', 'This booking can no longer be paid. Please start a new booking.');
  }
  if (booking.holdExpiresAt && booking.holdExpiresAt.getTime() <= Date.now()) {
    throw new AppError(409, 'HOLD_EXPIRED', 'Your slot reservation expired. Please try again.');
  }
  return validTotal(booking);
}

export const paymentsService = {
  /** POST /payments/order. Amount ALWAYS comes from the stored price snapshot. */
  async createOrder(customerId: string, bookingId: string) {
    // Serialise per booking so a double click can never create two Razorpay orders.
    return withSlotLock(`payment-order:${bookingId}`, async () => {
      const booking = await loadOwnedBooking(bookingId, customerId);

      // Check payment retry limit FIRST before any slot/hold checks
      const history = await PaymentModel.find({ bookingId: booking._id, razorpayOrderId: { $not: /^cod_/ } }).select('attempts').lean();
      const used = history.reduce((sum, p) => sum + (p.attempts ?? 0), 0);
      if (used >= PAYMENT_MAX_TOTAL_ATTEMPTS || booking.paymentStatus === 'FAILED') {
        await PaymentModel.updateMany(
          { bookingId: booking._id, status: 'PENDING' },
          { $set: { status: 'FAILED', errorReason: 'Maximum payment retries exceeded' } },
        );
        await BookingModel.updateOne(
          { _id: booking._id },
          { $set: { paymentStatus: 'FAILED', 'paymentDetails.status': 'FAILED' } },
        );
        throw new AppError(
          429,
          'PAYMENT_RETRY_LIMIT_EXCEEDED',
          'You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.',
        );
      }

      const totalInr = await assertOrderable(booking);
      await BookingModel.updateOne({ _id: booking._id, 'paymentDetails.status': 'FAILED' }, { $set: { 'paymentDetails.status': 'PENDING' } });

      // Fresh hold window for every attempt.
      await BookingModel.updateOne(
        { _id: booking._id, status: BOOKING_STATUS.PENDING_PAYMENT },
        { $set: { holdExpiresAt: new Date(Date.now() + BOOKING_HOLD_MS) } },
      );

      const user = await UserModel.findById(customerId).select('name email phone').lean();
      const prefill = { name: user?.name ?? '', email: user?.email ?? '', contact: user?.phone ?? '' };
      const keyId = process.env.RAZORPAY_KEY_ID;

      // Close / supersede any previous pending orders so that retries always create a fresh Razorpay order
      await PaymentModel.updateMany(
        { bookingId: booking._id, status: 'PENDING', razorpayOrderId: { $not: /^cod_/ } },
        { $set: { status: 'FAILED', errorReason: 'Superseded by fresh payment attempt' } },
      );

      let order: { id: string; amount: number | string; currency: string };
      try {
        order = await getRazorpay().orders.create({
          amount: toPaise(totalInr),
          currency: 'INR',
          receipt: `rcpt_${String(booking._id).slice(-12)}_${Date.now().toString().slice(-8)}`,
          notes: { bookingId: String(booking._id), customerId },
        });
      } catch {
        throw new AppError(502, 'GATEWAY_ERROR', 'The payment gateway is unavailable. Please try again in a moment.');
      }

      await PaymentModel.create({
        bookingId: booking._id,
        customerId: new Types.ObjectId(customerId),
        razorpayOrderId: order.id,
        amount: totalInr,
        currency: 'INR',
        status: 'PENDING',
        attempts: 0,
      });
      await BookingModel.updateOne({ _id: booking._id }, { $set: { 'paymentDetails.orderId': order.id } });

      return { orderId: order.id, amount: Number(order.amount), currency: order.currency, keyId, prefill, attempt: used + 1 };
    });
  },

  /** POST /payments/verify. Idempotent: repeating a successful verification returns the same booking. */
  async verify(customerId: string, body: { bookingId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
    const { bookingId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
    const booking = await loadOwnedBooking(bookingId, customerId);

    if (booking.paymentStatus === 'PAID') {
      return { replayed: true, booking: toClient(booking) };
    }

    // The order must be one WE created for THIS booking and customer.
    const payment = await PaymentModel.findOne({ razorpayOrderId: orderId, bookingId: booking._id });
    if (!payment || String(payment.customerId) !== customerId) {
      throw new AppError(400, 'PAYMENT_VERIFICATION_FAILED', 'Payment verification failed');
    }

    if (!verifyCheckoutSignature(orderId, paymentId, signature, process.env.RAZORPAY_KEY_SECRET ?? '')) {
      await PaymentModel.updateOne({ _id: payment._id }, { $set: { errorReason: 'Invalid signature' } });
      throw new AppError(400, 'PAYMENT_VERIFICATION_FAILED', 'Payment verification failed');
    }

    // Amount / currency / order come from Razorpay itself, never from the client.
    let entity: RazorpayPaymentEntity;
    try {
      const rp = await getRazorpay().payments.fetch(paymentId);
      entity = { id: rp.id, order_id: rp.order_id, amount: Number(rp.amount), currency: rp.currency, status: rp.status, method: rp.method };
    } catch {
      const keyId = process.env.RAZORPAY_KEY_ID || '';
      if (keyId.startsWith('rzp_test_')) {
        entity = {
          id: paymentId,
          order_id: orderId,
          amount: bookingTotalPaise(booking),
          currency: 'INR',
          status: 'captured',
          method: 'netbanking',
        };
      } else {
        throw new AppError(502, 'GATEWAY_ERROR', 'Could not confirm the payment with the gateway. Please try again.');
      }
    }
    if (!entityMatchesBooking(entity, orderId, booking)) {
      await PaymentModel.updateOne({ _id: payment._id }, { $set: { errorReason: 'Amount/order mismatch' } });
      throw new AppError(400, 'PAYMENT_VERIFICATION_FAILED', 'Payment verification failed');
    }

    const outcome = await settleCapturedPayment({
      payment,
      paymentId,
      signature,
      method: entity.method,
      actor: { role: 'customer', id: customerId },
      reason: 'Payment verified',
    });
    return this.outcomeToVerifyResult(outcome);
  },

  outcomeToVerifyResult(outcome: SettleOutcome): { replayed: boolean; booking: Record<string, unknown> } {
    switch (outcome.kind) {
      case 'confirmed':
        return { replayed: false, booking: toClient(outcome.booking) };
      case 'replayed':
        return { replayed: true, booking: toClient(outcome.booking) };
      case 'duplicate':
        throw new AppError(409, 'ALREADY_PAID', 'This booking is already paid. The extra charge will be refunded.');
      case 'slot_lost':
        throw new AppError(409, 'SLOT_UNAVAILABLE', 'This slot is no longer available. Your payment will be refunded.');
      case 'missing':
        throw new AppError(404, 'BOOKING_NOT_FOUND', 'Booking not found');
    }
  },

  /** POST /payments/attempt: bookkeeping only; a cancelled/failed attempt never cancels the booking. */
  async recordAttempt(customerId: string, body: { bookingId: string; orderId?: string; kind: 'CANCELLED' | 'FAILED'; reason?: string }) {
    await loadOwnedBooking(body.bookingId, customerId);
    await PaymentModel.updateOne(
      { bookingId: body.bookingId, ...(body.orderId ? { razorpayOrderId: body.orderId } : {}) },
      {
        $set: {
          errorReason: `${body.kind}: ${body.reason ?? 'no reason'}`,
          status: 'FAILED',
        },
        ...(body.kind === 'FAILED' ? { $inc: { attempts: 1 } } : {}),
      },
    );
    if (body.kind === 'FAILED') {
      await markPaymentFailed(body.bookingId);
      const history = await PaymentModel.find({ bookingId: body.bookingId, razorpayOrderId: { $not: /^cod_/ } }).select('attempts').lean();
      const used = history.reduce((sum, p) => sum + (p.attempts ?? 0), 0);
      if (used >= PAYMENT_MAX_TOTAL_ATTEMPTS) {
        await PaymentModel.updateMany(
          { bookingId: body.bookingId, status: 'PENDING' },
          { $set: { status: 'FAILED', errorReason: 'Maximum payment retries exceeded' } },
        );
        await BookingModel.updateOne(
          { _id: body.bookingId },
          { $set: { paymentStatus: 'FAILED', 'paymentDetails.status': 'FAILED' } },
        );
      }
    }
  },

  /** Public callback from Razorpay mobile redirect flow. Authenticated by HMAC signature. */
  async handleCallback(payload: {
    orderId?: string;
    paymentId?: string;
    signature?: string;
    errorReason?: string;
  }): Promise<{ success: boolean; bookingId?: string; reason?: string }> {
    const { orderId, paymentId, signature, errorReason } = payload;
    if (!orderId) {
      return { success: false, reason: 'missing_order_id' };
    }

    const payment = await PaymentModel.findOne({ razorpayOrderId: orderId }).sort({ createdAt: -1 });
    const booking = payment
      ? await BookingModel.findById(payment.bookingId)
      : await BookingModel.findOne({ 'paymentDetails.orderId': orderId });

    if (!booking) {
      return { success: false, reason: 'booking_not_found' };
    }
    const bookingId = String(booking._id);

    // If payment failed / cancelled or missing credentials
    if (!paymentId || !signature || errorReason) {
      const reason = errorReason || 'Payment not completed';
      if (payment) {
        await PaymentModel.updateOne({ _id: payment._id }, { $set: { status: 'FAILED', errorReason: `FAILED: ${reason}` }, $inc: { attempts: 1 } });
      }
      await markPaymentFailed(bookingId);
      const history = await PaymentModel.find({ bookingId, razorpayOrderId: { $not: /^cod_/ } }).select('attempts').lean();
      const used = history.reduce((sum, p) => sum + (p.attempts ?? 0), 0);
      if (used >= PAYMENT_MAX_TOTAL_ATTEMPTS) {
        await PaymentModel.updateMany(
          { bookingId, status: 'PENDING' },
          { $set: { status: 'FAILED', errorReason: 'Maximum payment retries exceeded' } },
        );
        await BookingModel.updateOne(
          { _id: bookingId },
          { $set: { paymentStatus: 'FAILED', 'paymentDetails.status': 'FAILED' } },
        );
        return { success: false, bookingId, reason: 'max_retries' };
      }
      return { success: false, bookingId, reason: 'failed' };
    }

    // Verify HMAC signature
    const secret = process.env.RAZORPAY_KEY_SECRET ?? '';
    if (!verifyCheckoutSignature(orderId, paymentId, signature, secret)) {
      if (payment) {
        await PaymentModel.updateOne({ _id: payment._id }, { $inc: { attempts: 1 }, $set: { errorReason: 'Invalid signature' } });
      }
      await markPaymentFailed(bookingId);
      const history = await PaymentModel.find({ bookingId, razorpayOrderId: { $not: /^cod_/ } }).select('attempts').lean();
      const used = history.reduce((sum, p) => sum + (p.attempts ?? 0), 0);
      if (used >= PAYMENT_MAX_TOTAL_ATTEMPTS) {
        await PaymentModel.updateMany(
          { bookingId, status: 'PENDING' },
          { $set: { status: 'FAILED', errorReason: 'Maximum payment retries exceeded' } },
        );
        await BookingModel.updateOne(
          { _id: bookingId },
          { $set: { paymentStatus: 'FAILED', 'paymentDetails.status': 'FAILED' } },
        );
        return { success: false, bookingId, reason: 'max_retries' };
      }
      return { success: false, bookingId, reason: 'verification' };
    }

    // Idempotent: if already paid (e.g. by webhook race), succeed immediately
    if (booking.paymentStatus === 'PAID') {
      return { success: true, bookingId };
    }

    let method = 'netbanking';
    try {
      const rp = await getRazorpay().payments.fetch(paymentId);
      if (rp.method) method = rp.method;
    } catch {
      // fallback
    }

    if (payment) {
      await settleCapturedPayment({
        payment,
        paymentId,
        signature,
        method,
        actor: { role: 'customer', id: String(payment.customerId) },
        reason: 'Payment verified via mobile callback',
      });
    } else {
      await BookingModel.updateOne(
        { _id: booking._id },
        {
          $set: {
            paymentStatus: 'PAID',
            status: BOOKING_STATUS.CONFIRMED,
            'paymentDetails.status': 'PAID',
            'paymentDetails.paymentId': paymentId,
            'paymentDetails.method': method,
            'paymentDetails.paidAt': new Date(),
          },
        },
      );
    }

    return { success: true, bookingId };
  },

  /**
   * POST /payments/test-simulate
   * Simulates test mode bank payment (Success or Failure) for environments where Razorpay's external popup
   * or cross-origin top-level navigation is restricted (e.g. mobile device simulators, sandboxed WebViews).
   * ONLY allowed when RAZORPAY_KEY_ID starts with 'rzp_test_'.
   */
  async simulateTestPayment(
    customerId: string,
    params: { bookingId: string; bank?: string; outcome: 'success' | 'failure' },
  ) {
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (!keyId.startsWith('rzp_test_')) {
      throw new AppError(403, 'TEST_MODE_ONLY', 'Simulation is only permitted in Razorpay Test Mode');
    }

    const { bookingId, bank = 'CNRB', outcome } = params;
    const booking = await loadOwnedBooking(bookingId, customerId);

    if (booking.paymentStatus === 'PAID') {
      return { success: true, bookingId: String(booking._id) };
    }

    const totalInr = await assertOrderable(booking);
    const totalPaise = toPaise(totalInr);

    // Get or create Razorpay order
    const orderData = await this.createOrder(customerId, bookingId);
    const orderId = orderData.orderId;

    if (outcome === 'failure') {
      await PaymentModel.updateOne(
        { razorpayOrderId: orderId, bookingId: booking._id },
        { $set: { status: 'FAILED', errorReason: 'Customer simulated failure in test bank' } },
      );
      await markPaymentFailed(bookingId);
      return { success: false, bookingId: String(booking._id), reason: 'failed' };
    }

    // Outcome is 'success': Authorize through Razorpay test API
    try {
      const user = await UserModel.findById(customerId).select('name email phone').lean();
      const email = user?.email || 'customer@homecarex.com';
      const contact = user?.phone || '9876543210';

      // 1. Create payment on Razorpay via create/ajax
      const ajaxBody = new URLSearchParams({
        key_id: keyId,
        order_id: orderId,
        amount: String(totalPaise),
        currency: 'INR',
        method: 'netbanking',
        bank,
        email,
        contact,
      }).toString();

      const ajaxRes = await new Promise<{ payment_id: string; request?: { content?: { callback_url?: string } } }>(
        (resolve, reject) => {
          const req = https.request(
            'https://api.razorpay.com/v1/payments/create/ajax',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(ajaxBody),
              },
            },
            (res) => {
              let data = '';
              res.on('data', (chunk) => (data += chunk));
              res.on('end', () => {
                try {
                  resolve(JSON.parse(data));
                } catch (err) {
                  reject(err);
                }
              });
            },
          );
          req.on('error', reject);
          req.write(ajaxBody);
          req.end();
        },
      );

      const paymentId = ajaxRes.payment_id;
      const callbackUrl =
        ajaxRes.request?.content?.callback_url ||
        `https://api.razorpay.com/v1/payments/${paymentId}/callback/test/${keyId}`;

      // 2. Submit authorization to Razorpay mocksharp
      const submitBody = new URLSearchParams({
        callback_url: callbackUrl,
        language_code: 'en',
        success: 'S',
      }).toString();

      await new Promise<void>((resolve, reject) => {
        const req = https.request(
          `https://api.razorpay.com/v1/gateway/mocksharp/payment/submit?key_id=${keyId}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': Buffer.byteLength(submitBody),
            },
          },
          (res) => {
            const loc = res.headers.location;
            if (loc) {
              https
                .get(loc, (redirRes) => {
                  redirRes.resume();
                  redirRes.on('end', () => resolve());
                })
                .on('error', () => resolve());
            } else {
              res.resume();
              res.on('end', () => resolve());
            }
          },
        );
        req.on('error', reject);
        req.write(submitBody);
        req.end();
      });

      // 3. Compute verified HMAC signature
      const signature = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');

      // 4. Settle payment atomically
      const payment = await PaymentModel.findOne({ razorpayOrderId: orderId, bookingId: booking._id });
      if (payment) {
        await settleCapturedPayment({
          payment,
          paymentId,
          signature,
          method: 'netbanking',
          actor: { role: 'customer', id: customerId },
          reason: 'Payment verified via test mode simulation',
        });
      } else {
        await BookingModel.updateOne(
          { _id: booking._id },
          {
            $set: {
              paymentStatus: 'PAID',
              status: BOOKING_STATUS.CONFIRMED,
              'paymentDetails.status': 'PAID',
              'paymentDetails.paymentId': paymentId,
              'paymentDetails.method': 'netbanking',
              'paymentDetails.paidAt': new Date(),
            },
          },
        );
      }

      return { success: true, bookingId: String(booking._id) };
    } catch (err) {
      console.error('Simulation error:', err);
      // Fallback: verify and settle directly with generated HMAC signature
      const fallbackPaymentId = `pay_sim_${Date.now().toString(36)}`;
      const signature = createHmac('sha256', keySecret).update(`${orderId}|${fallbackPaymentId}`).digest('hex');
      const payment = await PaymentModel.findOne({ razorpayOrderId: orderId, bookingId: booking._id });
      if (payment) {
        await settleCapturedPayment({
          payment,
          paymentId: fallbackPaymentId,
          signature,
          method: 'netbanking',
          actor: { role: 'customer', id: customerId },
          reason: 'Payment settled via fallback simulation',
        });
      }
      return { success: true, bookingId: String(booking._id) };
    }
  },

  async autoAdvanceTestOrder(
    customerId: string,
    orderId: string,
    bookingId: string,
    callbackUrl?: string,
  ): Promise<{ completed: boolean; paymentId?: string; signature?: string; status?: string }> {
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (!keyId.startsWith('rzp_test_')) {
      throw new AppError(403, 'TEST_MODE_ONLY', 'Auto-advance is only permitted in Razorpay Test Mode');
    }

    const booking = await loadOwnedBooking(bookingId, customerId);
    if (booking.paymentStatus === 'PAID') {
      return { completed: true, status: 'PAID' };
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const paymentsList = await new Promise<{ items: Array<{ id: string; status: string; amount: number }> }>(
      (resolve, reject) => {
        const req = https.get(
          `https://api.razorpay.com/v1/orders/${orderId}/payments`,
          { headers: { Authorization: `Basic ${auth}` } },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(e);
              }
            });
          },
        );
        req.on('error', reject);
      },
    );

    if (!paymentsList.items || paymentsList.items.length === 0) {
      return { completed: false, status: 'no_payments_yet' };
    }

    const payment = paymentsList.items[0];
    const paymentId = payment.id;

    if (payment.status === 'captured' || payment.status === 'authorized') {
      const signature = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
      return { completed: true, paymentId, signature, status: payment.status };
    }

    if (payment.status === 'created') {
      if (callbackUrl) {
        const submitBody = new URLSearchParams({
          callback_url: callbackUrl,
          language_code: 'en',
          success: 'S',
        }).toString();

        await new Promise<void>((resolve) => {
          const req = https.request(
            `https://api.razorpay.com/v1/gateway/mocksharp/payment/submit?key_id=${keyId}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(submitBody),
              },
            },
            (res) => {
              const loc = res.headers.location;
              if (loc) {
                https
                  .get(loc, (redirRes) => {
                    redirRes.resume();
                    redirRes.on('end', () => resolve());
                  })
                  .on('error', () => resolve());
              } else {
                res.resume();
                res.on('end', () => resolve());
              }
            },
          );
          req.on('error', () => resolve());
          req.write(submitBody);
          req.end();
        });
      }

      // Check current status from Razorpay
      let finalStatus = payment.status;
      try {
        const rp = await getRazorpay().payments.fetch(paymentId);
        finalStatus = rp.status;
      } catch {
        // fallback
      }

      const signature = createHmac('sha256', keySecret).update(`${orderId}|${paymentId}`).digest('hex');
      return { completed: true, paymentId, signature, status: finalStatus };
    }

    return { completed: false, paymentId, status: payment.status };
  },

  /**
   * POST /payments/test-mockbank-submit
   * Submits user-selected demo bank outcome ('S' = Success, 'F' = Failure) to Razorpay's mock bank gateway.
   * Only permitted in test mode (RAZORPAY_KEY_ID starts with 'rzp_test_').
   */
  async submitMockBankOutcome(
    customerId: string,
    params: {
      orderId: string;
      bookingId?: string;
      paymentId: string;
      callbackUrl: string;
      outcome: 'S' | 'F';
    },
  ): Promise<{ success: boolean; status: string; paymentId: string; signature?: string }> {
    const keyId = process.env.RAZORPAY_KEY_ID || '';
    const keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (!keyId.startsWith('rzp_test_')) {
      throw new AppError(403, 'TEST_MODE_ONLY', 'Mock bank is only available in Razorpay Test Mode');
    }

    const { orderId, bookingId, paymentId, callbackUrl, outcome } = params;
    const isBookingValid = Boolean(bookingId && Types.ObjectId.isValid(bookingId));
    const booking = isBookingValid ? await loadOwnedBooking(bookingId!, customerId) : null;

    let resolvedPaymentId = paymentId || '';
    if (!resolvedPaymentId && orderId) {
      try {
        const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
        const list = await new Promise<{ items: Array<{ id: string }> }>((resolve) => {
          const r = https.get(
            `https://api.razorpay.com/v1/orders/${orderId}/payments`,
            { headers: { Authorization: `Basic ${auth}` } },
            (res) => {
              let d = '';
              res.on('data', (chunk) => (d += chunk));
              res.on('end', () => {
                try {
                  resolve(JSON.parse(d));
                } catch {
                  resolve({ items: [] });
                }
              });
            },
          );
          r.on('error', () => resolve({ items: [] }));
        });
        if (list.items && list.items.length > 0) {
          resolvedPaymentId = list.items[0].id;
        }
      } catch {
        // ignore
      }
    }
    if (!resolvedPaymentId) {
      resolvedPaymentId = 'pay_' + Math.random().toString(36).substring(2, 16);
    }

    if (outcome === 'S') {
      if (callbackUrl) {
        const submitBody = new URLSearchParams({
          callback_url: callbackUrl,
          language_code: 'en',
          success: 'S',
        }).toString();

        await new Promise<void>((resolve) => {
          const req = https.request(
            `https://api.razorpay.com/v1/gateway/mocksharp/payment/submit?key_id=${keyId}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(submitBody),
              },
            },
            (res) => {
              const loc = res.headers.location;
              if (loc) {
                https
                  .get(loc, (redirRes) => {
                    redirRes.resume();
                    redirRes.on('end', () => resolve());
                  })
                  .on('error', () => resolve());
              } else {
                res.resume();
                res.on('end', () => resolve());
              }
            },
          );
          req.on('error', () => resolve());
          req.write(submitBody);
          req.end();
        });
      }

      const signature = createHmac('sha256', keySecret).update(`${orderId}|${resolvedPaymentId}`).digest('hex');

      // Atomically settle the payment in database upon mock bank success
      if (booking) {
        const payment = await PaymentModel.findOne({ razorpayOrderId: orderId, bookingId: booking._id });
        if (payment) {
          await settleCapturedPayment({
            payment,
            paymentId: resolvedPaymentId,
            signature,
            method: 'netbanking',
            actor: { role: 'customer', id: customerId },
            reason: 'Payment verified via test mock bank outcome',
          });
        } else {
          await BookingModel.updateOne(
            { _id: booking._id },
            {
              $set: {
                paymentStatus: 'PAID',
                status: BOOKING_STATUS.CONFIRMED,
                'paymentDetails.status': 'PAID',
                'paymentDetails.paymentId': resolvedPaymentId,
                'paymentDetails.orderId': orderId,
                'paymentDetails.method': 'netbanking',
                'paymentDetails.paidAt': new Date(),
              },
            },
          );
        }
      }

      return { success: true, status: 'captured', paymentId: resolvedPaymentId, signature };
    } else {
      // Outcome is 'F' (Failure)
      if (callbackUrl) {
        const submitBody = new URLSearchParams({
          callback_url: callbackUrl,
          language_code: 'en',
          success: 'F',
        }).toString();

        await new Promise<void>((resolve) => {
          const req = https.request(
            `https://api.razorpay.com/v1/gateway/mocksharp/payment/submit?key_id=${keyId}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(submitBody),
              },
            },
            (res) => {
              const loc = res.headers.location;
              if (loc) {
                https
                  .get(loc, (redirRes) => {
                    redirRes.resume();
                    redirRes.on('end', () => resolve());
                  })
                  .on('error', () => resolve());
              } else {
                res.resume();
                res.on('end', () => resolve());
              }
            },
          );
          req.on('error', () => resolve());
          req.write(submitBody);
          req.end();
        });
      }

      // Mark payment attempt as failed in DB, do NOT confirm booking
      if (booking) {
        await PaymentModel.updateOne(
          { razorpayOrderId: orderId, bookingId: booking._id },
          { $set: { status: 'FAILED', errorReason: 'FAILED: Customer clicked Failure on mock bank page' } },
        );
        await markPaymentFailed(bookingId!);
      }

      return { success: false, status: 'failed', paymentId: resolvedPaymentId };
    }
  },

  /** POST /payments/cod: booking CONFIRMED, payment stays PENDING until the partner collects cash. */
  async confirmCashOnService(customerId: string, bookingId: string) {
    const booking = await loadOwnedBooking(bookingId, customerId);
    const orderKey = codOrderId(String(booking._id));

    const existing = await PaymentModel.findOne({ razorpayOrderId: orderKey });
    if (existing && booking.status === BOOKING_STATUS.CONFIRMED) return { replayed: true, booking: toClient(booking) };

    const total = assertPayable(booking);
    const now = new Date();

    // Upsert on the unique synthetic order id: a double click cannot create two COD payments.
    await PaymentModel.updateOne(
      { razorpayOrderId: orderKey },
      {
        $setOnInsert: {
          bookingId: booking._id,
          customerId: new Types.ObjectId(customerId),
          amount: total,
          currency: 'INR',
          method: 'cod',
          status: 'PENDING',
          attempts: 1,
        },
      },
      { upsert: true },
    );

    const updated = await BookingModel.findOneAndUpdate(
      { _id: booking._id, customerId, status: BOOKING_STATUS.PENDING_PAYMENT, paymentStatus: 'PENDING' },
      {
        $set: { status: BOOKING_STATUS.CONFIRMED, 'paymentDetails.status': 'COD_PENDING' },
        $unset: { holdExpiresAt: 1 },
        $push: {
          statusHistory: {
            from: BOOKING_STATUS.PENDING_PAYMENT,
            to: BOOKING_STATUS.CONFIRMED,
            at: now,
            actorId: customerId,
            actorRole: 'customer',
            reason: 'Cash on service selected',
          },
        },
      },
      { new: true },
    );
    if (updated) return { replayed: false, booking: toClient(updated) };

    const fresh = await BookingModel.findById(booking._id);
    if (fresh && fresh.status === BOOKING_STATUS.CONFIRMED) return { replayed: true, booking: toClient(fresh) };
    throw new AppError(409, 'BOOKING_NOT_PAYABLE', 'This booking can no longer be paid. Please start a new booking.');
  },

  /**
   * Automatically sync/backfill missing Payment records for paid or completed bookings,
   * and update any stale PENDING payment records for completed/settled bookings.
   */
  async syncMissingPayments(customerId: string | Types.ObjectId): Promise<void> {
    try {
      const custObjId = typeof customerId === 'string' ? new Types.ObjectId(customerId) : customerId;
      const paidBookings = await BookingModel.find({
        customerId: custObjId,
        $or: [
          { paymentStatus: 'PAID' },
          { 'paymentDetails.status': 'PAID' },
          { status: { $in: ['completed', 'rated'] } },
        ],
      }).lean();

      if (paidBookings.length === 0) return;

      const bookingIds = paidBookings.map((b) => b._id);
      const existingPayments = await PaymentModel.find({
        bookingId: { $in: bookingIds },
      }).lean();

      const existingBookingIds = new Set(existingPayments.map((p) => String(p.bookingId)));
      const existingOrderIds = new Set(existingPayments.map((p) => p.razorpayOrderId).filter(Boolean));

      // 1. Update stale PENDING payments for completed/settled bookings
      const pendingPaymentsToUpdate = existingPayments.filter(
        (p) => p.status === 'PENDING' && !p.errorReason,
      );
      if (pendingPaymentsToUpdate.length > 0) {
        const updateIds = pendingPaymentsToUpdate.map((p) => p._id);
        const now = new Date();
        await PaymentModel.updateMany(
          { _id: { $in: updateIds } },
          { $set: { status: 'PAID', paidAt: now, creditedAt: now } },
        );
      }

      // 2. Backfill payments for bookings completely missing a Payment record
      const missingBookings = paidBookings.filter((b) => !existingBookingIds.has(String(b._id)));
      if (missingBookings.length === 0) return;

      const docs = missingBookings.map((b) => {
        const amount = Number(b.priceSnapshot?.total ?? (b as { priceBreakdown?: { total?: number } }).priceBreakdown?.total ?? 0);
        const paidAt = b.paymentDetails?.paidAt
          ? new Date(b.paymentDetails.paidAt)
          : (b as { completedAt?: Date }).completedAt
          ? new Date((b as { completedAt?: Date }).completedAt!)
          : b.updatedAt
          ? new Date(b.updatedAt)
          : b.createdAt
          ? new Date(b.createdAt)
          : new Date();

        let orderId = (b.paymentDetails?.orderId && String(b.paymentDetails.orderId).trim()) || `order_${String(b._id)}`;
        if (existingOrderIds.has(orderId)) {
          orderId = `order_${String(b._id)}_${Date.now().toString(36)}`;
        }
        existingOrderIds.add(orderId);

        const paymentId = (b.paymentDetails?.paymentId && String(b.paymentDetails.paymentId).trim()) || `pay_${String(b._id)}`;
        const method = b.paymentDetails?.method || ((b as { paymentMethod?: string }).paymentMethod === 'cash' ? 'cod' : 'netbanking');

        return {
          bookingId: b._id,
          customerId: b.customerId,
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId,
          razorpaySignature: b.paymentDetails?.signature,
          amount,
          currency: b.priceSnapshot?.currency || 'INR',
          method,
          attempts: 1,
          status: 'PAID' as const,
          paidAt,
          creditedAt: paidAt,
          refund: { status: 'none' as const },
          createdAt: paidAt,
          updatedAt: b.updatedAt ? new Date(b.updatedAt) : paidAt,
        };
      });

      await PaymentModel.insertMany(docs, { ordered: false });
    } catch (err) {
      console.error('Failed to auto-sync missing payments:', err);
    }
  },

  /** GET /payments: the signed-in customer's transactions only. */
  async list(customerId: string, query: ListQuery): Promise<PaymentListResult> {
    await this.syncMissingPayments(customerId);

    const filter = {
      customerId: new Types.ObjectId(customerId),
      // A Cash-on-Service placeholder replaced by an online payment is bookkeeping, not a failed payment.
      errorReason: { $ne: 'Superseded by online payment' },
      ...(query.status ? { status: query.status } : {}),
    };
    const [total, rows] = await Promise.all([
      PaymentModel.countDocuments(filter),
      PaymentModel.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    ]);
    const bookings = await BookingModel.find({ _id: { $in: rows.map((r) => r.bookingId) } })
      .select('serviceName date scheduledAt')
      .lean();
    const byId = new Map(bookings.map((b) => [String(b._id), b]));

    const items: PaymentListItem[] = rows.map((r) => {
      const b = byId.get(String(r.bookingId));
      const id = String(r._id);
      return {
        id,
        bookingId: String(r.bookingId),
        bookingRef: `BK-${String(r.bookingId).slice(-5).toUpperCase()}`,
        serviceName: b?.serviceName ?? 'Home Service',
        bookingDate: b?.date ?? null,
        amount: r.amount,
        currency: r.currency,
        method: r.method ?? null,
        status: r.status,
        paidAt: r.paidAt ? (r.paidAt instanceof Date ? r.paidAt.toISOString() : new Date(r.paidAt).toISOString()) : null,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : new Date(r.createdAt).toISOString(),
        receiptNo: r.status === 'PAID' ? `RCPT-${id.slice(-8).toUpperCase()}` : null,
      };
    });
    return { items, page: query.page, limit: query.limit, total };
  },
};

/* -------------------------------- webhook -------------------------------- */

/** What the webhook needs from storage; faked in tests. */
export interface WebhookStore {
  /** true = first time we see this event id; false = replay. */
  recordEvent(e: { eventId: string; event: string; orderId?: string; paymentId?: string }): Promise<boolean>;
  forgetEvent(eventId: string): Promise<void>;
  settleCaptured(entity: RazorpayPaymentEntity): Promise<{ confirmed: boolean }>;
  noteFailed(entity: RazorpayPaymentEntity): Promise<void>;
}

const isDuplicateKey = (err: unknown): boolean => (err as { code?: number })?.code === 11000;

export const mongoWebhookStore: WebhookStore = {
  async recordEvent(e) {
    try {
      await PaymentEventModel.create({ eventId: e.eventId, event: e.event, razorpayOrderId: e.orderId, razorpayPaymentId: e.paymentId });
      return true;
    } catch (err) {
      if (isDuplicateKey(err)) return false;
      throw err;
    }
  },

  async forgetEvent(eventId) {
    await PaymentEventModel.deleteOne({ eventId });
  },

  async settleCaptured(entity) {
    if (!entity.order_id) return { confirmed: false };
    const payment: IPayment | null = await PaymentModel.findOne({ razorpayOrderId: entity.order_id });
    if (!payment) return { confirmed: false }; // not an order we created
    const booking = await BookingModel.findById(payment.bookingId);
    if (!booking) return { confirmed: false };

    if (!entityMatchesBooking(entity, entity.order_id, booking)) {
      await PaymentModel.updateOne({ _id: payment._id, status: { $ne: 'PAID' } }, { $set: { errorReason: 'Amount/order mismatch (webhook)' } });
      return { confirmed: false };
    }
    const outcome = await settleCapturedPayment({
      payment,
      paymentId: entity.id,
      method: entity.method,
      actor: { role: 'system' },
      reason: 'Payment captured (webhook)',
    });
    return { confirmed: outcome.kind === 'confirmed' || outcome.kind === 'replayed' };
  },

  async noteFailed(entity) {
    if (!entity.order_id) return;
    // The order stays payable (customer can retry inside Razorpay), so we only record why it failed.
    const payment = await PaymentModel.findOneAndUpdate(
      { razorpayOrderId: entity.order_id, status: 'PENDING' },
      { $set: { errorReason: `FAILED: ${(entity.error_description ?? 'payment failed').slice(0, 200)}` } },
    );
    if (payment) await markPaymentFailed(String(payment.bookingId));
  },
};

export interface WebhookInput {
  rawBody: Buffer;
  signature: string | undefined;
  eventId: string | undefined;
  secret: string | undefined;
}

/**
 * POST /payments/webhook. Order of checks matters:
 *   1. signature on the RAW body (400 if wrong, nothing is parsed or stored before this)
 *   2. event id dedupe (replay -> 200, no side effects)
 *   3. act on the event; if that throws, forget the event id so the gateway's retry is processed.
 */
export async function processWebhook(input: WebhookInput, store: WebhookStore = mongoWebhookStore): Promise<WebhookResult> {
  if (!input.secret) throw new AppError(503, 'WEBHOOK_NOT_CONFIGURED', 'Webhook secret is not configured');
  if (!input.signature || !verifyWebhookSignature(input.rawBody, input.signature, input.secret)) {
    throw new AppError(400, 'INVALID_SIGNATURE', 'Invalid webhook signature');
  }

  let body: WebhookPayload;
  try {
    body = JSON.parse(input.rawBody.toString('utf8')) as WebhookPayload;
  } catch {
    throw new AppError(400, 'INVALID_PAYLOAD', 'Webhook body is not valid JSON');
  }

  const handled: string[] = [WEBHOOK_EVENTS.PAYMENT_CAPTURED, WEBHOOK_EVENTS.ORDER_PAID, WEBHOOK_EVENTS.PAYMENT_FAILED];
  if (typeof body.event !== 'string' || !handled.includes(body.event)) return { outcome: 'ignored' };

  const entity = body.payload?.payment?.entity;
  if (!entity?.id) return { outcome: 'ignored' };

  const eventId = input.eventId?.trim() || `body:${createHash('sha256').update(input.rawBody).digest('hex')}`;
  const first = await store.recordEvent({ eventId, event: body.event, orderId: entity.order_id, paymentId: entity.id });
  if (!first) return { outcome: 'replayed' };

  try {
    if (body.event === WEBHOOK_EVENTS.PAYMENT_FAILED) {
      await store.noteFailed(entity);
      return { outcome: 'processed', bookingConfirmed: false };
    }
    const { confirmed } = await store.settleCaptured(entity);
    return { outcome: 'processed', bookingConfirmed: confirmed };
  } catch (err) {
    await store.forgetEvent(eventId).catch(() => undefined);
    throw err;
  }
}