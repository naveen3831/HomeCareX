import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  BookOpen,
  Check,
  ChevronRight,
  LifeBuoy,
  Plus,
  RefreshCw,
  WifiOff,
} from "lucide-react";

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

/** Colour of the rail on the left edge of each ticket row. */
const RAIL: Record<TicketStatus, string> = {
  open: "bg-indigo-500",
  in_progress: "bg-amber-500",
  resolved: "bg-emerald-500",
  closed: "bg-slate-300",
};

const TIPS = [
  "Pick the category closest to your problem.",
  "Add the booking ID if it's about a job.",
  "Say what happened and what you expected.",
];

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

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
      {/* ───────── Main column ───────── */}
      <div className="flex min-w-0 flex-col gap-5">
        {!online && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            <WifiOff size={16} aria-hidden />
            You're offline. Tickets can't be loaded or sent until you reconnect.
          </div>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Your tickets
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Raise an issue and follow it until the team resolves it.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh tickets"
              className="rounded-lg border border-slate-300 bg-white p-2.5 text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca] disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
            </button>
            {!showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#4338ca] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3730a3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca]"
              >
                <Plus size={16} aria-hidden />
                New ticket
              </button>
            )}
          </div>
        </div>

        {showForm && (
          <NewTicketForm
            disabled={!online}
            onCancel={() => setShowForm(false)}
            onCreated={(t) => {
              setShowForm(false);
              navigate(`/partner/support/${t.id}`);
            }}
          />
        )}

        {/* Tabs with counts */}
        <div
          role="tablist"
          aria-label="Filter tickets"
          className="flex gap-6 border-b border-slate-200"
        >
          {FILTERS.map((f) => {
            const selected = filter === f.key;
            return (
              <button
                key={f.key}
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(f.key)}
                className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#4338ca] ${
                  selected
                    ? "border-[#4338ca] text-[#4338ca]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {f.label}
                <span
                  className={`min-w-[1.5rem] rounded-full px-1.5 py-0.5 text-center text-xs tabular-nums ${
                    selected ? "bg-indigo-100 text-[#4338ca]" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {loading && !tickets && (
          <ul aria-busy="true" aria-label="Loading tickets" className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-[4.5rem] animate-pulse rounded-lg bg-slate-200/70" />
            ))}
          </ul>
        )}

        {/* Error */}
        {error && !loading && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button
              onClick={() => void load()}
              className="mt-3 rounded-md bg-red-600 px-3 py-1.5 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && tickets && visible.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-[#4338ca]">
              <LifeBuoy size={24} aria-hidden />
            </span>
            <div>
              <p className="font-semibold text-slate-800">
                {tickets.length === 0 ? "No tickets yet" : "Nothing in this tab"}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {tickets.length === 0
                  ? "When something goes wrong, raise a ticket and we'll pick it up."
                  : "Switch tabs to see your other tickets."}
              </p>
            </div>
            {tickets.length === 0 && !showForm && (
              <button
                onClick={() => setShowForm(true)}
                className="mt-1 inline-flex items-center gap-2 rounded-lg bg-[#4338ca] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3730a3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca]"
              >
                <Plus size={16} aria-hidden />
                Raise a ticket
              </button>
            )}
          </div>
        )}

        {/* List */}
        {visible.length > 0 && (
          <ul className="flex flex-col gap-3">
            {visible.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/partner/support/${t.id}`}
                  className="group flex overflow-hidden rounded-lg border border-slate-200 bg-white transition-colors hover:border-indigo-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca]"
                >
                  <span aria-hidden className={`w-1.5 shrink-0 ${RAIL[t.status]}`} />
                  <div className="flex min-w-0 flex-1 items-center gap-4 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-slate-900">
                        {t.subject}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
                        <TicketStatusBadge status={t.status} />
                        <span>{categoryLabel(t.category)}</span>
                        <span aria-hidden className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="tabular-nums">{shortTicketId(t.id)}</span>
                      </div>
                    </div>
                    <div className="hidden shrink-0 text-right text-xs sm:block">
                      <p className="text-slate-400">Last activity</p>
                      <p className="mt-0.5 font-medium text-slate-700">{timeAgo(t.lastMessageAt)}</p>
                    </div>
                    <ChevronRight
                      size={18}
                      className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-[#4338ca]"
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ───────── Side column ───────── */}
      <aside className="flex flex-col gap-4 lg:pt-[4.25rem]">
        <section className="rounded-lg bg-[#312e81] p-5 text-indigo-50">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <BookOpen size={18} aria-hidden />
          </span>
          <h3 className="mt-3 text-base font-semibold text-white">Looking for a quick answer?</h3>
          <p className="mt-1 text-sm leading-relaxed text-indigo-200">
            Payouts, bookings and your account are covered in the help articles.
          </p>
          <Link
            to="/partner/help"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-[#312e81] hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Open help
            <ChevronRight size={16} aria-hidden />
          </Link>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-slate-900">Get a faster reply</h3>
          <ul className="mt-3 flex flex-col gap-2.5">
            {TIPS.map((tip) => (
              <li key={tip} className="flex gap-2.5 text-sm text-slate-600">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check size={12} strokeWidth={3} aria-hidden />
                </span>
                {tip}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}