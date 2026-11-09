import React from 'react';
import type { PaymentSettlement } from '@/types/adminPayment';

/** Settlement pill: green once credited, amber while money is on hold or cash is outstanding. */
export const SettlementBadge: React.FC<{ settlement: PaymentSettlement }> = ({ settlement }) => (
  <span className={`pay-settle pay-settle--${settlement.state.replace(/_/g, '-')}`}>
    <span className="pay-settle__dot" />
    {settlement.label}
  </span>
);

export default SettlementBadge;
