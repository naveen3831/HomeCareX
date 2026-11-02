import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { assignTicket, fetchAdminTickets, fetchAssignableAgents, updateTicketStatus } from '@/services/adminTicketApi';
import { useAuthStore } from '@/store/useAuthStore';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type AdminTicket,
  type AdminTicketsPage,
  type AssignableAgent,
  type TicketPriority,
  type TicketStatus,
} from '@/types/adminTicket';
import HelpTabs from '@/components/admin/HelpTabs';
import { FilterButton, FilterPanel, type FilterField } from '@/components/admin/FilterPanel';
import AssigneeSelect from './AssigneeSelect';
import SlaBadge from './SlaBadge';
import StatusSelect from './StatusSelect';
import { PRIORITY_LABEL, STATUS_LABEL, formatDateTime } from './ticketFormat';
import './index.css';

const PAGE_SIZE = 15;
/** One shared clock: every SLA badge re-renders together, not one timer per row. */
const SLA_TICK_MS = 30_000;

interface Filters {
  status: TicketStatus | '';
  priority: TicketPriority | '';
  assignee: string; // '' | 'unassigned' | agent id
}
const EMPTY: Filters = { status: '', priority: '', assignee: '' };

type FilterKey = keyof Filters;

const errorMessage = (e: unknown, fallback: string): string => {
  const err = e as { response?: { data?: { message?: string } }; message?: string };
  return err?.response?.data?.message || err?.message || fallback;
};

