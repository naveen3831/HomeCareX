import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, Loader2, Radio, Wallet } from 'lucide-react';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { PermissionGate } from '@/components/admin/PermissionGate';
import TicketThread from '@/components/support/TicketThread';
import {
  assignTicket,
  escalateTicket,
  fetchAdminTicket,
  fetchAssignableAgents,
  fetchTicketMessages,
  postTicketMessage,
  updateTicketPriority,
  updateTicketStatus,
} from '@/services/adminTicketApi';
import {
  type AdminTicket,
  type AssignableAgent,
  type TicketMessage,
  type TicketPriority,
  type TicketStatus,
  type TicketUpdatedEvent,
} from '@/types/adminTicket';
import AssigneeSelect from './AssigneeSelect';
import PrioritySelect from './PrioritySelect';
import SlaBadge from './SlaBadge';
import StatusSelect from './StatusSelect';
import TicketReplyBox from './TicketReplyBox';
import { useTicketLive } from './useTicketLive';
import { PRIORITY_LABEL, STATUS_LABEL, formatDateTime } from './ticketFormat';
import './index.css';

const SLA_TICK_MS = 30_000;

type ApiError = { response?: { status?: number; data?: { message?: string } }; message?: string };
const errorMessage = (e: unknown, fallback: string): string => {
  const err = e as ApiError;
  return err?.response?.data?.message || err?.message || fallback;
};

