import React from 'react';
import { Loader2 } from 'lucide-react';
import { TICKET_PRIORITIES, type TicketPriority } from '@/types/adminTicket';
import { PRIORITY_LABEL } from './ticketFormat';

interface Props {
  value: TicketPriority;
  saving?: boolean;
  disabled?: boolean;
  /** Accessible name, e.g. "Priority for TCK-1042". */
  label: string;
  onChange: (priority: TicketPriority) => void;
}

/** Native select, same look as StatusSelect, so the detail page header reads as one row of controls. */
export const PrioritySelect: React.FC<Props> = ({ value, saving, disabled, label, onChange }) => (
  <span className="sup-assignee sup-statusselect">
    <select
      className="sup-statusselect__select sup-prioselect"
      value={value}
      disabled={disabled || saving}
      aria-label={label}
      aria-busy={saving || undefined}
      onChange={(e) => onChange(e.target.value as TicketPriority)}
    >
      {TICKET_PRIORITIES.map((p) => (
        <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
      ))}
    </select>
    {saving && <Loader2 size={14} className="sup-spin" aria-hidden />}
  </span>
);

export default PrioritySelect;