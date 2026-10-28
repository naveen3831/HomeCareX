import React, { useEffect, useMemo, useState } from 'react';
import type { ApiResponse } from '@/lib/http';
import http from '@/lib/http';
import { PageHeader } from '@/components/admin/PageHeader';
import { useAuthStore } from '@/store/useAuthStore';
import { adminPricingApi, cityKey, getPricingApiMode, normalizeCity } from '@/services/adminPricingApi';
import type { CategoryOption, PricingRule, PricingRuleInput, ServiceOption } from '@/types/adminPricing';
import PricingRuleForm from './PricingRuleForm';
import './index.css';

type StatusFilter = 'all' | 'active' | 'inactive';
type ModeFilter = 'all' | 'FIXED' | 'HOURLY';

const unwrap = async <T,>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> => {
  const res = await promise;
  return res.data.data as T;
};

const labelForRule = (rule: PricingRule, categories: CategoryOption[], services: ServiceOption[]) => {
  const service = services.find((s) => s.id === rule.serviceId);
  const category = categories.find((c) => c.id === rule.categoryId);
  const base = service?.name ?? category?.name ?? 'Pricing rule';
  return rule.city ? `${base} · ${rule.city}` : base;
};

export const AdminPricingPage: React.FC = () => {
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  History,
  Pencil,
  Plus,
  Tag,
  Trash2,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import { PageHeader } from "@/components/admin/PageHeader";
import { PageSearch } from "@/components/admin/PageSearch";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { FullScreenPanel } from "@/components/admin/FullScreenPanel";
import {
  AuditDiffDrawer,
  type AuditEntry,
} from "@/components/admin/AuditDiffDrawer";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { PermissionGate } from "@/components/admin/PermissionGate";
import { usePermissions } from "@/hooks/usePermissions";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useUIStore } from "@/store/useUIStore";
import { adminCategoryApi } from "@/pages/admin/Services/adminCategoryApi";
import { adminServiceApi } from "@/services/adminServiceApi";
import {
  adminPricingApi,
  cityKey,
  getPricingApiMode,
  getPricingApiModeReason,
  type PricingApiError,
} from "@/services/adminPricingApi";
import type { AdminCategory } from "@/types/adminCatalog";
import type {
  CategoryOption,
  PricingAuditEntry,
  PricingFormErrors,
  PricingRule,
  PricingRuleInput,
  ServiceOption,
} from "@/types/adminPricing";
import PricingRuleForm from "./PricingRuleForm";
import "../Categories/index.css";
import "./index.css";

export const PRICING_MANAGE = "pricing:manage";