/** "app_issue" -> "App issue" */
const categoryLabel = (c?: string | null): string => {
  if (!c) return '—';
  const text = c.replace(/_/g, ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const inr = (n: number | null | undefined): string =>
  n == null ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

/** "COMPLETED" / "partially_paid" -> "Completed" / "Partially paid" */
const humanize = (v?: string | null): string => {
  if (!v) return '—';
  const t = v.replace(/_/g, ' ').toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** "Ananya Rao" -> "AR" */
const initials = (name?: string | null): string => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return ((parts[0][0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
};

/** Permission that gates issuing a refund or wallet credit. Kept in step with the backend (admin-payments.constants.ts). */
export const REFUND_PERMISSION = 'payments:refund';

/**
 * /admin/support/:id: the whole ticket on its own page. It renders inside AdminLayout, so the sidebar stays
 * on screen with "Support" highlighted (findAdminPage matches the /admin/support prefix).
 */
export const AdminSupportTicketPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();

  const [ticket, setTicket] = useState<AdminTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [msgLoading, setMsgLoading] = useState(true);
  const [msgError, setMsgError] = useState<string | null>(null);

  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [agentsFailed, setAgentsFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<null | 'status' | 'priority'>(null);
  const [escalateOpen, setEscalateOpen] = useState(false);
  const [escalating, setEscalating] = useState(false);
  /** Phones only: the details card is folded away until asked for (CSS ignores this on desktop). */
  const [detailsOpen, setDetailsOpen] = useState(false);
  /** Phones only: status / priority / actions sit behind one row so the chat gets the screen. */
  const [manageOpen, setManageOpen] = useState(false);

  const [tick, setTick] = useState(0);
  const [msgTick, setMsgTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), SLA_TICK_MS);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchAssignableAgents()
      .then((list) => alive && setAgents(list))
      .catch(() => alive && setAgentsFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setNotFound(false);
    fetchAdminTicket(id)
      .then((t) => {
        if (!alive) return;
        setTicket(t);
        setNow(Date.now());
      })
      .catch((e: unknown) => {
        if (!alive) return;
        const status = (e as ApiError)?.response?.status;
        if (status === 404 || status === 400) setNotFound(true);
        else setError(errorMessage(e, 'Could not load this ticket. Please try again.'));
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [id, tick]);

  useEffect(() => {
    let alive = true;
    setMsgLoading(true);
    setMsgError(null);
    fetchTicketMessages(id)
      .then((list) => alive && setMessages(list))
      .catch((e: unknown) => alive && setMsgError(errorMessage(e, 'Could not load the conversation.')))
      .finally(() => alive && setMsgLoading(false));
    return () => {
      alive = false;
    };
  }, [id, msgTick]);

  const onAssign = useCallback(
    async (assigneeId: string | null) => {
      if (!ticket) return;
      const previous = ticket;
      const agent = assigneeId ? agents.find((a) => a.id === assigneeId) : undefined;
      setNotice(null);
      setSaving(true);
      setTicket({ ...ticket, assignee: assigneeId ? { id: assigneeId, name: agent?.name ?? '…' } : null });
      try {
        setTicket(await assignTicket(ticket.id, assigneeId));
      } catch (e) {
        setTicket(previous); // roll back
        setNotice(`Couldn't update ${previous.ticketRef}: ${errorMessage(e, 'please try again.')}`);
      } finally {
        setSaving(false);
      }
    },
    [ticket, agents],
  );

  const appendMessage = useCallback((m: TicketMessage) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  // Always the latest ticket, for the live handler (which must not re-subscribe on every change).
  const ticketRef = useRef<AdminTicket | null>(null);
  ticketRef.current = ticket;

  const { live } = useTicketLive(id, {
    onMessage: appendMessage,
    onUpdated: (u: TicketUpdatedEvent) => {
      const t = ticketRef.current;
      const status = u.status?.toUpperCase();
      const priority = u.priority?.toUpperCase();
      // Our own change already updated the page; only refetch when someone else changed something.
      if (t && status === t.status && (!priority || priority === t.priority)) return;
      setTick((n) => n + 1);
    },
  });

  const onSend = useCallback(
    async (input: { body: string; internal: boolean }) => {
      appendMessage(await postTicketMessage(id, input));
    },
    [id, appendMessage],
  );

  /** Optimistic: shows the new value at once, rolls back with a message if the server says no. */
  const onField = useCallback(
    async (field: 'status' | 'priority', value: TicketStatus | TicketPriority) => {
      if (!ticket || ticket[field] === value) return;
      const previous = ticket;
      setNotice(null);
      setSavingField(field);
      setTicket({ ...ticket, [field]: value });
      try {
        setTicket(
          field === 'status'
            ? await updateTicketStatus(ticket.id, value as TicketStatus)
            : await updateTicketPriority(ticket.id, value as TicketPriority),
        );
      } catch (e) {
        setTicket(previous);
        setNotice(`Couldn't update ${previous.ticketRef}: ${errorMessage(e, 'please try again.')}`);
      } finally {
        setSavingField(null);
      }
    },
    [ticket],
  );

  const onEscalate = useCallback(
    async (reason?: string) => {
      if (!ticket || !reason?.trim()) return;
      setEscalating(true);
      setNotice(null);
      try {
        const { ticket: updated, note } = await escalateTicket(ticket.id, reason);
        setTicket(updated);
        if (note) appendMessage(note);
        else setNotice('Escalated to Urgent, but the internal note could not be saved. Add it manually so the next agent knows why.');
        setEscalateOpen(false);
      } catch (e) {
        setEscalateOpen(false);
        setNotice(`Couldn't escalate ${ticket.ticketRef}: ${errorMessage(e, 'please try again.')}`);
      } finally {
        setEscalating(false);
      }
    },
    [ticket, appendMessage],
  );

  const back = (
    <Link to="/admin/support" className="sup-back">
      <ArrowLeft size={16} aria-hidden /> Back to Support
    </Link>
  );

  if (loading && !ticket) {
    return (
      <div className="admin-page-container sup-page">
        {back}
        <div className="sup-state" role="status" aria-live="polite">
          <Loader2 size={22} className="sup-spin" aria-hidden />
          <p className="sup-muted">Loading ticket…</p>
        </div>
      </div>
    );
  }

  if (notFound || (!ticket && !error)) {
    return (
      <div className="admin-page-container sup-page">
        {back}
        <section className="sup-card">
          <div className="sup-state">
            <p className="sup-state__title">Ticket not found</p>
            <p className="sup-muted">It may have been removed, or the link is wrong.</p>
          </div>
        </section>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="admin-page-container sup-page">
        {back}
        <section className="sup-card">
          <div className="sup-state sup-state--error" role="alert">
            <AlertCircle size={22} aria-hidden />
            <p>{error}</p>
            <button type="button" className="sup-btn" onClick={() => setTick((t) => t + 1)}>Try again</button>
          </div>
        </section>
      </div>
    );
  }

  const requester = ticket.requester;
  const closed = ticket.status === 'CLOSED';
  const booking = ticket.bookingContext;

  return (
    <div className="admin-page-container sup-page">
      {back}

      <header className="sup-detail__head">
        <div className="sup-detail__top">
          <code className="sup-mono sup-strong sup-detail__ref">{ticket.ticketRef}</code>
          <span className={`sup-live${live ? ' sup-live--on' : ''}`} role="status">
            <Radio size={13} aria-hidden /> {live ? 'Live' : 'Reconnecting…'}
          </span>
        </div>
        <h1 className="sup-detail__title">{ticket.subject}</h1>
        <div className="sup-detail__badges">
          <span className={`sup-pill sup-pill--${ticket.priority.toLowerCase()}`}>{PRIORITY_LABEL[ticket.priority]}</span>
          <span className={`sup-status sup-status--${ticket.status.toLowerCase()}`}>{STATUS_LABEL[ticket.status]}</span>
          <SlaBadge ticket={ticket} now={now} />
        </div>
        <button type="button" className="sup-manage__toggle" aria-expanded={manageOpen} onClick={() => setManageOpen((o) => !o)}>
          <span className="sup-manage__label">
            <span className="sup-avatar" aria-hidden>{initials(requester?.name)}</span>
            <span className="sup-manage__text">
              <span className="sup-manage__title">Manage ticket</span>
              <span className="sup-manage__sub">{requester?.name || 'Unknown'}{ticket.bookingRef ? ` · ${ticket.bookingRef}` : ''}</span>
            </span>
          </span>
          <ChevronDown size={18} aria-hidden />
        </button>
        <div className={`sup-manage${manageOpen ? ' is-open' : ''}`}>
        <div className="sup-m-summary">
          <span className="sup-avatar" aria-hidden>{initials(requester?.name)}</span>
          <span className="sup-m-summary__text">
            <span className="sup-m-summary__name">{requester?.name || 'Unknown'}</span>
            <span className="sup-m-summary__sub">
              {requester?.type === 'partner' ? 'Partner' : 'Customer'}{ticket.bookingRef ? ` · ${ticket.bookingRef}` : ''}
            </span>
          </span>
        </div>
        <div className="sup-detail__actions" aria-label="Ticket actions">
          <div className="sup-detail__controls">
            <div className="sup-ctl">
              <span className="sup-ctl__label" aria-hidden>Status</span>
              <StatusSelect
                value={ticket.status}
                saving={savingField === 'status'}
                disabled={closed}
                label={`Status for ${ticket.ticketRef}`}
                onChange={(st) => void onField('status', st)}
              />
            </div>
            <div className="sup-ctl">
              <span className="sup-ctl__label" aria-hidden>Priority</span>
              <PrioritySelect
                value={ticket.priority}
                saving={savingField === 'priority'}
                disabled={closed}
                label={`Priority for ${ticket.ticketRef}`}
                onChange={(p) => void onField('priority', p)}
              />
            </div>
          </div>
          <div className="sup-detail__buttons">
            {(ticket.status === 'OPEN' || ticket.status === 'IN_PROGRESS') && (
              <button type="button" className="sup-btn sup-btn--resolve" disabled={savingField !== null} onClick={() => void onField('status', 'RESOLVED')}>
                <CheckCircle2 size={16} aria-hidden /> Resolve
              </button>
            )}
            {!closed && ticket.priority !== 'URGENT' && (
              <button type="button" className="sup-btn sup-btn--escalate" disabled={escalating} onClick={() => setEscalateOpen(true)}>
                <AlertTriangle size={16} aria-hidden /> Escalate
              </button>
            )}
            {ticket.bookingId && (
              <PermissionGate permission={REFUND_PERMISSION}>
                <Link className="sup-btn sup-btn--refund" to={`/admin/refunds?bookingId=${encodeURIComponent(ticket.bookingId)}`}>
                  <Wallet size={16} aria-hidden /> Refund / credit
                </Link>
              </PermissionGate>
            )}
          </div>
        </div>
        </div>
      </header>

      {agentsFailed && (
        <p className="sup-banner" role="status">Couldn't load the agent list, so assigning is unavailable until you refresh.</p>
      )}
      {notice && (
        <div className="sup-banner sup-banner--error" role="alert">
          <span>{notice}</span>
          <button type="button" className="sup-iconbtn" onClick={() => setNotice(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      <div className="sup-detail__grid">
        <section className="sup-panel sup-convo" aria-label="Conversation">
          <h2 className="sup-panel__title">
            Conversation <span className="sup-chipcount">{messages.length}</span>
          </h2>
          <div className="sup-convo__scroll">
            <TicketThread
              messages={messages}
              loading={msgLoading}
              error={msgError}
              onRetry={() => setMsgTick((t) => t + 1)}
              autoScroll
            />
          </div>
          <TicketReplyBox
            disabled={closed}
            disabledReason="This ticket is closed. Messages can't be added."
            onSend={onSend}
          />
        </section>

        <aside className={`sup-panel sup-detail__side${detailsOpen ? ' is-open' : ''}`} aria-label="Ticket details">
          <h2 className="sup-panel__title">Details</h2>
          <button type="button" className="sup-side-toggle" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((o) => !o)}>
            <span>{detailsOpen ? 'Hide requester & booking' : 'Requester & booking details'}</span>
            <ChevronDown size={18} aria-hidden />
          </button>

          <section className="sup-side-sec" aria-label="Requester">
            <h3 className="sup-side-sec__title">Requester</h3>
            <dl className="sup-facts">
              <div className="sup-fact sup-fact--person">
                <span className="sup-avatar sup-avatar--lg" aria-hidden>{initials(requester?.name)}</span>
                <div>
                  <span className="sup-strong">{requester?.name || 'Unknown'}</span>
                  {requester && <span className="sup-sub">{requester.type === 'partner' ? 'Partner' : 'Customer'}</span>}
                </div>
              </div>
              {requester?.email && <div className="sup-fact"><dt>Email</dt><dd>{requester.email}</dd></div>}
              {requester?.phone && <div className="sup-fact"><dt>Phone</dt><dd>{requester.phone}</dd></div>}
            </dl>
          </section>

          <section className="sup-side-sec" aria-label="Booking">
            <h3 className="sup-side-sec__title">Booking</h3>
            <dl className="sup-facts">
              <div className="sup-fact">
                <dt>Booking</dt>
                <dd>{ticket.bookingRef ? <code className="sup-mono">{ticket.bookingRef}</code> : <span className="sup-muted">—</span>}</dd>
              </div>
              {booking && (
                <>
                  <div className="sup-fact"><dt>Service</dt><dd>{booking.serviceName || '—'}</dd></div>
                  <div className="sup-fact">
                    <dt>Booking status</dt>
                    <dd>
                      {humanize(booking.status)}
                      <span className="sup-sub">Payment: {humanize(booking.paymentStatus)}</span>
                    </dd>
                  </div>
                  <div className="sup-fact"><dt>Scheduled</dt><dd>{formatDateTime(booking.scheduledAt)}</dd></div>
                  <div className="sup-fact"><dt>Booking total</dt><dd className="sup-strong">{inr(booking.total)}</dd></div>
                  {booking.address && <div className="sup-fact"><dt>Address</dt><dd>{booking.address}</dd></div>}
                  {booking.partner && <div className="sup-fact"><dt>Partner</dt><dd>{booking.partner.name || 'Unknown'}</dd></div>}
                </>
              )}
            </dl>
          </section>

          <section className="sup-side-sec" aria-label="Ticket">
            <h3 className="sup-side-sec__title">Ticket</h3>
            <dl className="sup-facts">
              <div className="sup-fact"><dt>Category</dt><dd>{categoryLabel(ticket.category)}</dd></div>
              <div className="sup-fact sup-fact--stack">
                <dt>Assignee</dt>
                <dd>
                  <AssigneeSelect
                    value={ticket.assignee}
                    agents={agents}
                    saving={saving}
                    disabled={agentsFailed}
                    label={`Assignee for ${ticket.ticketRef}`}
                    onChange={(a) => void onAssign(a)}
                  />
                </dd>
              </div>
              <div className="sup-fact"><dt>SLA due</dt><dd>{formatDateTime(ticket.sla.dueAt)}</dd></div>
              <div className="sup-fact"><dt>Created</dt><dd>{formatDateTime(ticket.createdAt)}</dd></div>
              <div className="sup-fact"><dt>Last updated</dt><dd>{formatDateTime(ticket.updatedAt)}</dd></div>
            </dl>
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={escalateOpen}
        title={`Escalate ${ticket.ticketRef}?`}
        message="This sets the priority to Urgent (a 4-hour SLA target) and leaves an internal note so the next agent sees why."
        confirmLabel="Escalate"
        tone="danger"
        loading={escalating}
        reason={{ label: 'Reason for escalation', required: true, placeholder: 'e.g. Customer was charged twice and needs finance review' }}
        onConfirm={(reason) => void onEscalate(reason)}
        onCancel={() => setEscalateOpen(false)}
      />
    </div>
  );
};

export default AdminSupportTicketPage;