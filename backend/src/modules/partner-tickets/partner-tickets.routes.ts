import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import * as controller from './partner-tickets.controller';

export const partnerTicketsRoutes = Router();

// All routes: /api/v1/partner/support/tickets (role: partner). Partners only ever see their own tickets.
partnerTicketsRoutes.use(authenticate, requireRole('partner'));

partnerTicketsRoutes.post('/', controller.createTicket);
partnerTicketsRoutes.get('/', controller.listTickets);
partnerTicketsRoutes.get('/:id', controller.getTicket);
partnerTicketsRoutes.post('/:id/reply', controller.replyToTicket);

export default partnerTicketsRoutes;