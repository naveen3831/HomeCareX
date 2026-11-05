import { Router } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import { authMiddleware } from '../../middleware/auth.middleware';
import { roleMiddleware } from '../../middleware/role.middleware';
import { validationMiddleware } from '../../middleware/validation.middleware';
import {
  confirmCashOnService,
  createPaymentOrder,
  handlePaymentCallback,
  listPayments,
  paymentWebhook,
  recordPaymentAttempt,
  autoAdvanceTestPaymentController,
  submitMockBankOutcomeController,
  simulateTestPaymentController,
  verifyPayment,
} from './payments.controller';
import { attemptBodySchema, codBodySchema, listQuerySchema, orderBodySchema, verifyBodySchema } from './payments.validation';

const router = Router();

// Public on purpose: Razorpay cannot send a JWT. Trust comes from the HMAC signature on the raw body.
router.post('/webhook', asyncHandler(paymentWebhook));

// Public on purpose: bank/Razorpay browser redirect carries no Authorization header.
router.all('/callback', asyncHandler(handlePaymentCallback));

router.use(authMiddleware, roleMiddleware('customer'));

router.get('/', validationMiddleware({ query: listQuerySchema }), asyncHandler(listPayments));
router.post('/order', validationMiddleware({ body: orderBodySchema }), asyncHandler(createPaymentOrder));
router.post('/create-order', validationMiddleware({ body: orderBodySchema }), asyncHandler(createPaymentOrder)); // legacy alias
router.post('/cod', validationMiddleware({ body: codBodySchema }), asyncHandler(confirmCashOnService));
router.post('/verify', validationMiddleware({ body: verifyBodySchema }), asyncHandler(verifyPayment));
router.post('/test-simulate', asyncHandler(simulateTestPaymentController));
router.post('/test-auto-advance', asyncHandler(autoAdvanceTestPaymentController));
router.post('/test-mockbank-submit', asyncHandler(submitMockBankOutcomeController));
router.post('/attempt', validationMiddleware({ body: attemptBodySchema }), asyncHandler(recordPaymentAttempt));

export default router;
