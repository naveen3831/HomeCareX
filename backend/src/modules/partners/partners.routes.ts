import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';
import { PartnersController } from './partners.controller';

/** Mounted at /api/v1/admin/partners. Admin only. */
export const partnersRoutes = Router();

const controller = new PartnersController();

partnersRoutes.use(authenticate, requireAdmin);

partnersRoutes.get('/stats', controller.getStats); // GET  /admin/partners/stats -> { partners, customers }
partnersRoutes.get('/directory', controller.getDirectory); // GET /admin/partners/directory -> rows for Partners & KYC
partnersRoutes.get('/', controller.getPartners);
partnersRoutes.get('/:id', controller.getOne); //   GET  /admin/partners/:id  (details page; keep after /stats and /directory)
partnersRoutes.get('/:id/kyc/documents/:docId', controller.getKycDocument); // GET /admin/partners/:id/kyc/documents/:docId -> the file (admin only)
partnersRoutes.post('/:id/kyc', controller.reviewKyc); // POST /admin/partners/:id/kyc  { decision, reason? }
partnersRoutes.post('/', controller.create); //       POST /admin/partners
partnersRoutes.patch('/:id', controller.update); //  PATCH /admin/partners/:id  (edit fields / block-unblock)
partnersRoutes.delete('/:id', controller.remove); // DELETE /admin/partners/:id

export default partnersRoutes;
