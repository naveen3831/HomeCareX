import type { RefundMethod, RefundRequestStatus } from '../../models/Refund';

export interface CreateRefundInput {
  paymentId: string;
  amount: number;
  reason: string;
  method?: RefundMethod;
}

export interface UpdateRefundInput {
  action: 'approve' | 'reject';
  rejectionReason?: string;
  reason?: string;
}

export interface RejectRefundInput {
  reason: string;
}

export interface RefundQuery {
  status?: string;
  paymentId?: string;
  bookingId?: string;
  customerId?: string;
  search?: string;
  page?: number;
  limit?: number;
}
