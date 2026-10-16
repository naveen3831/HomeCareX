import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LifeBuoy, Plus, RefreshCw, WifiOff, ChevronRight } from "lucide-react";

import { getErrorMessage } from "@/components/tickets/getErrorMessage";
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge";
import {
  categoryLabel,
  shortTicketId,
  type Ticket,
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

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

  const visible = useMemo(() => {
    const list = tickets ?? [];
    if (filter === "closed") return list.filter((t) => t.status === "closed");
    if (filter === "active") return list.filter((t) => t.status !== "closed");
    return list;
  }, [tickets, filter]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      {!online && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          <WifiOff size={16} aria-hidden />
          You're offline. Tickets can't be loaded or sent until you reconnect.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Filter tickets" className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] ${
                filter === f.key ? "bg-white text-[#4338ca] shadow-sm" : "text-slate-600"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh tickets"
            className="rounded-md border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
          </button>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#4338ca] px-4 py-2 text-sm font-medium text-white hover:bg-[#3730a3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca]"
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

      {/* Loading */}
      {loading && !tickets && (
        <ul aria-busy="true" aria-label="Loading tickets" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-20 animate-pulse rounded-xl bg-slate-200/70" />
          ))}
        </ul>
      )}

      {/* Error */}
      {error && !loading && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={() => void load()}
            className="mt-2 rounded-md bg-red-600 px-3 py-1.5 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            Try again
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && tickets && visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <LifeBuoy size={32} className="text-slate-400" aria-hidden />
          <p className="font-medium text-slate-700">
            {tickets.length === 0 ? "No tickets yet" : "No tickets match this filter"}
          </p>
          <p className="text-sm text-slate-500">
            {tickets.length === 0
              ? "Raise a ticket and the support team will get back to you."
              : "Try a different filter."}
          </p>
        </div>
      )}

      {/* List */}
      {visible.length > 0 && (
        <ul className="flex flex-col gap-2">
          {visible.map((t) => (
            <li key={t.id}>
              <Link
                to={`/partner/support/${t.id}`}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-[#4338ca]/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-500">
                      {shortTicketId(t.id)}
                    </span>
                    <TicketStatusBadge status={t.status} />
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {categoryLabel(t.category)}
                    </span>
                  </div>
                  <p className="mt-1 truncate font-medium text-slate-900">{t.subject}</p>
                  <p className="text-xs text-slate-500">
                    Updated {formatDate(t.lastMessageAt)}
                  </p>
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
