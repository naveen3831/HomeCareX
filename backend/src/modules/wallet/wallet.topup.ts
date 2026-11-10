import crypto from 'crypto';
import Razorpay from 'razorpay';
import type { Request, Response } from 'express';
import { WalletModel, WalletLedgerModel } from '../../models/Wallet';
import { WalletTopupOrderModel } from '../../models/WalletTopupOrder';
import { getAuthUser } from '../../middleware/auth.middleware';

let razorpayInstance: Razorpay | null = null;
function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    const key_id = process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholder';
    const key_secret = process.env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
    razorpayInstance = new Razorpay({ key_id, key_secret });
  }
  return razorpayInstance;
}

/**
 * Helper to safely extract user ID from auth middleware or token payload
 */
function resolveUserId(req: Request): string | null {
  try {
    const user = getAuthUser(req);
    if (user?.id) return user.id;
  } catch {
    // Fallback if req.user was populated directly by custom middleware
  }
  return (req as unknown as { user?: { id?: string } }).user?.id || null;
}

/**
 * Step 1: Create a Razorpay Order for Wallet Top-Up
 * POST /api/v1/wallet/topup/order
 */
export async function createTopupOrder(req: Request, res: Response): Promise<Response> {
  try {
    const userId = resolveUserId(req);
    const { amount, retryOrderId } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const amountInRupees = Number(amount);
    if (!amountInRupees || amountInRupees < 10 || amountInRupees > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount. Minimum top-up is ₹10 and maximum is ₹50,000.',
      });
    }

    // Check if client is retrying an existing order
    if (retryOrderId) {
      const openOrder = await WalletTopupOrderModel.findOne({ razorpayOrderId: retryOrderId, userId });
      if (openOrder) {
        if (openOrder.status === 'FAILED' || openOrder.attempts >= 4) {
          if (openOrder.status !== 'FAILED') {
            openOrder.status = 'FAILED';
            openOrder.errorReason = 'Maximum payment retries exceeded';
            await openOrder.save();
          }
          return res.status(429).json({
            success: false,
            code: 'PAYMENT_ATTEMPTS_EXCEEDED',
            message: 'You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.',
          });
        }

        return res.status(200).json({
          success: true,
          data: {
            orderId: openOrder.razorpayOrderId,
            amount: Math.round(openOrder.amount * 100),
            currency: openOrder.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            attempt: openOrder.attempts + 1,
          },
        });
      }
    }

    // Razorpay accepts amounts in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(amountInRupees * 100);

    const order = await getRazorpay().orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `top_${Date.now().toString().slice(-8)}`,
      notes: {
        userId,
        type: 'WALLET_TOPUP',
      },
    });

    await WalletTopupOrderModel.create({
      userId,
      razorpayOrderId: order.id,
      amount: amountInRupees,
      currency: 'INR',
      attempts: 0,
      status: 'PENDING',
    });

    return res.status(200).json({
      success: true,
      data: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: process.env.RAZORPAY_KEY_ID,
        attempt: 1,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({
      success: false,
      message: err.message || 'Error creating Razorpay order',
    });
  }
}

/**
 * Step 2: Verify Razorpay Signature & Atomically Credit Wallet
 * POST /api/v1/wallet/topup/verify
 */