type Toast = { text: string; tone: "success" | "error" } | null;
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const duration = (m: number) =>
  m < 60
    ? `${m} min`
    : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ""}`;

/** "Parent › Child" labels so sub-categories are recognisable in a flat list. */
function toCategoryOptions(cats: AdminCategory[]): CategoryOption[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  return cats
    .map((c) => ({
      id: c.id,
      name:
        c.parentId && byId.get(c.parentId)
          ? `${byId.get(c.parentId)!.name} › ${c.name}`
          : c.name,
      active: c.active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const AdminPricingPage: React.FC = () => {
  const online = useOnlineStatus();
  const { can } = usePermissions();
  const canManage = can(PRICING_MANAGE);

  const [rules, setRules] = useState<PricingRule[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [cityFilter, setCityFilter] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const [serverFields, setServerFields] = useState<Record<string, string>>({});
  const [pendingDelete, setPendingDelete] = useState<PricingRule | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditEntries, setAuditEntries] = useState<Array<{ id: string; entityName: string }>>([]);

  const canManage = useAuthStore((s) =>
    Array.isArray(s.user?.permissions) ? s.user.permissions.includes('pricing:manage') : false,
  );

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [categoryList, serviceList] = await Promise.all([
        unwrap(http.get<ApiResponse<Array<{ id: string; name: string; active?: boolean }>>>('/admin/categories')),
        unwrap(http.get<ApiResponse<Array<{ id: string; name: string; categoryId: string; basePrice?: number; durationMinutes?: number }>>>('/admin/services')),
      ]);

      setCategories(
        (categoryList ?? []).map((c) => ({ id: c.id, name: c.name, active: c.active ?? true })),
      );
      setServices(
        (serviceList ?? []).map((s) => ({
          id: s.id,
          name: s.name,
          categoryId: s.categoryId,
          basePrice: Number(s.basePrice ?? 0),
          durationMinutes: Number(s.durationMinutes ?? 60),
        })),
      );

      const nextRules = await adminPricingApi.list();
      setRules(nextRules);
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not load pricing rules.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const cityOptions = useMemo(
    () => Array.from(new Set(rules.map((r) => r.city).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [rules],
  );

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (statusFilter !== 'all' && (rule.active ? 'active' : 'inactive') !== statusFilter) return false;
      if (modeFilter !== 'all' && rule.mode !== modeFilter) return false;
      if (cityFilter && cityKey(rule.city || '') !== cityKey(cityFilter)) return false;
      return true;
    });
  }, [rules, statusFilter, modeFilter, cityFilter]);

  const clearFilters = () => {
    setStatusFilter('all');
    setModeFilter('all');
    setCityFilter('');
  };

  const handleSubmit = async (input: PricingRuleInput) => {
    setSaving(true);
    setServerError('');
    setServerFields({});
    try {
      const label = labelForRule(
        {
          id: 'draft',
          categoryId: input.categoryId,
          serviceId: input.serviceId,
          city: normalizeCity(input.city),
          mode: input.mode,
          basePrice: input.basePrice,
          durationMinutes: input.durationMinutes,
          addOns: input.addOns,
          surgeWindows: input.surgeWindows,
          cancellationFee: input.cancellationFee,
          active: input.active,
        },
        categories,
        services,
      );
      await adminPricingApi.save(input, label);
      setRules(await adminPricingApi.list());
      setIsFormOpen(false);
      setEditing(null);
    } catch (e) {
      const err = e as { message?: string; fields?: Record<string, string> };
      setServerError(err.message ?? 'Pricing rule could not be saved.');
      setServerFields(err.fields ?? {});
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (rule: PricingRule) => {
    const next = !rule.active;
    const label = labelForRule(rule, categories, services);
    try {
      await adminPricingApi.setActive(rule, next, label);
      setRules(await adminPricingApi.list());
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not update the rule.');
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const label = labelForRule(pendingDelete, categories, services);
    try {
      await adminPricingApi.remove(pendingDelete, label);
      setRules(await adminPricingApi.list());
      setPendingDelete(null);
    } catch (e) {
      setError((e as { message?: string }).message ?? 'Could not delete the rule.');
      setPendingDelete(null);
    }
  };

  const openAuditLog = async () => {
    const entries = await adminPricingApi.auditLog();
    setAuditEntries(entries.map((e) => ({ id: e.id, entityName: e.entityName })));
    setAuditOpen(true);
  };

  const mode = getPricingApiMode();
  const totalCount = rules.length;
  const showingText = `${filteredRules.length} of ${totalCount} rules`;

  return (
    <div className="admin-page-container prc-page">
      <PageHeader
        title="Pricing"
        description="Manage pricing rules by category, service and city."
        actions={
          <>
            <button type="button" className="hcx-btn" onClick={openAuditLog} aria-label="Audit log">
              Audit log
            </button>
            {canManage && (
              <button
                type="button"
                className="hcx-btn hcx-btn--primary"
                onClick={() => {
                  setEditing(null);
                  setServerError('');
                  setServerFields({});
                  setIsFormOpen(true);
                }}
                aria-label="Create rule"
              >
                <span aria-hidden="true">＋</span> Create rule
              </button>
            )}
          </>
        }
      />

      {mode === 'demo' && (
        <div role="alert" className="cat-alert" style={{ marginTop: 16 }}>
          Backend not reachable. Demo mode is active and server quote is unavailable.
        </div>
      )}

      {error && (
        <div role="alert" className="cat-alert" style={{ marginTop: 16 }}>
          {error}
        </div>
      )}

      <div className="prc-toolbar" style={{ marginTop: 16 }}>
        <div role="radiogroup" aria-label="Rule status" className="prc-chips">
          {['all', 'active', 'inactive'].map((value) => {
            const selected = statusFilter === value;
            const label = value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1);
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? 'prc-chip is-on' : 'prc-chip'}
                onClick={() => setStatusFilter(value as StatusFilter)}
                aria-label={label}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div role="radiogroup" aria-label="Rule mode" className="prc-chips">
          {(['FIXED', 'HOURLY'] as ModeFilter[]).map((value) => {
            const selected = modeFilter === value;
            const label = value === 'FIXED' ? 'Fixed' : 'Hourly';
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? 'prc-chip is-on' : 'prc-chip'}
                onClick={() => setModeFilter(value)}
                aria-label={label}
              >
                {label}
              </button>
            );
          })}
        </div>

        <label className="prc-citysel" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>City</span>
          <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} aria-label="City">
            <option value="">All cities</option>
            {cityOptions.map((city) => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </label>

        {(statusFilter !== 'all' || modeFilter !== 'all' || cityFilter) && (
          <button type="button" className="hcx-btn" onClick={clearFilters} aria-label="Clear filters">
            Clear filters
          </button>
        )}
      </div>

      <div style={{ marginTop: 10, color: '#475569', fontWeight: 600 }}>{showingText}</div>

      {loading ? (
        <div style={{ marginTop: 24 }}>Loading pricing rules…</div>
      ) : filteredRules.length === 0 ? (
        <div className="cat-empty" style={{ marginTop: 24 }}>
          <h3>No rules match your filters</h3>
          <p>Try clearing the filters or creating a new rule.</p>
          <button type="button" className="hcx-btn" onClick={clearFilters} aria-label="Clear filters">
            Clear filters
          </button>
        </div>
      ) : (
        <table aria-label="Pricing rules" className="hcx-table prc-table" style={{ marginTop: 20 }}>
          <thead>
            <tr>
              <th>Scope</th>
              <th>Price</th>
              <th>Status</th>
              <th className="prc-th-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRules.map((rule) => {
              const label = labelForRule(rule, categories, services);
              const active = rule.active;
              const rowActions = canManage ? (
                <div className="prc-actions">
                  <button
                    type="button"
                    className="cat-iconbtn"
                    aria-label={`Edit rule for ${label}`}
                    onClick={() => {
                      setEditing(rule);
                      setServerError('');
                      setServerFields({});
                      setIsFormOpen(true);
                    }}
                    title="Edit rule"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    className="cat-iconbtn cat-iconbtn--danger"
                    aria-label={`Remove rule ${label}`}
                    onClick={() => setPendingDelete(rule)}
                    title="Remove rule"
                  >
                    🗑
                  </button>
                </div>
              ) : null;

              return (
                <tr key={rule.id} className={active ? '' : 'is-inactive'}>
                  <td className="prc-td-scope">
                    <div className="prc-scope">
                      <strong>{label}</strong>
                      <small>
                        <span>{rule.city || 'All cities'}</span>
                        <span aria-hidden="true"> • </span>
                        <span>{rule.mode}</span>
                      </small>
                    </div>
                  </td>
                  <td>
                    <span className="prc-price">₹{rule.basePrice}</span>
                    <span className={rule.mode === 'HOURLY' ? 'prc-mode is-hourly' : 'prc-mode'}>{rule.mode}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={active}
                      aria-label={active ? 'Is active' : 'Is inactive'}
                      className={active ? 'cat-switch is-on' : 'cat-switch'}
                      onClick={() => toggleActive(rule)}
                      disabled={!canManage}
                    >
                      <span />
                    </button>
                  </td>
                  <td className="prc-td-actions">{rowActions}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <PricingRuleForm
        open={isFormOpen}
  const [loadError, setLoadError] = useState("");
  // Search text comes from the PageSearch box under the title.
  const search = useUIStore((s) => s.pageSearch);
  const setPageSearch = useUIStore((s) => s.setPageSearch);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  // In-page filters (the navbar search above still works too).
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [modeFilter, setModeFilter] = useState<"FIXED" | "HOURLY" | null>(null);
  const [cityFilter, setCityFilter] = useState("");

  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number>();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formFields, setFormFields] = useState<PricingFormErrors | undefined>();

  const [toDelete, setToDelete] = useState<PricingRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState<PricingAuditEntry[]>([]);
  const [auditEntry, setAuditEntry] = useState<AuditEntry | null>(null);

  const flash = useCallback(
    (text: string, tone: "success" | "error" = "success") => {
      setToast({ text, tone });
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 5500);
    },
    [],
  );
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const load = useCallback(async () => {
    try {
      // Categories, then services (each decides its own live/demo mode), then the rules.
      const cats = await adminCategoryApi
        .list()
        .catch(() => [] as AdminCategory[]);
      const svcs = await adminServiceApi.list().catch(() => []);
      setCategories(toCategoryOptions(cats));
      setServices(
        svcs.map((s) => ({
          id: s.id,
          name: s.name,
          categoryId: s.categoryId,
          basePrice: s.basePrice,
          durationMinutes: s.durationMinutes,
        })),
      );
      setRules(await adminPricingApi.list());
      setLoadError("");
    } catch (e) {
      setLoadError((e as PricingApiError).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // ---- names for the table ----
  const categoryName = useCallback(
    (id: string) =>
      categories.find((c) => c.id === id)?.name ?? "Unknown category",
    [categories],
  );
  const serviceName = useCallback(
    (id: string | null) =>
      id === null
        ? "All services"
        : (services.find((s) => s.id === id)?.name ?? "Unknown service"),
    [services],
  );
  const labelFor = useCallback(
    (r: { categoryId: string; serviceId: string | null; city: string }) =>
      `${r.serviceId ? serviceName(r.serviceId) : `${categoryName(r.categoryId)} (all services)`} · ${r.city || "All cities"}`,
    [categoryName, serviceName],
  );

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return rules.filter((r) => {
      if (statusFilter !== "all" && (statusFilter === "active") !== r.active) return false;
      if (modeFilter && r.mode !== modeFilter) return false;
      if (cityFilter && cityKey(r.city || "") !== cityKey(cityFilter)) return false;
      if (!needle) return true;

      return [
        serviceName(r.serviceId),
        categoryName(r.categoryId),
        r.city || "all cities",
        r.mode,
      ].some((v) => v.toLowerCase().includes(needle));
    });
  }, [rules, search, statusFilter, modeFilter, cityFilter, serviceName, categoryName]);

  const filtersActive = statusFilter !== "all" || modeFilter !== null || cityFilter !== "" || search.trim() !== "";
  const clearFilters = () => {
    setPageSearch("");
    setStatusFilter("all");
    setModeFilter(null);
    setCityFilter("");
  };

  const stats = useMemo(
    () => ({
      total: rules.length,
      active: rules.filter((r) => r.active).length,
      inactive: rules.filter((r) => !r.active).length,
    }),
    [rules],
  );
  const cities = useMemo(() => {
    const byKey = new Map<string, string>();
    rules.forEach((r) => {
      if (r.city && !byKey.has(cityKey(r.city)))
        byKey.set(cityKey(r.city), r.city);
    });
    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [rules]);

  // ---- actions ----
  const openCreate = () => {
    setEditing(null);
    setFormError("");
    setFormFields(undefined);
    setFormOpen(true);
  };
  const openEdit = (r: PricingRule) => {
    setEditing(r);
    setFormError("");
    setFormFields(undefined);
    setFormOpen(true);
  };

  async function save(input: PricingRuleInput) {
    setSaving(true);
    setFormError("");
    setFormFields(undefined);
    try {
      const saved = await adminPricingApi.save(input, labelFor(input));
      setFormOpen(false);
      await load();
      flash(
        `Pricing rule for “${labelFor(saved)}” ${editing ? "updated" : "created"}`,
      );
    } catch (e) {
      const err = e as PricingApiError;
      setFormError(err.message);
      setFormFields(err.fields);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(r: PricingRule) {
    const next = !r.active;
    setRules((prev) =>
      prev.map((x) => (x.id === r.id ? { ...x, active: next } : x)),
    );
    setBusyIds((b) => new Set(b).add(r.id));
    try {
      await adminPricingApi.setActive(r, next, labelFor(r));
      flash(`Rule for “${labelFor(r)}” ${next ? "activated" : "deactivated"}`);
    } catch (e) {
      setRules((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, active: r.active } : x)),
      );
      flash((e as PricingApiError).message, "error");
    } finally {
      setBusyIds((b) => {
        const n = new Set(b);
        n.delete(r.id);
        return n;
      });
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await adminPricingApi.remove(toDelete, labelFor(toDelete));
      flash(`Rule for “${labelFor(toDelete)}” removed`);
      setToDelete(null);
      await load();
    } catch (e) {
      flash((e as PricingApiError).message, "error");
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  async function openAudit() {
    setAuditOpen(true);
    try {
      setAudit(await adminPricingApi.auditLog());
    } catch {
      setAudit([]);
    }
  }

  const mode = getPricingApiMode();
  const noCatalog = !loading && categories.length === 0;

  return (
    <div className="admin-page-container cat-page svc-page prc-page">
      <PageHeader
        title="Pricing"
        description="Price rules per category or service: fixed or hourly price, add-ons, surge windows, cancellation fee and city-specific overrides."
        actions={
          <div className="cat-head-actions">
            <button
              type="button"
              className="hcx-btn"
              onClick={() => void openAudit()}
            >
              <History size={16} /> Audit log
            </button>
            <PermissionGate permission={PRICING_MANAGE}>
              <button
                type="button"
                className="hcx-btn hcx-btn--primary"
                onClick={openCreate}
                disabled={!online || loading || noCatalog}
              >
                <Plus size={16} /> Create rule
              </button>
            </PermissionGate>
          </div>
        }
      />

      <PageSearch placeholder="Search service, category, city or mode…" />

      {!online && (
        <div className="cat-banner" role="status">
          <WifiOff size={15} /> You are offline. You can browse what has loaded,
          but changes are disabled until the connection returns.
        </div>
      )}
      {mode === "demo" && (
        <div className="cat-banner" role="status">
          <WifiOff size={15} /> Backend not reachable (
          {getPricingApiModeReason()}): showing local demo data. Changes are
          saved in this browser only.
        </div>
      )}
      {!canManage && (
        <div className="cat-banner cat-banner--info" role="status">
          You can view pricing but need the “{PRICING_MANAGE}” permission to
          change it.
        </div>
      )}
      {noCatalog && !loadError && (
        <div className="cat-banner cat-banner--info" role="status">
          Create a category and a service first, then come back to set pricing.
        </div>
      )}

      {toast && (
        <div
          role="status"
          className={clsx("cat-toast", toast.tone === "error" && "is-error")}
        >
          {toast.tone === "error" ? (
            <XCircle size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}
          <span>{toast.text}</span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="cat-stats">
        <div className="cat-stat">
          <span className="cat-stat__i is-brand">
            <Tag size={18} />
          </span>
          <div>
            <b>{stats.total}</b>
            <small>Total rules</small>
          </div>
        </div>
        <div className="cat-stat">
          <span className="cat-stat__i is-ok">
            <Eye size={18} />
          </span>
          <div>
            <b>{stats.active}</b>
            <small>Active</small>
          </div>
        </div>
        <div className="cat-stat">
          <span className="cat-stat__i is-off">
            <EyeOff size={18} />
          </span>
          <div>
            <b>{stats.inactive}</b>
            <small>Inactive</small>
          </div>
        </div>
      </div>

      <p className="svc-count-note">
        {visible.length} of {rules.length} rules
      </p>

      {loadError && (
        <div role="alert" className="cat-alert">
          {loadError}{" "}
          <button
            type="button"
            className="hcx-btn"
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !loadError && rules.length > 0 && (
        <div className="prc-toolbar">
          <div className="prc-chips" role="radiogroup" aria-label="Status">
            {([["all", "All", stats.total], ["active", "Active", stats.active], ["inactive", "Inactive", stats.inactive]] as const).map(([value, label, n]) => (
              <button key={value} type="button" role="radio" aria-checked={statusFilter === value}
                className={clsx("prc-chip", statusFilter === value && "is-on")} onClick={() => setStatusFilter(value)}>
                {label} <span>{n}</span>
              </button>
            ))}
          </div>
          <div className="prc-seg" role="radiogroup" aria-label="Mode">
            {(["FIXED", "HOURLY"] as const).map((m) => (
              <button key={m} type="button" role="radio" aria-checked={modeFilter === m}
                className={clsx(modeFilter === m && "is-on")} onClick={() => setModeFilter(modeFilter === m ? null : m)}>
                {m === "FIXED" ? "Fixed" : "Hourly"}
              </button>
            ))}
          </div>
          <div className="prc-citysel">
            <select aria-label="City" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}>
              <option value="">All cities</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {filtersActive && <button type="button" className="prc-clear" onClick={clearFilters}>Clear filters</button>}
        </div>
      )}

      {loading ? (
        <div className="cat-skel" aria-label="Loading pricing rules">
          {[0, 1, 2, 3].map((n) => (
            <span
              key={n}
              className="hcx-skeleton hcx-skeleton--block"
              style={{ height: 56 }}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="cat-empty">
          <Tag size={34} aria-hidden />
          <h3>
            {rules.length === 0
              ? "No pricing rules yet"
              : "No rules match your filters"}
          </h3>
          <p>
            {rules.length === 0
              ? "Create a rule to set the price, add-ons and surge windows for a category or service."
              : "Try a different search or clear the filters."}
          </p>
          {rules.length === 0 ? (
            <PermissionGate permission={PRICING_MANAGE}>
              <button
                type="button"
                className="hcx-btn hcx-btn--primary"
                onClick={openCreate}
                disabled={!online || noCatalog}
              >
                <Plus size={16} /> Create rule
              </button>
            </PermissionGate>
          ) : (
            <button type="button" className="hcx-btn" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="hcx-table-card">
          <div className="hcx-table-scroll">
            <table className="hcx-table prc-table" aria-label="Pricing rules">
              <thead>
                <tr>
                  <th scope="col">Service / category</th>
                  <th scope="col">City</th>
                  <th scope="col">Price</th>
                  <th scope="col" className="hcx-hide-sm">
                    Duration
                  </th>
                  <th scope="col" className="hcx-hide-sm">
                    Add-ons
                  </th>
                  <th scope="col" className="hcx-hide-sm">
                    Surge
                  </th>
                  <th scope="col" className="hcx-hide-sm">
                    Cancel fee
                  </th>
                  <th scope="col">Status</th>
                  <th scope="col" className="prc-th-actions">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const busy = busyIds.has(r.id);
                  const name = labelFor(r);
                  return (
                    <tr
                      key={r.id}
                      className={clsx(
                        !r.active && "is-inactive",
                        busy && "is-busy",
                      )}
                    >
                      <td className="prc-td-scope">
                        <div className="prc-scope">
                          <strong>{serviceName(r.serviceId)}</strong>
                          <small>{categoryName(r.categoryId)}</small>
                        </div>
                      </td>
                      <td data-label="City">
                        {r.city || (
                          <span className="prc-muted">All cities</span>
                        )}
                      </td>
                      <td data-label="Price">
                        <b className="prc-price">{rupees(r.basePrice)}</b>
                        <span
                          className={clsx(
                            "prc-mode",
                            r.mode === "HOURLY" && "is-hourly",
                          )}
                        >
                          {r.mode === "HOURLY" ? "per hour" : "fixed"}
                        </span>
                      </td>
                      <td className="hcx-hide-sm" data-label="Duration">
                        <span className="prc-dur">
                          <Clock size={12} aria-hidden />{" "}
                          {duration(r.durationMinutes)}
                        </span>
                      </td>
                      <td className="hcx-hide-sm" data-label="Add-ons">
                        {r.addOns.length || (
                          <span className="prc-muted">—</span>
                        )}
                      </td>
                      <td className="hcx-hide-sm" data-label="Surge windows">
                        {r.surgeWindows.length || (
                          <span className="prc-muted">—</span>
                        )}
                      </td>
                      <td className="hcx-hide-sm" data-label="Cancellation fee">
                        {rupees(r.cancellationFee)}
                      </td>
                      <td data-label="Status">
                        <div className="prc-status">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={r.active}
                            aria-label={`Rule for ${name} is ${r.active ? "active" : "inactive"}`}
                            className={clsx("cat-switch", r.active && "is-on")}
                            disabled={!canManage || !online || busy}
                            onClick={() => void toggle(r)}
                          >
                            <span />
                          </button>
                          <StatusBadge
                            status={r.active ? "Active" : "Inactive"}
                            tone={r.active ? "success" : "neutral"}
                          />
                        </div>
                      </td>
                      <td className="prc-td-actions">
                        <div className="prc-actions">
                          <PermissionGate permission={PRICING_MANAGE}>
                            <button
                              type="button"
                              className="cat-iconbtn"
                              onClick={() => openEdit(r)}
                              disabled={!online}
                              aria-label={`Edit rule for ${name}`}
                              title="Edit"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              type="button"
                              className="cat-iconbtn cat-iconbtn--danger"
                              onClick={() => setToDelete(r)}
                              disabled={!online}
                              aria-label={`Remove rule for ${name}`}
                              title="Remove"
                            >
                              <Trash2 size={16} />
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <PricingRuleForm
        open={formOpen}
        editing={editing}
        categories={categories}
        services={services}
        rules={rules}
        cities={cityOptions}
        saving={saving}
        serverError={serverError}
        serverFields={serverFields}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(null);
          setServerError('');
          setServerFields({});
        }}
        onSubmit={handleSubmit}
      />

      {pendingDelete && (
        <div role="dialog" aria-modal="true" aria-label="Delete pricing rule" className="hcx-fs" style={{ left: 0 }}>
          <div className="hcx-fs__head">
            <div className="hcx-fs__titles">
              <h2>Delete pricing rule?</h2>
            </div>
          </div>
          <div className="hcx-fs__body">
            <div className="hcx-fs__inner">
              <p>
                Remove <strong>{labelForRule(pendingDelete, categories, services)}</strong> from the pricing rules?
              </p>
            </div>
          </div>
          <footer className="hcx-fs__foot">
            <div className="hcx-fs__foot-inner">
              <button type="button" className="hcx-btn" onClick={() => setPendingDelete(null)}>
                Cancel
              </button>
              <button type="button" className="hcx-btn hcx-btn--primary" onClick={() => void handleDelete()}>
                Remove
              </button>
            </div>
          </footer>
        </div>
      )}

      {auditOpen && (
        <div role="dialog" aria-modal="true" aria-label="Pricing audit log" className="hcx-fs" style={{ left: 0 }}>
          <div className="hcx-fs__head">
            <div className="hcx-fs__titles">
              <h2>Pricing audit log</h2>
            </div>
          </div>
          <div className="hcx-fs__body">
            <div className="hcx-fs__inner">
              {auditEntries.length === 0 ? (
                <p>No audit entries yet.</p>
              ) : (
                <ul>
                  {auditEntries.map((entry) => (
                    <li key={entry.id}>{entry.entityName}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <footer className="hcx-fs__foot">
            <div className="hcx-fs__foot-inner">
              <button type="button" className="hcx-btn hcx-btn--primary" onClick={() => setAuditOpen(false)}>
                Close
              </button>
            </div>
          </footer>
        </div>
      )}
        cities={cities}
        saving={saving}
        serverError={formError}
        serverFields={formFields}
        onClose={() => setFormOpen(false)}
        onSubmit={(i) => void save(i)}
      />

      <ConfirmDialog
        open={!!toDelete}
        tone="danger"
        loading={deleting}
        title="Remove pricing rule?"
        confirmLabel="Remove"
        message={
          <>
            The rule for “{toDelete ? labelFor(toDelete) : ""}” will be removed
            and recorded in the audit log. Customers will then be quoted by the
            next most specific rule, or the service’s own price.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />

      <FullScreenPanel
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        title="Pricing audit log"
        subtitle="Every create, edit, status change and removal, with before and after values. Recorded in this browser until the backend has an audit write endpoint."
      >
        {audit.length === 0 ? (
          <p className="cat-note">No activity yet.</p>
        ) : (
          <ul className="cat-audit">
            {audit.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() =>
                    setAuditEntry({
                      id: a.id,
                      actor: a.actor,
                      action: a.action,
                      entity: `Pricing rule · ${a.entityName}`,
                      entityId: a.entityId,
                      time: new Date(a.time).toLocaleString(),
                      before: a.before,
                      after: a.after,
                    })
                  }
                >
                  <StatusBadge
                    status={a.action}
                    tone={
                      a.action === "delete"
                        ? "danger"
                        : a.action === "create"
                          ? "success"
                          : "info"
                    }
                    dot={false}
                  />
                  <span className="cat-audit__n">{a.entityName}</span>
                  <small>{new Date(a.time).toLocaleString()}</small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </FullScreenPanel>
      <AuditDiffDrawer entry={auditEntry} onClose={() => setAuditEntry(null)} />
    </div>
  );
};

export default AdminPricingPage;
