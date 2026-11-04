import { useState } from "react";
import {
  Link,
  useLocation,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  LifeBuoy,
  Search,
  Plus,
  MessageSquare,
  Ticket,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import clsx from "clsx";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useTickets, useTicketUpdates } from "@/hooks/useTickets";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  CATEGORIES,
  problem,
  type CustomerTicket,
  type TicketCategory,
  type TicketStatus,
} from "@/features/support/types";
import { searchHelp } from "@/features/support/helpCenter";
import TicketCard from "@/components/support/TicketCard";
import TicketStatusFilter from "@/components/support/TicketStatusFilter";
import CreateTicketForm from "@/components/support/CreateTicketForm";
import CustomerTicketThread from "@/components/support/CustomerTicketThread";
import "./Support.css";

function HeroIllustration() {
  return (
    <svg
      className="w-[170px] lg:w-[190px] h-auto shrink-0 hidden sm:block"
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

function MobileHelpCenter() {
  const [search, setSearch] = useState("");
  const sections = searchHelp(search);
  return (
    <section aria-label="Help center" className="space-y-3">
      {/* Search Input matching mobile reference */}
      <label
        className="relative flex items-center rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-2xs focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all"
        htmlFor="help-search-mobile"
      >
        <Search className="h-4 w-4 shrink-0 text-slate-400 mr-2.5" aria-hidden="true" />
        <input
          id="help-search-mobile"
          type="search"
          value={search}
          maxLength={150}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payments, bookings, refunds..."
          aria-label="Search help articles"
          className="w-full bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
      </label>

      {/* Sections Counter */}
      <p className="text-xs font-semibold text-slate-500 pt-0.5 px-0.5" role="status">
        {sections.length} help {sections.length === 1 ? "section" : "sections"}
      </p>

      {/* Accordion FAQ list */}
      {sections.length ? (
        <div className="space-y-2.5">
          {sections.flatMap((section) =>
            section.articles.map((article) => (
              <details
                key={`${section.category}-${article.question}`}
                className="group rounded-2xl border border-slate-100 bg-white p-3.5 shadow-2xs transition-all open:border-slate-200 open:shadow-xs"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-slate-400">
                      {section.title}
                    </span>
                    <span className="mt-0.5 block text-[13.5px] font-bold text-slate-800 leading-snug">
                      {article.question}
                    </span>
                  </div>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="mt-2.5 border-t border-slate-100 pt-2.5 text-xs text-slate-600 leading-relaxed">
                  <p>{article.answer}</p>
                  <Link
                    to={`/customer/support?view=new&category=${encodeURIComponent(section.category)}`}
                    className="mt-2 inline-flex items-center gap-1 font-semibold text-[#ea580c] hover:underline"
                  >
                    Get help with {section.title.toLowerCase()} →
                  </Link>
                </div>
              </details>
            )),
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-xs">
          <h2 className="text-sm font-bold text-slate-900">No matching help articles</h2>
          <p className="mt-1 text-xs text-slate-500">
            Try a different word, or create a ticket so our team can help.
          </p>
          <Link
            to="/customer/support?view=new"
            className="mt-3 inline-block rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-hover"
          >
            Create a ticket
          </Link>
        </div>
      )}
    </section>
  );
}

function DesktopHelpCenter() {
  const [search, setSearch] = useState("");
  const sections = searchHelp(search);
  return (
    <section aria-label="Help center" className="space-y-3.5">
      {/* Search Input matching web reference */}
      <label
        className="relative flex items-center rounded-xl border border-slate-200/90 bg-[#fbfcfe] px-4 py-3 shadow-2xs focus-within:border-[#4338ca] focus-within:ring-2 focus-within:ring-indigo-100 transition-all"
        htmlFor="help-search-desktop"
      >
        <Search className="h-4 w-4 shrink-0 text-slate-400 mr-3" aria-hidden="true" />
        <input
          id="help-search-desktop"
          type="search"
          value={search}
          maxLength={150}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payments, bookings, refunds..."
          aria-label="Search help articles"
          className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
        />
      </label>

      {/* Sections Counter */}
      <p className="text-xs font-semibold text-slate-500 pt-0.5 px-0.5" role="status">
        {sections.length} help {sections.length === 1 ? "section" : "sections"}
      </p>

      {/* Full-width FAQ Accordion Cards List */}
      {sections.length ? (
        <div className="space-y-3">
          {sections.flatMap((section) =>
            section.articles.map((article) => (
              <details
                key={`${section.category}-${article.question}`}
                className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs transition-all open:border-slate-300 open:shadow-xs"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left [&::-webkit-details-marker]:hidden">
                  <div className="min-w-0 flex-1">
                    <span className="block text-xs font-medium text-slate-400">
                      {section.title}
                    </span>
                    <span className="mt-1 block text-[15px] font-bold text-slate-900 leading-snug">
                      {article.question}
                    </span>
                  </div>
                  <ChevronDown
                    className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600 leading-relaxed">
                  <p>{article.answer}</p>
                  <Link
                    to={`/customer/support?view=new&category=${encodeURIComponent(section.category)}`}
                    className="mt-2.5 inline-flex items-center gap-1 font-semibold text-[#ea580c] hover:underline"
                  >
                    Get help with {section.title.toLowerCase()} →
                  </Link>
                </div>
              </details>
            )),
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <h2 className="text-base font-bold text-slate-900">No matching help articles</h2>
          <p className="mt-1 text-sm text-slate-500">
            Try a different word, or create a ticket so our team can help.
          </p>
          <Link
            to="/customer/support?view=new"
            className="mt-4 inline-block rounded-xl bg-[#4338ca] px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#3730a3]"
          >
            Create a ticket
          </Link>
        </div>
      )}
    </section>
  );
}

function getTicketPageData(raw: unknown): {
  items: CustomerTicket[];
  page: number;
  pages: number;
  total: number;
} {
  if (Array.isArray(raw)) {
    return {
      items: raw as CustomerTicket[],
      page: 1,
      pages: 1,
      total: raw.length,
    };
  }

  if (raw && typeof raw === "object") {
    const data = raw as {
      items?: CustomerTicket[];
      meta?: {
        page?: number;
        pages?: number;
        total?: number;
      };
    };
    const items = Array.isArray(data.items) ? data.items : [];
    const meta = data.meta;

    return {
      items,
      page: meta?.page ?? 1,
      pages: Math.max(1, meta?.pages ?? 1),
      total: meta?.total ?? items.length,
    };
  }

  return { items: [], page: 1, pages: 1, total: 0 };
}

function TicketList() {
  const online = useOnlineStatus();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<TicketStatus | "">("");
  const tickets = useTickets({ page, status: status || undefined });

  const pageData = getTicketPageData(tickets.data);
  const { items, pages } = pageData;

  return (
    <section aria-label="Ticket list">
      <div className="hcx-support-section-head">
        <div>
          <h2>My tickets</h2>
          <p className="hcx-support-muted">
            Track requests and continue the conversation.
          </p>
        </div>
        <TicketStatusFilter
          value={status}
          onChange={(nextStatus) => {
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
        (items.length ? (
          <ul
            className="hcx-support-ticket-list"
            aria-busy={tickets.isFetching}
          >
            {items.map((ticket) => (
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
      {tickets.data && pages > 1 && (
        <nav className="hcx-support-pagination" aria-label="Ticket pages">
          <button
            type="button"
            disabled={page <= 1 || tickets.isFetching || !online}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </button>
          <span>
            Page {page} of {pages}
          </span>
          <button
            type="button"
            disabled={
              page >= pages || tickets.isFetching || !online
            }
            onClick={() =>
              setPage((current) => Math.min(pages, current + 1))
            }
          >
            Next
          </button>
        </nav>
      )}
    </section>
  );
}

export default function Support() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [params] = useSearchParams();
  const location = useLocation();
  const online = useOnlineStatus();
  useTicketUpdates();
  const isMobile = useMediaQuery("(max-width: 767px)");

  const view = ticketId
    ? "thread"
    : (params.get("view") ??
      (location.pathname.endsWith("/tickets") ? "tickets" : "help"));
  const rawCategory = params.get("category");
  const category = CATEGORIES.includes(rawCategory as TicketCategory)
    ? (rawCategory as TicketCategory)
    : "booking";
  const showHelp = !ticketId && view !== "new" && view !== "tickets";

  // MOBILE VIEW (< 768px): Matches mobile reference design
  if (isMobile) {
    return (
      <div className="mx-auto max-w-lg space-y-3.5 pb-20">
        {ticketId ? (
          <div className="hcx-support">
            <CustomerTicketThread key={ticketId} id={ticketId} />
          </div>
        ) : view === "new" ? (
          <div className="hcx-support">
            <CreateTicketForm key={category} category={category} />
          </div>
        ) : (
          <>
            {/* Card 1: Raise a New Ticket */}
            <Link
              to="/customer/support?view=new"
              className="flex items-center justify-between rounded-2xl border border-[#dbe6fe] bg-[#f0f4ff] p-3.5 shadow-2xs transition-all active:scale-[0.99] hover:bg-[#e6eeff]"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100/80 bg-white shadow-2xs text-[#2563eb]">
                  <Ticket className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="text-left">
                  <div className="text-[14.5px] font-bold text-[#1e1b4b] leading-tight">
                    Raise a New Ticket
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    Get support for your issue
                  </div>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#2563eb]" aria-hidden="true" />
            </Link>

            {/* Card 2: How can we help you? Hero Card */}
            <div className="rounded-2xl border border-blue-100/70 bg-[#f7f9ff] p-4 shadow-2xs">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-orange-100/80 bg-white shadow-2xs text-[#ea580c]">
                  <LifeBuoy className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#ea580c]">
                    HERE TO HELP
                  </div>
                  <h1 className="mt-0.5 text-lg font-bold text-[#1e1b4b] leading-snug">
                    How can we help you?
                  </h1>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                    Find an answer or talk to the HomeCareX team.
                  </p>
                </div>
              </div>
            </div>

            {/* Segmented Underline Tabs */}
            <nav
              className="flex items-center gap-8 border-b border-slate-200/90 pt-1"
              aria-label="Support sections"
            >
              <Link
                to="/customer/support"
                aria-current={showHelp ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-2 pb-2.5 text-sm transition-colors",
                  showHelp
                    ? "border-b-2 border-[#ea580c] font-semibold text-[#ea580c] -mb-[1px]"
                    : "font-medium text-slate-500 hover:text-slate-700",
                )}
              >
                <LifeBuoy
                  className={clsx(
                    "h-4 w-4 shrink-0",
                    showHelp ? "text-[#ea580c]" : "text-slate-400",
                  )}
                  aria-hidden="true"
                />
                <span>Help center</span>
              </Link>
              <Link
                to="/customer/support/tickets"
                aria-current={
                  view === "tickets" || view === "thread" ? "page" : undefined
                }
                className={clsx(
                  "flex items-center gap-2 pb-2.5 text-sm transition-colors",
                  view === "tickets" || view === "thread"
                    ? "border-b-2 border-[#ea580c] font-semibold text-[#ea580c] -mb-[1px]"
                    : "font-medium text-slate-500 hover:text-slate-700",
                )}
              >
                <Ticket
                  className={clsx(
                    "h-4 w-4 shrink-0",
                    view === "tickets" || view === "thread"
                      ? "text-[#ea580c]"
                      : "text-slate-400",
                  )}
                  aria-hidden="true"
                />
                <span>My tickets</span>
              </Link>
            </nav>

            {!online && (
              <p
                className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"
                role="status"
              >
                You’re offline. You can read help articles and any conversation
                already loaded. Reconnect to send a request.
              </p>
            )}

            {/* View Content Panel */}
            <div>
              {view === "tickets" ? (
                <div className="hcx-support rounded-2xl border border-slate-100 bg-white p-4 shadow-2xs">
                  <TicketList />
                </div>
              ) : (
                <MobileHelpCenter />
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // DESKTOP / WEB VIEW (>= 768px): Matches web reference design exactly
  return (
    <div className="w-full min-w-0 space-y-6 pb-12">
      {/* Hero Header Card */}
      <header className="flex items-center justify-between rounded-2xl border border-indigo-50/80 bg-gradient-to-r from-[#f9faff] via-[#f5f7ff] to-[#eff3ff] p-6 lg:p-7 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-orange-100/70 bg-white shadow-2xs text-[#ea580c]">
            <LifeBuoy className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#ea580c]">
              HERE TO HELP
            </p>
            <h1 className="mt-1 text-2xl lg:text-[26px] font-extrabold text-[#1e1b4b] tracking-tight">
              How can we <span className="text-[#4338ca]">help you?</span>
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Find an answer or talk to the HomeCareX team.
            </p>
          </div>
        </div>
        <HeroIllustration />
      </header>

      {/* Tabs and + New Ticket Bar */}
      <div className="flex items-center justify-between border-b border-slate-200/90 pt-1">
        <nav className="flex items-center gap-8" aria-label="Support sections">
          <Link
            to="/customer/support"
            aria-current={showHelp ? "page" : undefined}
            className={clsx(
              "flex items-center gap-2 pb-3 text-sm transition-colors",
              showHelp
                ? "border-b-2 border-[#ea580c] font-semibold text-[#ea580c] -mb-[1px]"
                : "font-medium text-slate-500 hover:text-slate-800",
            )}
          >
            <LifeBuoy
              className={clsx(
                "h-4 w-4 shrink-0",
                showHelp ? "text-[#ea580c]" : "text-slate-400",
              )}
              aria-hidden="true"
            />
            <span>Help center</span>
          </Link>
          <Link
            to="/customer/support/tickets"
            aria-current={
              view === "tickets" || view === "thread" ? "page" : undefined
            }
            className={clsx(
              "flex items-center gap-2 pb-3 text-sm transition-colors",
              view === "tickets" || view === "thread"
                ? "border-b-2 border-[#ea580c] font-semibold text-[#ea580c] -mb-[1px]"
                : "font-medium text-slate-500 hover:text-slate-800",
            )}
          >
            <Ticket
              className={clsx(
                "h-4 w-4 shrink-0",
                view === "tickets" || view === "thread"
                  ? "text-[#ea580c]"
                  : "text-slate-400",
              )}
              aria-hidden="true"
            />
            <span>My tickets</span>
          </Link>
        </nav>

        <Link
          to="/customer/support?view=new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#4338ca] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[#3730a3] active:scale-[0.98] transition-all -mt-1"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>New Ticket</span>
        </Link>
      </div>

      {!online && (
        <p
          className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800"
          role="status"
        >
          You’re offline. You can read help articles and any conversation
          already loaded. Reconnect to send a request.
        </p>
      )}

      {/* Main View Content */}
      <div>
        {ticketId ? (
          <div className="hcx-support rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <CustomerTicketThread key={ticketId} id={ticketId} />
          </div>
        ) : view === "new" ? (
          <div className="hcx-support rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <CreateTicketForm key={category} category={category} />
          </div>
        ) : view === "tickets" ? (
          <div className="hcx-support rounded-2xl border border-slate-200/80 bg-white p-6 shadow-2xs">
            <TicketList />
          </div>
        ) : (
          <DesktopHelpCenter />
        )}
      </div>
    </div>
  );
}
