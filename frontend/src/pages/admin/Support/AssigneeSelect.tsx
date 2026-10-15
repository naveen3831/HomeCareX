import React from 'react';
import { Loader2 } from 'lucide-react';
import type { AssignableAgent, TicketAssignee } from '@/types/adminTicket';

interface Props {
  value: TicketAssignee | null;
  agents: AssignableAgent[];
  /** Disables the control while a request is in flight (shows a spinner). */
  saving?: boolean;
  disabled?: boolean;
  /** Accessible name, e.g. "Assignee for TCK-1042". */
  label: string;
  onChange: (assigneeId: string | null) => void;
}

/** Native select: keyboard and screen-reader friendly, and inline in a table row. */
export const AssigneeSelect: React.FC<Props> = ({ value, agents, saving, disabled, label, onChange }) => {
  // The current assignee may not be in the agent list (deactivated, list still loading): keep them selectable.
  const hasCurrent = !value || agents.some((a) => a.id === value.id);
  return (
    <span className="sup-assignee">
      <select
        value={value?.id ?? ''}
        disabled={disabled || saving}
        aria-label={label}
        aria-busy={saving || undefined}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Unassigned</option>
        {!hasCurrent && value && <option value={value.id}>{value.name}</option>}
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      {saving && <Loader2 size={14} className="sup-spin" aria-hidden />}
    </span>
  );
};

export default AssigneeSelect;
