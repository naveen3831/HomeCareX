import { Router } from 'express';
import { authController } from './auth.controller';
import { authMiddleware } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { authRateLimit } from '../../middleware/rateLimit.middleware';


export const authRoutes = Router();

authRoutes.post('/login', authRateLimit, authController.login);
authRoutes.post('/register', authRateLimit, authController.register);
authRoutes.post('/refresh', authController.refresh);
authRoutes.post('/logout', authController.logout);
authRoutes.post('/forgot-password', authRateLimit, authController.forgotPassword);
authRoutes.post('/verify-otp', authRateLimit, authController.verifyOtp);
authRoutes.post('/resend-otp', authRateLimit, authController.resendOtp);
authRoutes.post('/reset-password', authRateLimit, authController.resetPassword);
authRoutes.post('/verify-invite', authRateLimit, authController.verifyInvite);
authRoutes.post('/accept-invite', authRateLimit, authController.acceptInvite);
authRoutes.get('/me', authMiddleware, authController.me);

// Account Security & Session Management routes
authRoutes.get('/sessions', authMiddleware, authController.getSessions);
authRoutes.delete('/sessions/:id', authMiddleware, authController.revokeSession);
authRoutes.post('/logout-all', authMiddleware, authController.logoutAll);
authRoutes.post('/revoke-user-sessions/:userId', authMiddleware, requireAdmin, authController.revokeUserSessions);
authRoutes.post('/change-password', authRateLimit, authMiddleware, authController.changePassword);

export default authRoutes;