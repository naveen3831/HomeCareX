import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ChevronRight,
  CircleHelp,
  Inbox,
  Plus,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import clsx from "clsx";

import { NO_SCROLLBAR } from "@/components/customer/noScrollbar";
import { getErrorMessage } from "@/components/tickets/getErrorMessage";
import { timeAgo } from "@/components/tickets/formatTime";
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge";
import {
  categoryLabel,
  shortTicketId,
  type Ticket,
  type TicketStatus,
} from "@/components/tickets/ticket.types";
import NewTicketForm from "./NewTicketForm";
import { listTickets } from "./support.api";
import { useOnlineStatus } from "./useOnlineStatus";

type Filter = "all" | "active" | "closed";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "closed", label: "Closed" },
];

/** Accent colour of each ticket, by status. */
const ACCENT: Record<TicketStatus, string> = {
  open: "bg-indigo-500",
  in_progress: "bg-amber-500",
  resolved: "bg-emerald-500",
  closed: "bg-slate-300",
};

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function HelpButton({ className }: { className?: string }) {
  return (
    <Link
      to="/partner/help"
      className={clsx(
        "inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
        className,
      )}
    >
      <CircleHelp size={16} aria-hidden />
      Help
    </Link>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-[5.5rem] rounded-2xl bg-slate-50 px-4 py-2.5 ring-1 ring-inset ring-slate-200">
      <p className="text-2xl font-bold leading-none tabular-nums text-slate-900">{value}</p>
      <p className="mt-1 text-xs font-medium text-slate-500">{label}</p>
    </div>
  );
}

