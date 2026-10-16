import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, LifeBuoy, Search, SearchX } from "lucide-react";
import clsx from "clsx";

import { NO_SCROLLBAR } from "@/components/customer/noScrollbar";
import { HELP_ARTICLES } from "./helpArticles";

const ALL = "All";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string>(ALL);
  const [openId, setOpenId] = useState<string | null>(null);

  const topics = useMemo(
    () => [ALL, ...Array.from(new Set(HELP_ARTICLES.map((a) => a.topic)))],
    [],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HELP_ARTICLES.filter(
      (a) =>
        (topic === ALL || a.topic === topic) &&
        (!q || `${a.title} ${a.body} ${a.topic}`.toLowerCase().includes(q)),
    );
  }, [query, topic]);

  const searchInput = (id: string, className?: string) => (
    <div className={clsx("relative", className)}>
      <label htmlFor={id} className="sr-only">
        Search help articles
      </label>
      <Search
        size={18}
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
      />
      <input
        id={id}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search help articles"
        className="w-full rounded-2xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:border-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-600/30"
      />
    </div>
  );

  const chips = (
    <div role="tablist" aria-label="Help topics" className="flex gap-2">
      {topics.map((t) => {
        const selected = topic === t;
        return (
          <button
            key={t}
            role="tab"
            aria-selected={selected}
            onClick={() => setTopic(t)}
            className={clsx(
              "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              focus,
              selected
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-indigo-50 hover:text-indigo-700",
            )}
          >
            {t}
          </button>
        );
      })}
    </div>
  );

  const list =
    results.length === 0 ? (
      <div
        role="status"
        className="m-auto flex max-w-sm flex-col items-center gap-3 px-6 text-center"
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/30">
          <SearchX size={28} aria-hidden />
        </span>
        <p className="text-lg font-semibold text-slate-900">
          {query.trim() ? `No articles match "${query}"` : "No articles in this topic"}
        </p>
        <p className="text-sm text-slate-500">Try different words, or contact support.</p>
      </div>
    ) : (
      <ul className="grid items-start gap-3 lg:grid-cols-2">
        {results.map((a) => {
          const open = openId === a.id;
          return (
            <li
              key={a.id}
              className={clsx(
                "overflow-hidden rounded-2xl bg-white shadow-sm ring-1 transition-shadow",
                open ? "ring-indigo-300 shadow-md" : "ring-slate-200",
              )}
            >
              <h2>
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`help-${a.id}`}
                  onClick={() => setOpenId(open ? null : a.id)}
                  className={clsx(
                    "flex w-full items-center justify-between gap-3 p-4 text-left sm:p-5",
                    focus,
                  )}
                >
                  <span className="min-w-0">
                    <span className="mb-1.5 inline-block rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                      {a.topic}
                    </span>
                    <span className="block text-[15px] font-semibold leading-snug text-slate-900">
                      {a.title}
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    aria-hidden
                    className={clsx(
                      "shrink-0 text-slate-400 transition-transform",
                      open && "rotate-180 text-indigo-600",
                    )}
                  />
                </button>
              </h2>
              {open && (
                <p
                  id={`help-${a.id}`}
                  className="border-t border-slate-100 px-4 pb-5 pt-4 text-sm leading-relaxed text-slate-600 sm:px-5"
                >
                  {a.body}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-slate-50">
      {/* ================= DESKTOP: white header with big search ================= */}
      <section className="hidden shrink-0 border-b border-slate-200 bg-white px-8 py-6 lg:block">
        <div className="flex items-center justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Help centre
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
              How can we help?
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {HELP_ARTICLES.length} quick answers about jobs, earnings and your account.
            </p>
          </div>

          {searchInput("help-search-desktop", "w-full max-w-md")}

          <Link
            to="/partner/support"
            className={clsx(
              "inline-flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700",
              focus,
            )}
          >
            <LifeBuoy size={16} aria-hidden />
            Contact support
          </Link>
        </div>
        <div className={clsx("mt-5 overflow-x-auto", NO_SCROLLBAR)}>{chips}</div>
      </section>

      {/* ================= MOBILE: white header, search + chips ================= */}
      <section className="shrink-0 border-b border-slate-200 bg-white px-4 pb-3 pt-4 lg:hidden">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">How can we help?</h2>
        <p className="mb-3 text-xs text-slate-500">
          {HELP_ARTICLES.length} quick answers about jobs, earnings and your account.
        </p>
        {searchInput("help-search-mobile")}
        <div className={clsx("-mx-4 mt-3 overflow-x-auto px-4", NO_SCROLLBAR)}>{chips}</div>
      </section>

      {/* Articles: scroll inside the page, scrollbar hidden */}
      <div
        className={clsx(
          "flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 lg:px-8 lg:py-6",
          NO_SCROLLBAR,
        )}
      >
        {list}
      </div>

      {/* Mobile only: contact bar pinned to the bottom (desktop has the button in the header) */}
      <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] lg:hidden">
        <Link
          to="/partner/support"
          className={clsx(
            "flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm active:scale-[0.99]",
            focus,
          )}
        >
          <LifeBuoy size={16} aria-hidden />
          Can't find it? Contact support
        </Link>
      </div>
    </div>
  );
}