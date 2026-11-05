import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { requirePermission } from '../../middleware/permission.middleware';

import { PartnersController } from './partners.controller';
import { partnerTrainingAdminRoutes } from './partner-training.admin.routes';

/**
 * Mounted at /api/v1/admin/partners.
 * Admin only.
 */
export const partnersRoutes = Router();

const controller = new PartnersController();

partnersRoutes.use(authenticate, requireAdmin);

// Training (demo) review: approve a partner who finished it, or send them back to step 1
partnersRoutes.use('/:id/training', partnerTrainingAdminRoutes);

// Statistics
partnersRoutes.get('/stats', controller.getStats);

// Directory
partnersRoutes.get('/directory', controller.getDirectory);

// List all partners
partnersRoutes.get('/', controller.getPartners);

// Create a partner
partnersRoutes.post('/', controller.create);

// KYC: approve / reject (emails the partner), and stream one stored document for the admin preview
partnersRoutes.post('/:id/kyc', requirePermission('kyc:approve'), controller.reviewKyc);
partnersRoutes.get('/:id/kyc/documents/:docId', requirePermission('kyc:approve'), controller.getKycDocument);

// Get one partner by ID — required for the View button
partnersRoutes.get('/:id', controller.getById);

// Update a partner
partnersRoutes.patch('/:id', controller.update);

// Delete a partner
partnersRoutes.delete('/:id', controller.remove);

export default partnersRoutes;