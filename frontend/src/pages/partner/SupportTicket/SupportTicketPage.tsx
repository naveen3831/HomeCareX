import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, RefreshCw, WifiOff } from "lucide-react";

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

/** Where the ticket is on its way from raised to closed. */
function ProgressSteps({ status }: { status: Ticket["status"] }) {
  const current = TICKET_STATUSES.indexOf(status);
  return (
    <ol aria-label="Ticket progress" className="flex">
      {TICKET_STATUSES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const last = i === TICKET_STATUSES.length - 1;
        return (
          <li
            key={s}
            aria-current={active ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center gap-1.5"
          >
            {!last && (
              <span
                aria-hidden
                className={`absolute left-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 ${
                  done ? "bg-[#4338ca]" : "bg-slate-200"
                }`}
              />
            )}
            <span
              className={`relative flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                done
                  ? "border-[#4338ca] bg-[#4338ca] text-white"
                  : active
                    ? "border-[#4338ca] bg-white text-[#4338ca] ring-4 ring-indigo-100"
                    : "border-slate-300 bg-white text-slate-400"
              }`}
            >
              {done ? <Check size={14} strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span
              className={`text-center text-xs ${
                active ? "font-semibold text-slate-900" : done ? "text-slate-600" : "text-slate-400"
              }`}
            >
              {STATUS_LABELS[s]}
            </span>
          </li>
        );
      })}
    </ol>
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

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const detail = await getTicket(id);
      setTicket(detail.ticket);
      setMessages(detail.messages);
    } catch (err) {
      const status = getErrorStatus(err);
      // Another partner's ticket (403/404) looks the same as a missing one
      if (status === 404 || status === 403) setNotFound(true);
      else setError(getErrorMessage(err, "Could not load this ticket."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async (body: string, files: File[]) => {
    if (!id) return;
    const message = await replyToTicket(id, body, files);
    setMessages((cur) => [...cur, message]);
    setTicket((t) => (t ? { ...t, lastMessageAt: message.createdAt } : t));
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 p-4 sm:p-6">
      <Link
        to="/partner/support"
        className="inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-slate-600 hover:text-[#4338ca] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca]"
      >
        <ArrowLeft size={16} aria-hidden />
        All tickets
      </Link>

      {!online && (
        <div role="status" className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <WifiOff size={16} aria-hidden />
          You're offline. Replies can't be sent until you reconnect.
        </div>
      )}

      {loading && !ticket && (
        <div aria-busy="true" aria-label="Loading ticket" className="flex flex-col gap-3">
          <div className="h-36 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="h-16 w-2/3 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="ml-auto h-16 w-2/3 animate-pulse rounded-xl bg-slate-200/70" />
        </div>
      )}

      {notFound && !loading && (
        <div role="alert" className="rounded-xl border border-slate-200 bg-white p-10 text-center">
          <p className="font-semibold text-slate-800">Ticket not found</p>
          <p className="mt-1 text-sm text-slate-500">
            It may have been removed, or it doesn't belong to your account.
          </p>
          <Link
            to="/partner/support"
            className="mt-4 inline-block rounded-lg bg-[#4338ca] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3730a3]"
          >
            Back to your tickets
          </Link>
        </div>
      )}

      {error && !loading && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={() => void load()}
            className="mt-3 rounded-md bg-red-600 px-3 py-1.5 font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
          >
            Try again
          </button>
        </div>
      )}

      {ticket && (
        <>
          <header className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium tabular-nums text-slate-600">
                    {shortTicketId(ticket.id)}
                  </span>
                  <TicketStatusBadge status={ticket.status} />
                </div>
                <h2 className="mt-2 break-words text-2xl font-semibold tracking-tight text-slate-900">
                  {ticket.subject}
                </h2>
              </div>
              <button
                onClick={() => void load()}
                disabled={loading}
                aria-label="Refresh conversation"
                className="shrink-0 rounded-lg border border-slate-300 p-2.5 text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca] disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
              </button>
            </div>

            <div className="mt-6 max-w-xl">
              <ProgressSteps status={ticket.status} />
            </div>
          </header>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_17rem]">
            <div className="min-w-0">
              <TicketThread
                messages={messages}
                viewerRole="partner"
                closed={ticket.status === "closed"}
                disabled={!online}
                onSend={send}
              />
            </div>

            <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 lg:sticky lg:top-6">
              <h3 className="text-sm font-semibold text-slate-900">Details</h3>
              <dl className="mt-4 flex flex-col gap-4 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Category</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{categoryLabel(ticket.category)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Booking</dt>
                  <dd className="mt-0.5 break-all font-medium text-slate-800">
                    {ticket.bookingId ? shortTicketId(ticket.bookingId) : "Not linked to a booking"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Opened</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{formatDate(ticket.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Last activity</dt>
                  <dd className="mt-0.5 font-medium text-slate-800">{timeAgo(ticket.lastMessageAt)}</dd>
                </div>
              </dl>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}