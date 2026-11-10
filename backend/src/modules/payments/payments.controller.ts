import type { Request, Response } from 'express';
import { getAuthUser } from '../../middleware/auth.middleware';
import { WEBHOOK_EVENT_ID_HEADER, WEBHOOK_SIGNATURE_HEADER } from './payments.constants';
import { paymentsService, processWebhook } from './payments.service';
import type { ListQuery } from './payments.validation';

/** POST /payments/order  { bookingId, method? }. `method: "cod"` takes the Cash on Service path. */
export const createPaymentOrder = async (req: Request, res: Response): Promise<void> => {
  const { id } = getAuthUser(req);
  const { bookingId, method } = req.body as { bookingId: string; method?: string };
  if (method === 'cod') {
    const result = await paymentsService.confirmCashOnService(id, bookingId);
    res.json({ success: true, replayed: result.replayed, data: result.booking });
    return;
  }
  const data = await paymentsService.createOrder(id, bookingId);
  res.json({ success: true, data });
};

/** POST /payments/cod  { bookingId } */
export const confirmCashOnService = async (req: Request, res: Response): Promise<void> => {
  const { id } = getAuthUser(req);
  const result = await paymentsService.confirmCashOnService(id, (req.body as { bookingId: string }).bookingId);
  res.json({ success: true, replayed: result.replayed, data: result.booking });
};

/** POST /payments/verify */
export const verifyPayment = async (req: Request, res: Response): Promise<void> => {
  const { id } = getAuthUser(req);
  const result = await paymentsService.verify(id, req.body as Parameters<typeof paymentsService.verify>[1]);
  res.json({ success: true, replayed: result.replayed, data: result.booking });
};

/** POST /payments/attempt */
export const recordPaymentAttempt = async (req: Request, res: Response): Promise<void> => {
  const { id } = getAuthUser(req);
  await paymentsService.recordAttempt(id, req.body as Parameters<typeof paymentsService.recordAttempt>[1]);
  res.json({ success: true });
};

/** POST /payments/test-simulate */
export const simulateTestPaymentController = async (req: Request, res: Response): Promise<void> => {
  const { id } = getAuthUser(req);
  const { bookingId, bank, outcome } = req.body as {
    bookingId: string;
    bank?: string;
    outcome: 'success' | 'failure';
  };
  const result = await paymentsService.simulateTestPayment(id, { bookingId, bank, outcome });
  res.json({ success: true, data: result });
};

/** POST /payments/test-auto-advance */
export const autoAdvanceTestPaymentController = async (req: Request, res: Response): Promise<void> => {
  const { id } = getAuthUser(req);
  const { orderId, bookingId, callbackUrl } = req.body as { orderId: string; bookingId: string; callbackUrl?: string };
  const result = await paymentsService.autoAdvanceTestOrder(id, orderId, bookingId, callbackUrl);
  res.json({ success: true, data: result });
};

/** POST /payments/test-mockbank-submit */
export const submitMockBankOutcomeController = async (req: Request, res: Response): Promise<void> => {
  const { id } = getAuthUser(req);
  const { orderId, bookingId, paymentId, callbackUrl, outcome } = req.body as {
    orderId: string;
    bookingId?: string;
    paymentId: string;
    callbackUrl: string;
    outcome: 'S' | 'F';
  };
  const result = await paymentsService.submitMockBankOutcome(id, {
    orderId,
    bookingId,
    paymentId,
    callbackUrl,
    outcome,
  });
  res.json({ success: true, data: result });
};

/** GET /payments */
export const listPayments = async (req: Request, res: Response): Promise<void> => {
  const { id } = getAuthUser(req);
  const data = await paymentsService.list(id, req.query as unknown as ListQuery);
  res.json({ success: true, data });
};

/** POST /payments/webhook (public; authenticated by the HMAC signature over the raw body). */
export const paymentWebhook = async (req: Request, res: Response): Promise<void> => {
  const result = await processWebhook({
    rawBody: req.rawBody ?? Buffer.alloc(0),
    signature: req.header(WEBHOOK_SIGNATURE_HEADER),
    eventId: req.header(WEBHOOK_EVENT_ID_HEADER),
    secret: process.env.RAZORPAY_WEBHOOK_SECRET,
  });
  res.status(200).json({ success: true, data: result });
};

function getFrontendUrl(req: Request): string {
  if (process.env.FRONTEND_URL) return process.env.FRONTEND_URL.replace(/\/+$/, '');
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.startsWith('http')) return origin.replace(/\/+$/, '');
  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.startsWith('http')) {
    try {
      return new URL(referer).origin;
    } catch {
      // ignore
    }
  }
  const origins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
  return (origins[0] || 'http://localhost:3000').trim().replace(/\/+$/, '');
}

/**
 * Public endpoint for Razorpay mobile redirect callback.
 * Handles both GET and POST requests from banks/Razorpay upon completion.
 */
export const handlePaymentCallback = async (req: Request, res: Response): Promise<void> => {
  const body = (req.body || {}) as Record<string, unknown>;
  const query = (req.query || {}) as Record<string, unknown>;

  const orderId =
    (typeof body.razorpay_order_id === 'string' ? body.razorpay_order_id : null) ||
    (typeof body['error[metadata][order_id]'] === 'string' ? body['error[metadata][order_id]'] : null) ||
    ((body.error as Record<string, unknown>)?.metadata as Record<string, unknown>)?.order_id ||
    (typeof query.order_id === 'string' ? query.order_id : null) ||
    (typeof query.orderId === 'string' ? query.orderId : null);

  const paymentId =
    (typeof body.razorpay_payment_id === 'string' ? body.razorpay_payment_id : null) ||
    (typeof body['error[metadata][payment_id]'] === 'string' ? body['error[metadata][payment_id]'] : null) ||
    ((body.error as Record<string, unknown>)?.metadata as Record<string, unknown>)?.payment_id ||
    (typeof query.payment_id === 'string' ? query.payment_id : null);

  const signature =
    typeof body.razorpay_signature === 'string' ? body.razorpay_signature : null;

  const errorReason =
    (typeof body['error[description]'] === 'string' ? body['error[description]'] : null) ||
    ((body.error as Record<string, unknown>)?.description as string) ||
    (typeof query.error === 'string' ? query.error : null);

  const result = await paymentsService.handleCallback({
    orderId: typeof orderId === 'string' ? orderId : undefined,
    paymentId: typeof paymentId === 'string' ? paymentId : undefined,
    signature: typeof signature === 'string' ? signature : undefined,
    errorReason: typeof errorReason === 'string' ? errorReason : undefined,
  });

  const frontend = getFrontendUrl(req);

  if (result.success && result.bookingId) {
    res.redirect(303, `${frontend}/customer/booking/success/${result.bookingId}`);
    return;
  }

  if (result.bookingId) {
    res.redirect(303, `${frontend}/customer/booking/failed/${result.bookingId}?reason=${encodeURIComponent(result.reason || 'cancelled')}`);
    return;
  }

  res.redirect(303, `${frontend}/customer/bookings`);
};

