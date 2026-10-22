import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTicket } from "@/hooks/useTicket";
import { useLiveTicketMessages } from "@/hooks/useLiveTicketMessages";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { supportApi } from "@/services/supportApi";
import {
  label,
  problem,
  ticketRef,
  type CustomerMessage,
} from "@/features/support/types";
import TicketMessage from "./TicketMessage";
import TicketReplyForm from "./TicketReplyForm";

export default function CustomerTicketThread({ id }: { id: string }) {
  const query = useTicket(id);
  const { live } = useLiveTicketMessages(id);
  const client = useQueryClient();
  const online = useOnlineStatus();
  const [earlier, setEarlier] = useState<CustomerMessage[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [olderError, setOlderError] = useState("");
  useEffect(() => {
    if (query.data)
      setEarlier((previous) =>
        Array.from(
          new Map(
            [...previous, ...query.data.messages].map((message) => [
              message.id,
              message,
            ]),
          ).values(),
        ),
      );
  }, [query.data]);
  if (!query.data)
    return (
      <div
        className="hcx-support-state"
        role={query.isError ? "alert" : "status"}
      >
        <h2>
          {!online
            ? "You’re offline"
            : query.isError
              ? "Could not open ticket"
              : "Loading conversation…"}
        </h2>
        <p>
          {!online
            ? "Reconnect to load this private conversation."
            : query.isError
              ? problem(query.error)
              : "Getting your latest messages."}
        </p>
        {online && query.isError && (
          <button type="button" onClick={() => void query.refetch()}>
            Try again
          </button>
        )}
      </div>
    );
  const { ticket } = query.data;
  const nextBefore = cursor === undefined ? query.data.nextBefore : cursor;
  const messages = Array.from(
    new Map(
      [...earlier, ...query.data.messages].map((m) => [m.id, m]),
    ).values(),
  ).sort((a, b) => a.id.localeCompare(b.id));
  return (
    <section>
      <Link to="/customer/support/tickets">← All tickets</Link>
      <header className="hcx-support-thread-head">
        <span className="hcx-support-eyebrow">{ticketRef(ticket.id)}</span>
        <h2>{ticket.subject}</h2>
        <div className="hcx-support-pills">
          <span
            className={`hcx-support-badge hcx-support-badge--${ticket.status}`}
          >
            {label(ticket.status)}
          </span>
          <span>{label(ticket.priority)} priority</span>
          <span>{label(ticket.category)}</span>
        </div>
        <p className="hcx-support-muted">Ticket ID: {ticket.id}</p>
        {ticket.bookingId && (
          <Link to={`/customer/bookings/${ticket.bookingId}`}>
            View related booking
          </Link>
        )}
      </header>
      <p className="hcx-support-muted">
        {live
          ? "Live: replies appear here as soon as they are sent."
          : "Replies refresh every few seconds while this page is open."}
      </p>
      {query.isError && (
        <p role="alert" className="hcx-support-error">
          Could not refresh the conversation.{" "}
          <button type="button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </p>
      )}
      {nextBefore && (
        <button
          type="button"
          disabled={loadingEarlier || !online}
          onClick={async () => {
            setLoadingEarlier(true);
            setOlderError("");
            try {
              const data = await supportApi.get(id, undefined, nextBefore);
              setEarlier((old) => [...data.messages, ...old]);
              setCursor(data.nextBefore);
            } catch (err) {
              setOlderError(problem(err));
            } finally {
              setLoadingEarlier(false);
            }
          }}
        >
          {loadingEarlier ? "Loading…" : "Load earlier messages"}
        </button>
      )}
      {olderError && (
        <p role="alert" className="hcx-support-error">
          {olderError}
        </p>
      )}
      {messages.length ? (
        <ol
          className="hcx-support-conversation"
          aria-label="Ticket conversation"
        >
          {messages.map((message) => (
            <TicketMessage key={message.id} message={message} />
          ))}
        </ol>
      ) : (
        <p className="hcx-support-state">No messages yet.</p>
      )}
      <TicketReplyForm
        closed={ticket.status === "closed" || ticket.status === "resolved"}
        onSend={async (body, files) => {
          await supportApi.reply(id, body, files);
          await client.invalidateQueries({ queryKey: ["customer-support"] });
        }}
      />
    </section>
  );
}
