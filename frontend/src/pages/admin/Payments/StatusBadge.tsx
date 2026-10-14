import React from 'react';
import type { AdminPayment } from '@/types/adminPayment';
import { STATUS_LABEL } from './paymentFormat';

/** Plain, colourless status pill: the label carries the meaning. */
export const StatusBadge: React.FC<{ status: AdminPayment['status'] }> = ({ status }) => (
  <span className={`pay-status pay-status--${status.toLowerCase()}`}>
    <span className="pay-status__dot" />
    {STATUS_LABEL[status]}
  </span>
);

export default StatusBadge;
