import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, Info, RefreshCw, Wifi, WifiOff, X } from "lucide-react";
import clsx from "clsx";

import { NO_SCROLLBAR } from "@/components/customer/noScrollbar";

import {
  getErrorMessage,
  getErrorStatus,
} from "@/components/tickets/getErrorMessage";
import { formatDate, timeAgo } from "@/components/tickets/formatTime";
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge";
import TicketThread from "@/components/tickets/TicketThread";
import {
  STATUS_LABELS,
  TICKET_STATUSES,
  categoryLabel,
  shortTicketId,
  type Ticket,
  type TicketMessage,
} from "@/components/tickets/ticket.types";
import { getTicket, replyToTicket } from "@/pages/partner/Support/support.api";
import { useOnlineStatus } from "@/pages/partner/Support/useOnlineStatus";

import { usePartnerTicketLive } from "./usePartnerTicketLive";

/** How often the thread refreshes itself while the live connection is down. */
const POLL_MS = 15_000;

/** Union by id, oldest first. A message that arrives live AND in a refetch (or our own reply echoed back) shows once. */
function mergeMessages(a: TicketMessage[], b: TicketMessage[]): TicketMessage[] {
  const byId = new Map<string, TicketMessage>();
  for (const m of [...a, ...b]) byId.set(m.id, m);
  return [...byId.values()].sort(
    (x, y) => new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime(),
  );
}

/** Where the ticket is on its way from raised to closed (vertical, for the desktop side panel and the sheet). */
function ProgressSteps({ status }: { status: Ticket["status"] }) {
  const current = TICKET_STATUSES.indexOf(status);
  return (
    <ol aria-label="Ticket progress" className="flex flex-col">
      {TICKET_STATUSES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === TICKET_STATUSES.length - 1;
        return (
          <li key={s} aria-current={active ? "step" : undefined} className="relative flex gap-3 pb-5 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 ${done ? "bg-indigo-600" : "bg-slate-200"}`}
              />
            )}
            <span
              className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                done
                  ? "border-indigo-600 bg-indigo-600 text-white"
                  : active
                    ? "border-indigo-600 bg-white text-indigo-600 ring-4 ring-indigo-100"
                    : "border-slate-200 bg-white text-slate-400"
              }`}
            >
              {done ? <Check size={14} strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span
              className={`pt-1 text-sm ${active ? "font-semibold text-slate-900" : done ? "text-slate-800" : "text-slate-400"}`}
            >
              {STATUS_LABELS[s]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Thin 4-part bar for the mobile header. */
function MiniProgress({ status }: { status: Ticket["status"] }) {
  const current = TICKET_STATUSES.indexOf(status);
  return (
    <div role="img" aria-label={`Progress: ${STATUS_LABELS[status]}`} className="flex gap-1.5">
      {TICKET_STATUSES.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 flex-1 rounded-full ${i <= current ? "bg-indigo-600" : "bg-slate-200"}`}
        />
      ))}
    </div>
  );
}

function DetailsList({ ticket }: { ticket: Ticket }) {
  const row = "flex flex-col gap-0.5 rounded-xl bg-slate-50 px-3.5 py-2.5";
  return (
    <dl className="flex flex-col gap-2 text-sm">
      <div className={row}>
        <dt className="text-xs text-slate-500">Category</dt>
        <dd className="font-medium text-slate-900">{categoryLabel(ticket.category)}</dd>
      </div>
      <div className={row}>
        <dt className="text-xs text-slate-500">Booking</dt>
        <dd className="break-all font-medium text-slate-900">
          {ticket.bookingId ? shortTicketId(ticket.bookingId) : "Not linked to a booking"}
        </dd>
      </div>
      <div className={row}>
        <dt className="text-xs text-slate-500">Opened</dt>
        <dd className="font-medium text-slate-900">{formatDate(ticket.createdAt)}</dd>
      </div>
      <div className={row}>
        <dt className="text-xs text-slate-500">Last activity</dt>
        <dd className="font-medium text-slate-900">{timeAgo(ticket.lastMessageAt)}</dd>
      </div>
    </dl>
  );
}

