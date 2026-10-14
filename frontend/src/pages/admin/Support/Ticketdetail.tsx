import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import TicketThread from '@/components/support/TicketThread';
import { assignTicket, fetchAdminTicket, fetchAssignableAgents, fetchTicketMessages } from '@/services/adminTicketApi';
import type { AdminTicket, AssignableAgent, TicketMessage } from '@/types/adminTicket';
import AssigneeSelect from './AssigneeSelect';
import SlaBadge from './SlaBadge';
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

  return (
    <div className="admin-page-container sup-page">
      {back}

      <header className="sup-detail__head">
        <code className="sup-mono sup-strong sup-detail__ref">{ticket.ticketRef}</code>
        <h1 className="sup-detail__title">{ticket.subject}</h1>
        <div className="sup-detail__badges">
          <span className={`sup-pill sup-pill--${ticket.priority.toLowerCase()}`}>{PRIORITY_LABEL[ticket.priority]}</span>
          <span className={`sup-status sup-status--${ticket.status.toLowerCase()}`}>{STATUS_LABEL[ticket.status]}</span>
          <SlaBadge ticket={ticket} now={now} />
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
        <section className="sup-panel" aria-label="Conversation">
          <h2 className="sup-panel__title">Conversation</h2>
          <TicketThread
            messages={messages}
            loading={msgLoading}
            error={msgError}
            onRetry={() => setMsgTick((t) => t + 1)}
          />
        </section>

        <aside className="sup-panel sup-detail__side" aria-label="Ticket details">
          <h2 className="sup-panel__title">Details</h2>
          <dl className="sup-facts">
            <div className="sup-fact">
              <dt>Requester</dt>
              <dd>
                <span className="sup-strong">{requester?.name || 'Unknown'}</span>
                {requester && <span className="sup-sub">{requester.type === 'partner' ? 'Partner' : 'Customer'}</span>}
              </dd>
            </div>
            {requester?.email && (
              <div className="sup-fact"><dt>Email</dt><dd>{requester.email}</dd></div>
            )}
            {requester?.phone && (
              <div className="sup-fact"><dt>Phone</dt><dd>{requester.phone}</dd></div>
            )}
            <div className="sup-fact">
              <dt>Booking</dt>
              <dd>{ticket.bookingRef ? <code className="sup-mono">{ticket.bookingRef}</code> : <span className="sup-muted">—</span>}</dd>
            </div>
            <div className="sup-fact"><dt>Category</dt><dd>{categoryLabel(ticket.category)}</dd></div>
            <div className="sup-fact">
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
        </aside>
      </div>
    </div>
  );
};

export default AdminSupportTicketPage;