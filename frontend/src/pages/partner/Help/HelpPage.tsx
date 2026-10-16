import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Search, LifeBuoy } from "lucide-react";

import { HELP_ARTICLES } from "./helpArticles";

export default function HelpPage() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_ARTICLES;
    return HELP_ARTICLES.filter((a) =>
      `${a.title} ${a.body} ${a.topic}`.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div className="relative">
        <label htmlFor="help-search" className="sr-only">
          Search help articles
        </label>
        <Search
          size={16}
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          id="help-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search help articles"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
        />
      </div>

      {results.length === 0 ? (
        <div role="status" className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="font-medium text-slate-700">No articles match "{query}"</p>
          <p className="mt-1 text-sm text-slate-500">Try different words, or contact support.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {results.map((a) => {
            const open = openId === a.id;
            return (
              <li key={a.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <h2>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={`help-${a.id}`}
                    onClick={() => setOpenId(open ? null : a.id)}
                    className="flex w-full items-center justify-between gap-3 rounded-xl p-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
                  >
                    <span>
                      <span className="block text-xs text-slate-500">{a.topic}</span>
                      <span className="font-medium text-slate-900">{a.title}</span>
                    </span>
                    <ChevronDown
                      size={18}
                      aria-hidden
                      className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                </h2>
                {open && (
                  <p id={`help-${a.id}`} className="px-4 pb-4 text-sm leading-relaxed text-slate-600">
                    {a.body}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-indigo-50 p-4">
        <p className="text-sm text-indigo-900">Can't find what you need?</p>
        <Link
          to="/partner/support"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#4338ca] px-4 py-2 text-sm font-medium text-white hover:bg-[#3730a3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4338ca]"
        >
          <LifeBuoy size={16} aria-hidden />
          Contact support
        </Link>
      </div>
    </div>
  );
}