export default function SupportTicketPage() {
  const { id } = useParams<{ id: string }>();
  const online = useOnlineStatus();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  /** `silent` refreshes in the background (reconnect, polling): no spinner, and a failure keeps what is on screen. */
  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!id) return;
      const silent = opts?.silent === true;
      if (!silent) {
        setLoading(true);
        setError(null);
        setNotFound(false);
      }
      try {
        const detail = await getTicket(id);
        setTicket(detail.ticket);
        setMessages((cur) => (silent ? mergeMessages(cur, detail.messages) : detail.messages));
      } catch (err) {
        if (silent) return;
        const status = getErrorStatus(err);
        // Another partner's ticket (403/404) looks the same as a missing one
        if (status === 404 || status === 403) setNotFound(true);
        else setError(getErrorMessage(err, "Could not load this ticket."));
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  // Live: a new reply (from support, or from this partner on another device) and status changes.
  const { connected } = usePartnerTicketLive(id, {
    onMessage: (m) => {
      setMessages((cur) => mergeMessages(cur, [m]));
      setTicket((t) => (t ? { ...t, lastMessageAt: m.createdAt } : t));
    },
    // Closing a ticket locks the reply box straight away.
    onStatus: (u) => setTicket((t) => (t ? { ...t, status: u.status } : t)),
  });

  // Rooms and events are lost while disconnected: catch up once the socket is back.
  const wasConnected = useRef(connected);
  useEffect(() => {
    if (connected && !wasConnected.current) void load({ silent: true });
    wasConnected.current = connected;
  }, [connected, load]);

  // Fallback: no live connection (but the browser is online) -> refresh every 15 s.
  const hasTicket = ticket !== null;
  useEffect(() => {
    if (connected || !online || !hasTicket) return;
    const timer = window.setInterval(() => void load({ silent: true }), POLL_MS);
    return () => window.clearInterval(timer);
  }, [connected, online, hasTicket, load]);

  // Coming back online: refresh now instead of waiting for the next poll.
  const wasOnline = useRef(online);
  useEffect(() => {
    if (online && !wasOnline.current && hasTicket) void load({ silent: true });
    wasOnline.current = online;
  }, [online, hasTicket, load]);

  const send = async (body: string, files: File[]) => {
    if (!id) return;
    try {
      const message = await replyToTicket(id, body, files);
      setMessages((cur) => mergeMessages(cur, [message]));
      setTicket((t) => (t ? { ...t, lastMessageAt: message.createdAt } : t));
    } catch (err) {
      // 409: the ticket was closed while the partner was typing. Refresh so the reply box locks.
      if (getErrorStatus(err) === 409) void load({ silent: true });
      throw err;
    }
  };

  const [detailsOpen, setDetailsOpen] = useState(false);

  // Esc closes the mobile details sheet
  useEffect(() => {
    if (!detailsOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDetailsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailsOpen]);

  const lightBtn =
    "shrink-0 rounded-xl border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50";
  const glassBtn =
    "shrink-0 rounded-full border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50";

  return (
    // Fills the main area: the page itself never scrolls (the message list scrolls inside, scrollbar hidden).
    <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-slate-50">
      {!online && (
        <div role="status" className="flex shrink-0 items-center gap-2 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 sm:px-6">
          <WifiOff size={16} aria-hidden />
          You're offline. Replies can't be sent until you reconnect.
        </div>
      )}

      {online && !connected && ticket && (
        <div role="status" className="flex shrink-0 items-center gap-2 bg-slate-100 px-4 py-2 text-xs text-slate-600 sm:px-6 sm:text-sm">
          <RefreshCw size={14} className="animate-spin" aria-hidden />
          Live updates paused. Reconnecting… refreshing every 15 seconds meanwhile.
        </div>
      )}

      {loading && !ticket && (
        <div aria-busy="true" aria-label="Loading ticket" className="flex flex-1 flex-col gap-3 p-4 sm:p-6">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="h-16 w-2/3 animate-pulse rounded-2xl bg-slate-200/70" />
          <div className="ml-auto h-16 w-2/3 animate-pulse rounded-2xl bg-slate-200/70" />
        </div>
      )}

      {notFound && !loading && (
        <div role="alert" className="m-auto max-w-sm rounded-2xl bg-white p-10 text-center shadow-sm ring-1 ring-slate-200">
          <p className="font-semibold text-slate-900">Ticket not found</p>
          <p className="mt-1 text-sm text-slate-500">It may have been removed, or it doesn't belong to your account.</p>
          <Link
            to="/partner/support"
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Back to your tickets
          </Link>
        </div>
      )}

      {error && !loading && (
        <div role="alert" className="m-auto max-w-sm rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={() => void load()}
            className="mt-3 rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            Try again
          </button>
        </div>
      )}

      {ticket && (
        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {/* ===== Desktop header, flush with the navbar ===== */}
            <header className="hidden shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-8 py-4 lg:flex">
              <Link to="/partner/support" aria-label="Back to all tickets" className={lightBtn}>
                <ArrowLeft size={18} aria-hidden />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-500">
                    {shortTicketId(ticket.id)}
                  </span>
                  <TicketStatusBadge status={ticket.status} />
                  {connected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      <Wifi size={12} aria-hidden />
                      Live
                    </span>
                  )}
                </div>
                <h2 className="mt-1.5 truncate text-xl font-bold tracking-tight text-slate-900" title={ticket.subject}>
                  {ticket.subject}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                aria-label="Refresh conversation"
                className={lightBtn}
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
              </button>
            </header>

            {/* ===== Mobile header: owns the top of the screen ===== */}
            <header className="shrink-0 border-b border-slate-200 bg-white px-3 pb-3 pt-3 text-slate-900 lg:hidden">
              <div className="flex items-center gap-2">
                <Link to="/partner/support" aria-label="Back to all tickets" className={glassBtn}>
                  <ArrowLeft size={18} aria-hidden />
                </Link>
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-base font-semibold leading-tight" title={ticket.subject}>
                    {ticket.subject}
                  </h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="tabular-nums">{shortTicketId(ticket.id)}</span>
                    <span aria-hidden>·</span>
                    <span>{STATUS_LABELS[ticket.status]}</span>
                    {connected && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                          Live
                        </span>
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  aria-label="Refresh conversation"
                  className={glassBtn}
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  aria-label="Ticket details"
                  aria-haspopup="dialog"
                  className={glassBtn}
                >
                  <Info size={18} aria-hidden />
                </button>
              </div>
              <div className="mt-3">
                <MiniProgress status={ticket.status} />
              </div>
            </header>

            <div className="min-h-0 flex-1">
              <TicketThread
                fill
                messages={messages}
                viewerRole="partner"
                closed={ticket.status === "closed"}
                disabled={!online}
                onSend={send}
              />
            </div>
          </div>

          {/* ===== Desktop side panel ===== */}
          <aside
            aria-label="Ticket details"
            className={clsx("hidden w-80 shrink-0 overflow-y-auto border-l border-slate-200 bg-white lg:block", NO_SCROLLBAR)}
          >
            <div className="border-b border-slate-200 bg-white px-6 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Status</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{STATUS_LABELS[ticket.status]}</p>
              <p className="mt-0.5 text-xs text-slate-500">Updated {timeAgo(ticket.lastMessageAt)}</p>
            </div>
            <div className="p-6">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Progress</h3>
              <div className="mt-4">
                <ProgressSteps status={ticket.status} />
              </div>
              <h3 className="mt-8 text-xs font-semibold uppercase tracking-wider text-slate-400">Details</h3>
              <div className="mt-3">
                <DetailsList ticket={ticket} />
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ===== Mobile details sheet ===== */}
      {ticket && detailsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetailsOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ticket details"
            className={clsx(
              "max-h-[85dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
              NO_SCROLLBAR,
            )}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Ticket details</h3>
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                aria-label="Close details"
                className={lightBtn}
              >
                <X size={18} aria-hidden />
              </button>
            </div>
            <ProgressSteps status={ticket.status} />
            <div className="mt-6">
              <DetailsList ticket={ticket} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}