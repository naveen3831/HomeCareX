
import { Router } from 'express';

import { authenticate } from '../../middleware/auth.middleware';
import { requireAdmin } from '../../middleware/role.middleware';

import { PartnersController } from './partners.controller';

/**
 * Mounted at /api/v1/admin/partners.
 * Admin only.
 */
export const partnersRoutes = Router();

const controller = new PartnersController();

partnersRoutes.use(authenticate, requireAdmin);

// Statistics
partnersRoutes.get('/stats', controller.getStats);

// Directory
partnersRoutes.get('/directory', controller.getDirectory);

// List all partners
partnersRoutes.get('/', controller.getPartners);

// Create a partner
partnersRoutes.post('/', controller.create);

// Get one partner by ID — required for the View button
partnersRoutes.get('/:id', controller.getById);

// Update a partner
partnersRoutes.patch('/:id', controller.update);

// Delete a partner
partnersRoutes.delete('/:id', controller.remove);

export default partnersRoutes;
