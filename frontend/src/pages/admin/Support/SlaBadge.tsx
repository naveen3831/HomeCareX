import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, Minus, PauseCircle, XCircle, type LucideIcon } from 'lucide-react';
import type { AdminTicket } from '@/types/adminTicket';
import { getSla, type SlaState } from './sla';

const ICON: Record<SlaState, LucideIcon> = {
  none: Minus,
  ok: Clock3,
  at_risk: AlertTriangle,
  breached: XCircle,
  paused: PauseCircle,
  met: CheckCircle2,
  missed: XCircle,
};

interface Props {
  ticket: Pick<AdminTicket, 'status' | 'sla' | 'createdAt'>;
  /** Epoch ms. Pass one shared clock so every badge ticks together. */
  now: number;
}

/** Countdown / state pill. Colour is reinforced by an icon and the label, never colour alone. */
export const SlaBadge: React.FC<Props> = ({ ticket, now }) => {
  const sla = getSla(ticket, now);
  const Icon = ICON[sla.state];
  return (
    <span className={`sup-sla sup-sla--${sla.state}`} title={sla.title}>
      <Icon size={13} aria-hidden />
      <span>{sla.label}</span>
    </span>
  );
};

export default SlaBadge;
