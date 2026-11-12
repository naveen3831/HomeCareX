import { useEffect, useMemo, useState } from "react";
import http, { type ApiResponse } from "@/lib/http";
import "./CatalogScope.css";

export interface CatalogOption {
  id: string;
  name: string;
  /** Category name, shown under a service. */
  hint?: string;
}

interface RawCategory { id?: string; _id?: string; name?: string; active?: boolean }
interface RawService {
  id?: string; _id?: string; name?: string; active?: boolean;
  categoryId?: string; category?: { id?: string; name?: string } | null;
}

/** Categories and services for the admin scope pickers (coupons, referrals). */
export function useCatalogOptions() {
  const [categories, setCategories] = useState<CatalogOption[]>([]);
  const [services, setServices] = useState<CatalogOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [cats, svcs] = await Promise.all([
        http.get<ApiResponse<RawCategory[]>>("/admin/categories").then((r) => r.data.data ?? []).catch(() => [] as RawCategory[]),
        http.get<ApiResponse<RawService[]>>("/admin/services").then((r) => r.data.data ?? []).catch(() => [] as RawService[]),
      ]);
      if (!alive) return;
      const catName = new Map<string, string>();
      const catOptions: CatalogOption[] = [];
      for (const c of cats) {
        const id = String(c.id ?? c._id ?? "");
        if (!id || !c.name) continue;
        catName.set(id, c.name);
        if (c.active !== false) catOptions.push({ id, name: c.name });
      }
      const svcOptions: CatalogOption[] = [];
      for (const s of svcs) {
        const id = String(s.id ?? s._id ?? "");
        if (!id || !s.name || s.active === false) continue;
        const cid = String(s.category?.id ?? s.categoryId ?? "");
        svcOptions.push({ id, name: s.name, hint: s.category?.name ?? catName.get(cid) });
      }
      setCategories(catOptions);
      setServices(svcOptions);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  return { categories, services, loading };
}

interface CheckGridProps {
  label: string;
  options: CatalogOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  loading?: boolean;
  emptyText?: string;
  helpText?: string;
  /** Show a search box (useful for long service lists). */
  searchable?: boolean;
}

/** Multi-select checkbox list. */
export function CheckGrid({ label, options, selected, onChange, loading, emptyText, helpText, searchable }: CheckGridProps) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return term ? options.filter((o) => `${o.name} ${o.hint ?? ""}`.toLowerCase().includes(term)) : options;
  }, [options, q]);

  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="hcx-scope">
      <div className="hcx-scope__head">
        <span className="hcx-scope__label">{label}</span>
        <span className="hcx-scope__count">{selected.length} selected</span>
      </div>
      {searchable && options.length > 6 && (
        <input
          className="hcx-scope__search"
          type="search"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label={`Search ${label}`}
        />
      )}
      {loading ? (
        <p className="hcx-scope__empty">Loading…</p>
      ) : options.length === 0 ? (
        <p className="hcx-scope__empty">{emptyText ?? "Nothing available."}</p>
      ) : (
        <div className="hcx-scope__list" role="group" aria-label={label}>
          {shown.map((o) => (
            <label key={o.id} className={`hcx-scope__item${selected.includes(o.id) ? " is-selected" : ""}`}>
              <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
              <span>
                {o.name}
                {o.hint && <small>{o.hint}</small>}
              </span>
            </label>
          ))}
          {shown.length === 0 && <p className="hcx-scope__empty">No matches.</p>}
        </div>
      )}
      {helpText && <p className="hcx-scope__help">{helpText}</p>}
    </div>
  );
}
