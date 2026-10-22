import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronDown, MessageSquare, Search } from "lucide-react";

import "./Support.css";

import { searchHelp } from "@/features/support/helpCenter";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useTickets } from "@/hooks/useTickets";
import type { TicketStatus } from "@/features/support/types";
import TicketStatusFilter from "@/components/support/TicketStatusFilter";
import TicketCard from "@/components/support/TicketCard";

/** Turns an unknown error into a short message for the screen. */
function problem(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "Something went wrong. Please try again.";
}

function HeroIllustration() {
  return (
    <svg
      className="hcx-support-hero-art"
      viewBox="0 0 300 160"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M14 96C4 64 34 34 74 44C104 22 148 32 160 62C206 70 214 124 166 140C112 156 30 146 14 96Z"
        fill="#e7e9fb"
      />
      <ellipse
        cx="24"
        cy="52"
        rx="7"
        ry="14"
        transform="rotate(-35 24 52)"
        fill="#dde0f8"
      />
      <circle cx="96" cy="92" r="42" fill="#fff" />
      <circle cx="176" cy="76" r="60" fill="#fff" />
      <path
        d="M138 82C138 56 154 40 176 40C198 40 214 56 214 82"
        stroke="#3a2a9e"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <rect x="130" y="66" width="12" height="30" rx="6" fill="#3a2a9e" />
      <rect x="206" y="62" width="16" height="38" rx="8" fill="#2b1f8f" />
      <path
        d="M214 98C214 122 198 128 180 128"
        stroke="#2b1f8f"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <rect x="164" y="121" width="20" height="12" rx="6" fill="#2b1f8f" />
      <rect x="62" y="70" width="68" height="46" rx="20" fill="#c3bbf5" />
      <path d="M74 110L66 128L92 114Z" fill="#c3bbf5" />
      <circle cx="82" cy="93" r="4.5" fill="#fff" />
      <circle cx="96" cy="93" r="4.5" fill="#fff" />
      <circle cx="110" cy="93" r="4.5" fill="#fff" />
      <path
        d="M252 32L259 22"
        stroke="#f58a1f"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M254 50H266"
        stroke="#f58a1f"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function HelpCenter() {
  const [search, setSearch] = useState("");
  const sections = searchHelp(search);
  return (
    <section aria-label="Help center">
      <label className="hcx-support-search" htmlFor="help-search">
        <Search size={19} aria-hidden="true" />
        <input
          id="help-search"
          type="search"
          value={search}
          maxLength={150}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payments, bookings, refunds…"
          aria-label="Search help articles"
        />
      </label>
      <p className="hcx-support-muted" role="status">
        {sections.length} help {sections.length === 1 ? "section" : "sections"}
      </p>
      {sections.length ? (
        <div className="hcx-support-help-list">
          {sections.flatMap((section) =>
            section.articles.map((article) => (
              <details
                key={`${section.category}-${article.question}`}
                className="hcx-support-faq"
              >
                <summary>
                  <span>
                    <h3 className="hcx-support-faq-cat">{section.title}</h3>
                    <span className="hcx-support-faq-q">
                      {article.question}
                    </span>
                  </span>
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <div className="hcx-support-faq-body">
                  <p>{article.answer}</p>
                  <Link
                    to={`/customer/support?view=new&category=${section.category}`}
                  >
                    Get help with {section.title.toLowerCase()} →
                  </Link>
                </div>
              </details>
            )),
          )}
        </div>
      ) : (
        <div className="hcx-support-state">
          <h2>No matching help articles</h2>
          <p>Try a different word, or create a ticket so our team can help.</p>
          <Link to="/customer/support?view=new">Create a ticket</Link>
        </div>
      )}
    </section>
  );
}

function TicketList() {
  const online = useOnlineStatus();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TicketStatus | "">("");
  const tickets = useTickets({ page, status: status || undefined });
  return (
    <section aria-label="My support tickets">
      <div className="hcx-support-section-head">
        <div>
          <h2>My tickets</h2>
          <p className="hcx-support-muted">
            Track requests and continue the conversation.
          </p>
        </div>
        <TicketStatusFilter
          value={status}
          onChange={(nextStatus: TicketStatus | "") => {
            setStatus(nextStatus);
            setPage(1);
          }}
        />
      </div>
      {tickets.isError && (
        <p className="hcx-support-error" role="alert">
          {problem(tickets.error)}{" "}
          <button type="button" onClick={() => void tickets.refetch()}>
            Try again
          </button>
        </p>
      )}
      {!tickets.data && !tickets.isError && (
        <div className="hcx-support-state" role="status">
          {online ? "Loading your tickets…" : "Reconnect to load your tickets."}
        </div>
      )}
      {tickets.data &&
        (tickets.data.items.length ? (
          <ul
            className="hcx-support-ticket-list"
            aria-busy={tickets.isFetching}
          >
            {tickets.data.items.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} />
            ))}
          </ul>
        ) : (
          <div className="hcx-support-state">
            <MessageSquare size={28} aria-hidden="true" />
            <h3>{status ? "No tickets with this status" : "No tickets yet"}</h3>
            <p>
              {status
                ? "Choose another status to see your requests."
                : "When you need a hand, our support team is here."}
            </p>
            <Link to="/customer/support?view=new">Create a ticket</Link>
          </div>
        ))}
      {tickets.data && tickets.data.meta.pages > 1 && (
        <nav className="hcx-support-pagination" aria-label="Ticket pages">
          <button
            type="button"
            disabled={page === 1 || tickets.isFetching || !online}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {tickets.data.meta.pages}
          </span>
          <button
            type="button"
            disabled={
              page >= tickets.data.meta.pages || tickets.isFetching || !online
            }
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

export default function Support() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "help" ? "help" : "tickets";

  const show = (next: "help" | "tickets") => setParams({ view: next });

  return (
    <div className="hcx-support-page">
      <header className="hcx-support-hero">
        <div>
          <h1>Support</h1>
          <p className="hcx-support-muted">Get help and contact support.</p>
        </div>
        <HeroIllustration />
      </header>

      <div className="hcx-support-tabs" role="tablist" aria-label="Support">
        <button
          type="button"
          role="tab"
          aria-selected={view === "tickets"}
          onClick={() => show("tickets")}
        >
          My tickets
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "help"}
          onClick={() => show("help")}
        >
          Help center
        </button>
        <Link to="/customer/support?view=new">New ticket</Link>
      </div>

      {view === "help" ? <HelpCenter /> : <TicketList />}
    </div>
  );
}