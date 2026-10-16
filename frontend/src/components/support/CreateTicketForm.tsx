import { useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useCreateTicket } from '@/hooks/useCreateTicket';
import { bookingApi } from '@/services/bookingApi';
import {
  getBookingCode,
  getBookingId,
  getServiceName,
} from '@/pages/customer/Bookings/bookingModel';
import {
  CATEGORIES,
  label,
  problem,
  type NewTicket,
  type TicketCategory,
  type TicketPriority,
} from '@/features/support/types';
import { validateFiles } from '@/features/support/attachments';
import AttachmentPicker from './AttachmentPicker';

export default function CreateTicketForm({
  category = 'booking',
}: {
  category?: TicketCategory;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const mutation = useCreateTicket();
  const locked = useRef(false);
  const [input, setInput] = useState<NewTicket>({
    category,
    subject: '',
    body: '',
    priority: 'normal',
  });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [bookingPage, setBookingPage] = useState(1);
  const [bookingSearch, setBookingSearch] = useState('');
  const [selectedBookingLabel, setSelectedBookingLabel] = useState('');
  const bookings = useQuery({
    queryKey: ['support-booking-options', user?.id, bookingPage, bookingSearch],
    queryFn: ({ signal }) =>
      bookingApi.listBookings(
        {
          page: bookingPage,
          limit: 10,
          search: bookingSearch || undefined,
          sort: 'newest',
        },
        signal,
      ),
    enabled: Boolean(user) && online,
    retry: false,
  });
  const busy = mutation.isPending;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked.current || !online) return;
    const issue = validateFiles(files);
    if (
      issue ||
      input.subject.trim().length < 3 ||
      input.body.trim().length < 10
    ) {
      setError(
        issue ??
          'Enter a subject of at least 3 characters and a description of at least 10 characters.',
      );
      return;
    }
    setError('');
    locked.current = true;
    try {
      const ticket = await mutation.mutateAsync({
        input: {
          ...input,
          subject: input.subject.trim(),
          body: input.body.trim(),
        },
        files,
      });
      navigate(`/customer/support/tickets/${ticket.id}`);
    } catch (err) {
      setError(problem(err));
    } finally {
      locked.current = false;
    }
  }
  return (
    <form className="hcx-support-form" onSubmit={(event) => void submit(event)}>
      <div className="hcx-support-section-head">
        <div>
          <h2>Create a support ticket</h2>
          <p className="hcx-support-muted">
            Tell us what happened. Your conversation stays private.
          </p>
        </div>
      </div>
      <div className="hcx-support-form-grid">
        <div>
          <label htmlFor="ticket-category">Category</label>
          <select
            id="ticket-category"
            value={input.category}
            disabled={busy}
            onChange={(e) =>
              setInput({ ...input, category: e.target.value as TicketCategory })
            }
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {label(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="ticket-priority">Priority</label>
          <select
            id="ticket-priority"
            value={input.priority}
            disabled={busy}
            onChange={(e) =>
              setInput({ ...input, priority: e.target.value as TicketPriority })
            }
          >
            {(['low', 'normal', 'high', 'urgent'] as const).map((p) => (
              <option key={p} value={p}>
                {label(p)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset disabled={busy} className="hcx-support-bookings">
        <legend>
          Related booking <span className="hcx-support-muted">(optional)</span>
        </legend>
        <label htmlFor="ticket-booking-search">Find a booking</label>
        <input
          id="ticket-booking-search"
          type="search"
          value={bookingSearch}
          maxLength={100}
          placeholder="Search by service or booking reference"
          onChange={(e) => {
            setBookingSearch(e.target.value);
            setBookingPage(1);
          }}
        />
        {bookings.isFetching && (
          <p role="status" className="hcx-support-muted">
            Loading your bookings…
          </p>
        )}
        {bookings.isError && (
          <p className="hcx-support-error" role="alert">
            {problem(bookings.error)}{' '}
            <button type="button" onClick={() => void bookings.refetch()}>
              Retry bookings
            </button>
          </p>
        )}
        <label htmlFor="ticket-booking">Booking</label>
        <select
          id="ticket-booking"
          value={input.bookingId ?? ''}
          onChange={(e) => {
            setSelectedBookingLabel(
              e.target.selectedOptions[0].textContent ?? '',
            );
            setInput({ ...input, bookingId: e.target.value || undefined });
          }}
        >
          <option value="">General question / no booking</option>
          {input.bookingId &&
            !bookings.data?.items.some(
              (b) => getBookingId(b) === input.bookingId,
            ) && (
              <option value={input.bookingId}>{selectedBookingLabel}</option>
            )}
          {bookings.data?.items.map((b) => (
            <option key={getBookingId(b)} value={getBookingId(b)}>
              {getBookingCode(b)} · {getServiceName(b)}
            </option>
          ))}
        </select>
        {bookings.isSuccess && !bookings.data.items.length && (
          <p className="hcx-support-muted">
            No matching bookings. You can still raise a general question.
          </p>
        )}
        {(bookings.data?.meta.totalPages ?? 1) > 1 && (
          <div className="hcx-support-pagination">
            <button
              type="button"
              disabled={bookingPage === 1 || bookings.isFetching}
              onClick={() => setBookingPage((p) => p - 1)}
            >
              Previous bookings
            </button>
            <span>
              Page {bookingPage} of {bookings.data?.meta.totalPages}
            </span>
            <button
              type="button"
              disabled={
                bookingPage >= (bookings.data?.meta.totalPages ?? 1) ||
                bookings.isFetching
              }
              onClick={() => setBookingPage((p) => p + 1)}
            >
              Next bookings
            </button>
          </div>
        )}
      </fieldset>
      <div>
        <label htmlFor="ticket-subject">Subject</label>
        <input
          id="ticket-subject"
          value={input.subject}
          onChange={(e) => setInput({ ...input, subject: e.target.value })}
          required
          minLength={3}
          maxLength={200}
          disabled={busy}
          placeholder="A short summary of your issue"
        />
      </div>
      <div>
        <label htmlFor="ticket-description">Description</label>
        <textarea
          id="ticket-description"
          value={input.body}
          onChange={(e) => setInput({ ...input, body: e.target.value })}
          required
          minLength={10}
          maxLength={4000}
          disabled={busy}
          rows={6}
          placeholder="Describe what happened and how we can help."
        />
        <p className="hcx-support-muted">
          {input.body.length}/4000 characters. Do not include passwords or
          payment PINs.
        </p>
      </div>
      <AttachmentPicker
        files={files}
        onChange={setFiles}
        disabled={busy || !online}
      />
      {error && (
        <p className="hcx-support-error" role="alert">
          {error}
        </p>
      )}
      {!online && (
        <p role="status">
          You’re offline. Your form stays here while you reconnect.
        </p>
      )}
      <button
        className="hcx-support-primary"
        type="submit"
        disabled={busy || !online}
      >
        {busy ? 'Creating ticket…' : 'Create ticket'}
      </button>
    </form>
  );
}
