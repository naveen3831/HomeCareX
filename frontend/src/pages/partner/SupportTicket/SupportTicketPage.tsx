import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw, WifiOff } from "lucide-react";

import {
  getErrorMessage,
  getErrorStatus,
} from "@/components/tickets/getErrorMessage";
import TicketStatusBadge from "@/components/tickets/TicketStatusBadge";
import TicketThread from "@/components/tickets/TicketThread";
import {
  categoryLabel,
  shortTicketId,
  type Ticket,
  type TicketMessage,
} from "@/components/tickets/ticket.types";
import { getTicket, replyToTicket } from "@/pages/partner/Support/support.api";
import { useOnlineStatus } from "@/pages/partner/Support/useOnlineStatus";

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
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        to="/partner/support"
        className="inline-flex items-center gap-1.5 rounded-md text-sm text-slate-600 hover:text-[#4338ca] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
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
          <div className="h-24 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="h-16 w-2/3 animate-pulse rounded-xl bg-slate-200/70" />
          <div className="ml-auto h-16 w-2/3 animate-pulse rounded-xl bg-slate-200/70" />
        </div>
      )}

      {notFound && !loading && (
        <div role="alert" className="rounded-xl border border-slate-200 bg-white p-8 text-center">
          <p className="font-medium text-slate-800">Ticket not found</p>
          <p className="mt-1 text-sm text-slate-500">
            It may have been removed, or it doesn't belong to your account.
          </p>
        </div>
      )}

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

      {ticket && (
        <>
          <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-slate-500">
                  Ticket {shortTicketId(ticket.id)}
                </span>
                <TicketStatusBadge status={ticket.status} />
              </div>
              <button
                onClick={() => void load()}
                disabled={loading}
                aria-label="Refresh conversation"
                className="rounded-md border border-slate-300 p-2 text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca] disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? "animate-spin" : ""} aria-hidden />
              </button>
            </div>

            <h2 className="mt-2 break-words text-lg font-semibold text-slate-900">
              {ticket.subject}
            </h2>

            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-slate-500">Category</dt>
                <dd className="font-medium text-slate-800">{categoryLabel(ticket.category)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Booking</dt>
                <dd className="break-all font-medium text-slate-800">
                  {ticket.bookingId ? shortTicketId(ticket.bookingId) : "None"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Opened</dt>
                <dd className="font-medium text-slate-800">
                  {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </header>

          <TicketThread
            messages={messages}
            viewerRole="partner"
            closed={ticket.status === "closed"}
            disabled={!online}
            onSend={send}
          />
        </>
      )}
    </div>
  );
}
