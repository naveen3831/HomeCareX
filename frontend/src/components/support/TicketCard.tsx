import { Link } from 'react-router-dom';
import {
  label,
  ticketRef,
  when,
  type CustomerTicket,
} from '@/features/support/types';

export default function TicketCard({ ticket }: { ticket: CustomerTicket }) {
  const id = ticket.id || (ticket as { _id?: string })._id || '';
  return (
    <li className="hcx-support-ticket">
      <div>
        <span className="hcx-support-eyebrow">{ticketRef(id)}</span>
        <h3>
          <Link to={`/customer/support/tickets/${id}`}>
            {ticket.subject || 'Support Ticket'}
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
          className={`hcx-support-badge hcx-support-badge--${ticket.status || 'open'}`}
        >
          {ticket.status || 'open'}
        </span>
        <time dateTime={ticket.createdAt}>
          {when(ticket.createdAt)}
        </time>
      </div>
    </li>
  );
}
