import React from 'react';
import { Loader2 } from 'lucide-react';
import { TICKET_STATUSES, type TicketStatus } from '@/types/adminTicket';
import { STATUS_LABEL } from './ticketFormat';

interface Props {
  value: TicketStatus;
  saving?: boolean;
  disabled?: boolean;
  /** Accessible name, e.g. "Status for TCK-1042". */
  label: string;
  onChange: (status: TicketStatus) => void;
}

/** Native select, coloured like the status badge so the table still reads at a glance. */
export const StatusSelect: React.FC<Props> = ({ value, saving, disabled, label, onChange }) => (
  <span className="sup-assignee sup-statusselect">
    <select
      className={`sup-statusselect__select sup-status--${value.toLowerCase()}`}
      value={value}
      disabled={disabled || saving}
      aria-label={label}
      aria-busy={saving || undefined}
      onChange={(e) => onChange(e.target.value as TicketStatus)}
    >
      {TICKET_STATUSES.map((s) => (
        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
      ))}
    </select>
    {saving && <Loader2 size={14} className="sup-spin" aria-hidden />}
  </span>
);

export default StatusSelect;