function EmptyState({
  noTickets,
  onNew,
}: {
  noTickets: boolean;
  onNew: () => void;
}) {
  return (
    <div className="m-auto flex max-w-sm flex-col items-center gap-4 px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
        <Inbox size={28} aria-hidden />
      </span>
      <div>
        <p className="text-lg font-semibold text-slate-900">
          {noTickets ? "No tickets yet" : "Nothing in this tab"}
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {noTickets
            ? "When something goes wrong, raise a ticket and we'll pick it up."
            : "Switch tabs to see your other tickets."}
        </p>
      </div>
      {noTickets && (
        <button
          onClick={onNew}
          className={clsx(
            "inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700",
            focus,
          )}
        >
          <Plus size={16} aria-hidden />
          Raise a ticket
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SupportPage() {
  const navigate = useNavigate();
  const online = useOnlineStatus();

  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTickets(await listTickets());
    } catch (err) {
      setError(getErrorMessage(err, "Could not load your tickets."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Retry automatically when the connection comes back
  useEffect(() => {
    if (online && error) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  // Esc closes the new-ticket window
  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowForm(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showForm]);

  const counts = useMemo(() => {
    const list = tickets ?? [];
    const closed = list.filter((t) => t.status === "closed").length;
    return { all: list.length, active: list.length - closed, closed };
  }, [tickets]);

  const visible = useMemo(() => {
    const list = tickets ?? [];
    if (filter === "closed") return list.filter((t) => t.status === "closed");
    if (filter === "active") return list.filter((t) => t.status !== "closed");
    return list;
  }, [tickets, filter]);

  const showSkeleton = loading && !tickets;
  const showEmpty = !loading && !error && !!tickets && visible.length === 0;

  const body = (
    <>
      {showSkeleton && (
        <ul aria-busy="true" aria-label="Loading tickets" className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </ul>
      )}

      {error && !loading && (
        <div
          role="alert"
          className="m-auto max-w-sm rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700"
        >
          <p>{error}</p>
          <button
            onClick={() => void load()}
            className="mt-3 rounded-lg bg-red-600 px-4 py-2 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            Try again
          </button>
        </div>
      )}

      {showEmpty && (
        <EmptyState noTickets={tickets!.length === 0} onNew={() => setShowForm(true)} />
      )}
    </>
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-slate-50">
      {/* ================= DESKTOP ================= */}
      <div className="hidden min-h-0 flex-1 flex-col lg:flex">
        {/* Hero band, flush with the navbar */}
        <section className="shrink-0 border-b border-slate-200 bg-white px-8 py-6">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
                Partner support
              </p>
              <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                Your tickets
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Raise an issue and follow it until the team resolves it.
              </p>

              {/* Counts sit directly under the title */}
              <div className="mt-4 flex items-center gap-3">
                <Stat label="Active" value={counts.active} />
                <Stat label="Closed" value={counts.closed} />
                <Stat label="Total" value={counts.all} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => void load()}
                disabled={loading}
                aria-label="Refresh tickets"
                className="rounded-xl border border-slate-300 bg-white p-2.5 text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
              </button>
              <HelpButton />
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <Plus size={16} aria-hidden />
                New ticket
              </button>
            </div>
          </div>
        </section>

        {!online && (
          <div
            role="status"
            className="flex shrink-0 items-center gap-2 bg-amber-50 px-8 py-2.5 text-sm text-amber-800"
          >
            <WifiOff size={16} aria-hidden />
            You're offline. Tickets can't be loaded or sent until you reconnect.
          </div>
        )}

        {/* Filter pills */}
        <div
          role="tablist"
          aria-label="Filter tickets"
          className="flex shrink-0 items-center gap-2 px-8 pb-2 pt-5"
        >
          {FILTERS.map((f) => {
            const selected = filter === f.key;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(f.key)}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                  focus,
                  selected
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-indigo-50 hover:text-indigo-700",
                )}
              >
                {f.label}
                <span
                  className={clsx(
                    "min-w-[1.4rem] rounded-full px-1.5 text-center text-xs tabular-nums",
                    selected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500",
                  )}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* List: scrolls inside, scrollbar hidden */}
        <div className={clsx("flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pb-6", NO_SCROLLBAR)}>
          {body}

          {visible.length > 0 && (
            <>
              <div
                aria-hidden
                className="grid grid-cols-[minmax(0,1fr)_8rem_8rem_9rem_1.5rem] gap-4 px-5 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
              >
                <span>Ticket</span>
                <span>Category</span>
                <span>Status</span>
                <span className="text-right">Last activity</span>
                <span />
              </div>
              <ul className="flex flex-col gap-2.5">
                {visible.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/partner/support/${t.id}`}
                      className={clsx(
                        "group relative grid grid-cols-[minmax(0,1fr)_8rem_8rem_9rem_1.5rem] items-center gap-4 overflow-hidden rounded-2xl bg-white px-5 py-4 shadow-sm ring-1 ring-slate-200 transition-all hover:-translate-y-px hover:shadow-md hover:ring-indigo-300",
                        focus,
                      )}
                    >
                      <span
                        aria-hidden
                        className={clsx("absolute inset-y-0 left-0 w-1.5", ACCENT[t.status])}
                      />
                      <div className="min-w-0 pl-1">
                        <p className="truncate text-[15px] font-semibold text-slate-900">
                          {t.subject}
                        </p>
                        <p className="mt-0.5 text-xs tabular-nums text-slate-400">
                          {shortTicketId(t.id)}
                        </p>
                      </div>
                      <span className="truncate text-sm text-slate-600">
                        {categoryLabel(t.category)}
                      </span>
                      <span>
                        <TicketStatusBadge status={t.status} />
                      </span>
                      <span className="text-right text-sm font-medium text-slate-700">
                        {timeAgo(t.lastMessageAt)}
                      </span>
                      <ChevronRight
                        size={18}
                        aria-hidden
                        className="text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-600"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* ================= MOBILE ================= */}
      <div className="flex min-h-0 flex-1 flex-col lg:hidden">
        <section className="shrink-0 border-b border-slate-200 bg-white px-4 pb-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">Your tickets</h2>
              <p className="text-xs text-slate-500">
                {counts.active} active · {counts.closed} closed
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void load()}
                disabled={loading}
                aria-label="Refresh tickets"
                className="rounded-full border border-slate-300 bg-white p-2.5 text-slate-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
              </button>
              <HelpButton className="rounded-full px-3.5 py-2" />
            </div>
          </div>

          {/* Segmented control */}
          <div
            role="tablist"
            aria-label="Filter tickets"
            className="mt-4 grid grid-cols-3 rounded-2xl bg-slate-100 p-1"
          >
            {FILTERS.map((f) => {
              const selected = filter === f.key;
              return (
                <button
                  key={f.key}
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(f.key)}
                  className={clsx(
                    "flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600",
                    selected ? "bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500",
                  )}
                >
                  {f.label}
                  <span className="text-xs tabular-nums opacity-70">{counts[f.key]}</span>
                </button>
              );
            })}
          </div>
        </section>

        {!online && (
          <div
            role="status"
            className="flex shrink-0 items-center gap-2 bg-amber-50 px-4 py-2 text-xs text-amber-800"
          >
            <WifiOff size={14} aria-hidden />
            You're offline. Tickets can't be loaded or sent.
          </div>
        )}

        <div className={clsx("flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-28 pt-4", NO_SCROLLBAR)}>
          {body}

          {visible.length > 0 && (
            <ul className="flex flex-col gap-3">
              {visible.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/partner/support/${t.id}`}
                    className={clsx(
                      "flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:scale-[0.99]",
                      focus,
                    )}
                  >
                    <span
                      aria-hidden
                      className={clsx("h-11 w-1.5 shrink-0 rounded-full", ACCENT[t.status])}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-slate-900">
                        {t.subject}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {categoryLabel(t.category)} · {shortTicketId(t.id)}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <TicketStatusBadge status={t.status} />
                        <span className="text-xs text-slate-400">{timeAgo(t.lastMessageAt)}</span>
                      </div>
                    </div>
                    <ChevronRight size={18} aria-hidden className="shrink-0 text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Floating new-ticket button, sits above the bottom bar */}
        <button
          onClick={() => setShowForm(true)}
          aria-label="New ticket"
          className="absolute bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-4 z-10 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-xl shadow-indigo-600/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 active:scale-95"
        >
          <Plus size={26} aria-hidden />
        </button>
      </div>

      {/* ================= NEW TICKET (dialog on desktop, bottom sheet on mobile) ================= */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm lg:items-center lg:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowForm(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Raise a ticket"
            className={clsx(
              "max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white lg:max-w-2xl lg:rounded-2xl",
              NO_SCROLLBAR,
            )}
          >
            <NewTicketForm
              disabled={!online}
              onCancel={() => setShowForm(false)}
              onCreated={(t) => {
                setShowForm(false);
                navigate(`/partner/support/${t.id}`);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}