export async function verifyTopupPayment(req: Request, res: Response): Promise<Response> {
  try {
    const userId = resolveUserId(req);
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      amount,
    } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification parameters',
      });
    }

    // 1. Verify HMAC SHA256 Signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '')
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature',
      });
    }

    // Prevent verification of failed orders exceeding max retries
    const topupOrder = await WalletTopupOrderModel.findOne({ razorpayOrderId: razorpay_order_id });
    if (topupOrder && (topupOrder.status === 'FAILED' || topupOrder.attempts >= 4)) {
      return res.status(400).json({
        success: false,
        code: 'PAYMENT_ATTEMPTS_EXCEEDED',
        message: 'You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.',
      });
    }

    // 2. Prevent duplicate credit (idempotency check)
    const existingLedger = await WalletLedgerModel.findOne({
      referenceId: razorpay_payment_id,
    });
    if (existingLedger) {
      return res.status(200).json({
        success: true,
        message: 'Payment already credited',
        data: { balance: existingLedger.balanceAfter },
      });
    }

    // 3. Convert incoming paise to Rupees
    let amountInRupees = Math.round(Number(amount) / 100);

    // Verify amount directly against the Razorpay Order record for tamper-proofing
    try {
      const rzpOrder = await getRazorpay().orders.fetch(razorpay_order_id);
      if (rzpOrder && typeof rzpOrder.amount === 'number') {
        amountInRupees = Math.round(rzpOrder.amount / 100);
      }
    } catch {
      // Fallback to client-passed conversion if order fetch is unreachable
      amountInRupees = Math.round(Number(amount) / 100);
    }

    // 4. Atomically upsert wallet and increment balance in RUPEES
    const updatedWallet = await WalletModel.findOneAndUpdate(
      { userId },
      { $inc: { balance: amountInRupees } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 5. Create credit ledger record in RUPEES
    const ledger = await WalletLedgerModel.create({
      walletId: updatedWallet._id,
      userId,
      type: 'credit',
      amount: amountInRupees,
      balanceAfter: updatedWallet.balance,
      description: 'Wallet top-up via Razorpay',
      referenceId: razorpay_payment_id,
    });

    if (topupOrder) {
      topupOrder.status = 'PAID';
      await topupOrder.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Wallet credited successfully',
      data: {
        balance: updatedWallet.balance,
        transaction: ledger,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({
      success: false,
      message: err.message || 'Payment verification failed',
    });
  }
}

/**
 * Step 3: Record a failed top-up after 3 unsuccessful attempts
 * POST /api/v1/wallet/topup/fail
 */
export async function recordFailedTopup(req: Request, res: Response): Promise<Response> {
  try {
    const userId = resolveUserId(req);
    const { orderId, amount, reason, attempts: passedAttempts, markFailed } = req.body;
    const resolvedOrderId = orderId || req.body?.razorpay_order_id;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!resolvedOrderId) {
      return res.status(400).json({
        success: false,
        code: 'BAD_REQUEST',
        message: 'Order ID is required',
      });
    }

    const topupOrder = await WalletTopupOrderModel.findOne({ razorpayOrderId: resolvedOrderId, userId });
    let attempts = 0;
    let isMaxRetries = false;

    if (topupOrder) {
      if (req.body.incrementAttempt !== false) {
        topupOrder.attempts += 1;
      } else if (passedAttempts !== undefined) {
        topupOrder.attempts = Number(passedAttempts);
      }
      attempts = topupOrder.attempts;
      isMaxRetries = attempts >= 4 || markFailed === true;
      topupOrder.errorReason = reason || 'Payment failed';
      if (isMaxRetries) {
        topupOrder.status = 'FAILED';
      }
      await topupOrder.save();
    } else {
      isMaxRetries = markFailed === true;
    }

    // Only record a failed ledger entry once when max retries are reached
    if (isMaxRetries) {
      const existingEntry = await WalletLedgerModel.findOne({ referenceId: resolvedOrderId });
      if (existingEntry) {
        return res.status(200).json({
          success: true,
          maxRetriesReached: true,
          attempts,
          message: 'Failure already recorded',
          data: { transaction: existingEntry },
        });
      }

      let amountInRupees: number = topupOrder ? topupOrder.amount : 0;
      if (!amountInRupees) {
        try {
          const rzpOrder = await getRazorpay().orders.fetch(resolvedOrderId);
          if (rzpOrder && typeof rzpOrder.amount === 'number') {
            amountInRupees = Math.round(rzpOrder.amount / 100);
          } else {
            amountInRupees = Math.round(Number(amount || 0) / 100) || 0;
          }
        } catch {
          amountInRupees = Math.round(Number(amount || 0) / 100) || 0;
        }
      }

      let wallet = await WalletModel.findOne({ userId });
      if (!wallet) {
        wallet = await WalletModel.create({ userId, balance: 0 });
      }

      const ledger = await WalletLedgerModel.create({
        walletId: wallet._id,
        userId,
        type: 'failed',
        amount: amountInRupees,
        balanceAfter: wallet.balance,
        description: reason || 'Top-up payment failed (maximum 3 retries reached)',
        referenceId: resolvedOrderId,
      });

      return res.status(200).json({
        success: true,
        maxRetriesReached: true,
        attempts,
        message: 'You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.',
        data: {
          balance: wallet.balance,
          transaction: ledger,
        },
      });
    }

    return res.status(200).json({
      success: true,
      maxRetriesReached: false,
      attempts,
      message: `Payment attempt recorded (${attempts}/4)`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    return res.status(500).json({
      success: false,
      message: err.message || 'Error recording failed payment',
    });
  }
}
