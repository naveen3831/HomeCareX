import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requirePermission } from '../../middleware/permission.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { validate } from '../../middleware/validation.middleware';
import { getPerformance, getPerformanceTrends } from './partner-performance.controller';
import { performanceQuerySchema } from './partner-performance.validation';

export const partnerPerformanceRoutes = Router();

// GET /api/v1/partner/performance  (role: partner, permission: partner:performance:read)
partnerPerformanceRoutes.get(
  '/',
  authenticate,
  requireRole('partner'),
  requirePermission('partner:performance:read'),
  validate(performanceQuerySchema, 'query'),
  getPerformance,
);

// GET /api/v1/partner/performance/trends
partnerPerformanceRoutes.get(
  '/trends',
  authenticate,
  requireRole('partner'),
  requirePermission('partner:performance:read'),
  validate(performanceQuerySchema, 'query'),
  getPerformanceTrends,
);

export default partnerPerformanceRoutes;