const initials = (name?: string): string =>
  (name ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

export const AdminSupportPage: React.FC = () => {
  const me = useAuthStore((s) => s.user) as { id?: string } | null;
  const myId = me?.id;
  const navigate = useNavigate();
  // Mouse drag-to-scroll for the table on narrow screens (touch already pans natively; a mouse does not).
  const scrollRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, moved: false, x: 0, left: 0 });
  const onScrollPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    drag.current.moved = false;
    if (!el || e.pointerType !== 'mouse' || e.button !== 0 || el.scrollWidth <= el.clientWidth) return;
    if ((e.target as HTMLElement).closest('select, a, button, input')) return; // leave controls alone
    drag.current = { down: true, moved: false, x: e.clientX, left: el.scrollLeft };
  };
  const onScrollPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = scrollRef.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.x;
    if (Math.abs(dx) > 5) {
      drag.current.moved = true;
      el.classList.add('is-dragging');
      el.scrollLeft = drag.current.left - dx;
    }
  };
  const endScrollDrag = () => {
    drag.current.down = false;
    scrollRef.current?.classList.remove('is-dragging');
  };
  const openTicket = (id: string) => {
    if (drag.current.moved) {
      drag.current.moved = false; // that was a drag, not a click
      return;
    }
    navigate(`/admin/support/${id}`);
  };

  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [panelOpen, setPanelOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState(''); // debounced
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<AdminTicketsPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const [agents, setAgents] = useState<AssignableAgent[]>([]);
  const [agentsFailed, setAgentsFailed] = useState(false);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), SLA_TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    let alive = true;
    fetchAssignableAgents()
      .then((list) => alive && setAgents(list))
      .catch(() => alive && setAgentsFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(async () => {
    const req = ++latest.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchAdminTickets({ ...filters, search, page, limit: PAGE_SIZE });
      if (req === latest.current) {
        setData(result);
        setNow(Date.now());
      }
    } catch (e) {
      if (req === latest.current) setError(errorMessage(e, 'Could not load tickets. Please try again.'));
    } finally {
      if (req === latest.current) setLoading(false);
    }
  }, [filters, search, page, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void load();
  }, [load]);

  const patchItem = (id: string, patch: Partial<AdminTicket>) =>
    setData((d) => (d ? { ...d, items: d.items.map((t) => (t.id === id ? { ...t, ...patch } : t)) } : d));

  /** Optimistic assign / reassign / unassign. Rolls back and reports if the server rejects it. */
  const onAssign = async (ticket: AdminTicket, assigneeId: string | null) => {
    const previous = ticket.assignee;
    const agent = assigneeId ? agents.find((a) => a.id === assigneeId) : undefined;
    setNotice(null);
    setSaving((s) => new Set(s).add(ticket.id));
    patchItem(ticket.id, { assignee: assigneeId ? { id: assigneeId, name: agent?.name ?? '…' } : null });
    try {
      const updated = await assignTicket(ticket.id, assigneeId);
      patchItem(ticket.id, updated);
    } catch (e) {
      patchItem(ticket.id, { assignee: previous });
      setNotice(`Couldn't update ${ticket.ticketRef}: ${errorMessage(e, 'please try again.')}`);
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(ticket.id);
        return next;
      });
    }
  };

  /** Optimistic status change. Rolls back and reports if the server rejects it. */
  const onStatusChange = async (ticket: AdminTicket, status: TicketStatus) => {
    if (status === ticket.status) return;
    const previous = ticket.status;
    setNotice(null);
    setSaving((s) => new Set(s).add(ticket.id));
    patchItem(ticket.id, { status });
    try {
      const updated = await updateTicketStatus(ticket.id, status);
      patchItem(ticket.id, updated);
    } catch (e) {
      patchItem(ticket.id, { status: previous });
      setNotice(`Couldn't update ${ticket.ticketRef}: ${errorMessage(e, 'please try again.')}`);
    } finally {
      setSaving((s) => {
        const next = new Set(s);
        next.delete(ticket.id);
        return next;
      });
    }
  };

  const agentName = (id: string): string => {
    if (id === 'unassigned') return 'Unassigned';
    const a = agents.find((x) => x.id === id);
    return a ? (a.id === myId ? `${a.name} (you)` : a.name) : 'Agent';
  };
  const describe = (f: Filters): { key: FilterKey; label: string }[] => {
    const out: { key: FilterKey; label: string }[] = [];
    if (f.status) out.push({ key: 'status', label: STATUS_LABEL[f.status] });
    if (f.priority) out.push({ key: 'priority', label: `${PRIORITY_LABEL[f.priority]} priority` });
    if (f.assignee) out.push({ key: 'assignee', label: agentName(f.assignee) });
    return out;
  };
  const applied = describe(filters);
  const hasAny = applied.length > 0 || !!search;

  const applyPanel = (v: Record<string, string>) => {
    setFilters({
      status: (TICKET_STATUSES as readonly string[]).includes(v.status) ? (v.status as TicketStatus) : '',
      priority: (TICKET_PRIORITIES as readonly string[]).includes(v.priority) ? (v.priority as TicketPriority) : '',
      assignee: v.assignee ?? '',
    });
    setPage(1);
  };
  const filterFields: FilterField[] = [
    { key: 'status', label: 'Status', options: [{ value: '', label: 'All statuses' }, ...TICKET_STATUSES.map((v) => ({ value: v, label: STATUS_LABEL[v] }))] },
    { key: 'priority', label: 'Priority', options: [{ value: '', label: 'All priorities' }, ...TICKET_PRIORITIES.map((v) => ({ value: v, label: PRIORITY_LABEL[v] }))] },
    {
      key: 'assignee',
      label: 'Assignee',
      options: [
        { value: '', label: 'All assignees' },
        { value: 'unassigned', label: 'Unassigned' },
        ...agents.map((a) => ({ value: a.id, label: a.id === myId ? `${a.name} (you)` : a.name })),
      ],
    },
  ];
  const removeFilter = (key: FilterKey) => {
    setFilters((f) => ({ ...f, [key]: '' }));
    setPage(1);
  };
  const clearAll = () => {
    setFilters(EMPTY);
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const items = data?.items ?? [];
  const meta = data?.meta;

  return (
    <div className="admin-page-container sup-page">
      <HelpTabs />

      <header className="sup-head">
        <h1 className="sup-head__title">Support</h1>
        <p className="sup-head__desc">Tickets from customers and partners, with SLA and ownership.</p>
      </header>

      <div className="sup-toolbar">
        <label className="sup-search">
          <Search size={16} aria-hidden />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search ticket, subject, customer or booking"
            spellCheck={false}
            aria-label="Search tickets"
          />
          {searchInput && (
            <button type="button" className="sup-search__clear" onClick={() => setSearchInput('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </label>

        <FilterButton count={applied.length} open={panelOpen} onClick={() => setPanelOpen((o) => !o)} />
      </div>

      <FilterPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        fields={filterFields}
        values={{ status: filters.status, priority: filters.priority, assignee: filters.assignee }}
        onApply={applyPanel}
      />

      {hasAny && (
        <div className="sup-applied" aria-label="Applied filters">
          {applied.map((a) => (
            <span key={a.key} className="sup-tag">
              {a.label}
              <button type="button" onClick={() => removeFilter(a.key)} aria-label={`Remove ${a.label}`}><X size={12} /></button>
            </span>
          ))}
          <button type="button" className="sup-linkbtn" onClick={clearAll}>Clear all</button>
        </div>
      )}

      {agentsFailed && (
        <p className="sup-banner" role="status">Couldn't load the agent list, so assigning is unavailable until you refresh.</p>
      )}
      {notice && (
        <div className="sup-banner sup-banner--error" role="alert">
          <span>{notice}</span>
          <button type="button" className="sup-iconbtn" onClick={() => setNotice(null)} aria-label="Dismiss"><X size={14} /></button>
        </div>
      )}

      <section className="sup-card" aria-busy={loading}>
        {error ? (
          <div className="sup-state sup-state--error" role="alert">
            <AlertCircle size={22} />
            <p>{error}</p>
            <button type="button" className="sup-btn" onClick={() => setTick((t) => t + 1)}>Try again</button>
          </div>
        ) : (
          <>
            <div
              className="sup-scroll"
              ref={scrollRef}
              onPointerDown={onScrollPointerDown}
              onPointerMove={onScrollPointerMove}
              onPointerUp={endScrollDrag}
              onPointerLeave={endScrollDrag}
              onPointerCancel={endScrollDrag}
            >
              <table className="sup-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Requester</th>
                    <th>Booking</th>
                    <th>Subject</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Assignee</th>
                    <th>SLA</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !data
                    ? Array.from({ length: 6 }, (_, i) => (
                        <tr key={i} className="sup-skeleton">
                          {Array.from({ length: 9 }, (_, j) => <td key={j}><span /></td>)}
                        </tr>
                      ))
                    : items.map((t) => (
                        <tr
                          key={t.id}
                          className={`sup-row sup-row--${t.priority.toLowerCase()}`}
                          tabIndex={0}
                          aria-label={`Open ${t.ticketRef}: ${t.subject}`}
                          onClick={() => openTicket(t.id)}
                          onKeyDown={(e) => {
                            // Only when the row itself has focus, so typing in the assignee select is untouched.
                            if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              openTicket(t.id);
                            }
                          }}
                        >
                          <td>
                            {/* A real link too: middle-click / Ctrl+click opens the ticket in a new tab. */}
                            <Link to={`/admin/support/${t.id}`} className="sup-reflink" onClick={(e) => e.stopPropagation()}>
                              <code className="sup-mono sup-strong">{t.ticketRef}</code>
                            </Link>
                          </td>
                          <td>
                            <div className="sup-person">
                              <span className="sup-avatar" aria-hidden>{initials(t.requester?.name)}</span>
                              <div>
                                <span className="sup-person__name">{t.requester?.name || <span className="sup-muted">Unknown</span>}</span>
                                {t.requester && <span className="sup-sub">{t.requester.type === 'partner' ? 'Partner' : 'Customer'}</span>}
                              </div>
                            </div>
                          </td>
                          <td>{t.bookingRef ? <code className="sup-mono">{t.bookingRef}</code> : <span className="sup-muted">—</span>}</td>
                          <td className="sup-subject" title={t.subject}>{t.subject}</td>
                          <td><span className={`sup-pill sup-pill--${t.priority.toLowerCase()}`}>{PRIORITY_LABEL[t.priority]}</span></td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <StatusSelect
                              value={t.status}
                              saving={saving.has(t.id)}
                              label={`Status for ${t.ticketRef}`}
                              onChange={(st) => void onStatusChange(t, st)}
                            />
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <AssigneeSelect
                              value={t.assignee}
                              agents={agents}
                              saving={saving.has(t.id)}
                              disabled={agentsFailed}
                              label={`Assignee for ${t.ticketRef}`}
                              onChange={(id) => void onAssign(t, id)}
                            />
                          </td>
                          <td><SlaBadge ticket={t} now={now} /></td>
                          <td className="sup-nowrap">{formatDateTime(t.createdAt)}</td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {!loading && items.length === 0 && (
              <div className="sup-state">
                <p className="sup-state__title">{hasAny ? 'No tickets match these filters' : 'No tickets yet'}</p>
                <p className="sup-muted">{hasAny ? 'Try clearing a filter.' : 'Tickets appear here when customers or partners reach out.'}</p>
                {hasAny && <button type="button" className="sup-btn" onClick={clearAll}>Clear filters</button>}
              </div>
            )}
          </>
        )}

        {meta && meta.total > 0 && (
          <footer className="sup-pager">
            <span className="sup-muted">
              Showing {(meta.page - 1) * meta.limit + 1}–{Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
            </span>
            <div className="sup-pager__btns">
              <button type="button" className="sup-btn" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft size={15} /> Prev
              </button>
              <span className="sup-muted">{meta.page} / {meta.pages}</span>
              <button type="button" className="sup-btn" disabled={page >= meta.pages || loading} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight size={15} />
              </button>
            </div>
          </footer>
        )}
      </section>
    </div>
  );
};

export default AdminSupportPage;