import { Link } from 'react-router-dom';
import {
  label,
  ticketRef,
  when,
  type CustomerTicket,
} from '@/features/support/types';

export default function TicketCard({ ticket }: { ticket: CustomerTicket }) {
  return (
    <li className="hcx-support-ticket">
      <div>
        <span className="hcx-support-eyebrow">{ticketRef(ticket.id)}</span>
        <h3>
          <Link to={`/customer/support/tickets/${ticket.id}`}>
            {ticket.subject}
          </Link>
        </h3>
        <p className="hcx-support-muted">
          {label(ticket.category)} ·{' '}
          {ticket.bookingId
            ? `Booking ${ticket.bookingId}`
            : 'General question'}
        </p>
      </div>
      <div className="hcx-support-ticket-meta">
        <span
          className={`hcx-support-badge hcx-support-badge--${ticket.status}`}
        >
          {label(ticket.status)}
        </span>
        <span>{label(ticket.priority)} priority</span>
        <time dateTime={ticket.updatedAt}>{when(ticket.updatedAt)}</time>
      </div>
    </li>
  );
}
