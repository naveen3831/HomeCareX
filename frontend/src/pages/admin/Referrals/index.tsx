import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Gift, Pencil, Plus, Trash2 } from "lucide-react";
import http, { type ApiResponse } from "@/lib/http";
import { usePermissions } from "@/hooks/usePermissions";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { CheckGrid, useCatalogOptions } from "@/components/admin/CatalogScope";
import "./index.css";

type Scope = "ALL" | "CATEGORY" | "SERVICE";
type DiscountType = "PERCENT" | "FLAT";
type Audience = "CUSTOMER" | "PARTNER";

/** Pre-filled suggestion for a NEW offer's wallet credit fields. The admin can change it to any amount. */
const DEFAULT_REWARD = "50";

const AUDIENCE_TABS: { value: Audience; label: string; hint: string }[] = [
  { value: "CUSTOMER", label: "Customer → Customer", hint: "A customer refers a friend who books a service" },
  { value: "PARTNER", label: "Partner → Partner", hint: "A partner refers another partner who completes a job" },
];

interface Program {
  id: string;
  name: string;
  audience?: Audience;
  referrerReward?: number;
  refereeReward?: number;
  scope: Scope;
  categoryIds: string[];
  serviceIds: string[];
  discountType: DiscountType;
  value: number;
  maxDiscount: number | null;
  minOrder: number;
  startAt: string | null;
  endAt: string | null;
  active: boolean;
  usedCount: number;
}

interface Form {
  name: string;
  audience: Audience;
  referrerReward: string;
  refereeReward: string;
  scope: Scope;
  categoryIds: string[];
  serviceIds: string[];
  discountType: DiscountType;
  value: string;
  maxDiscount: string;
  minOrder: string;
  startAt: string;
  endAt: string;
  active: boolean;
}

const EMPTY: Form = {
  name: "",
  audience: "CUSTOMER",
  referrerReward: DEFAULT_REWARD,
  refereeReward: DEFAULT_REWARD,
  scope: "ALL",
  categoryIds: [],
  serviceIds: [],
  discountType: "FLAT",
  value: "",
  maxDiscount: "",
  minOrder: "0",
  startAt: "",
  endAt: "",
  active: true,
};

const SCOPE_OPTIONS: { value: Scope; label: string; hint: string }[] = [
  { value: "ALL", label: "All services", hint: "Every category and service" },
  { value: "CATEGORY", label: "Specific categories", hint: "One or more categories" },
  { value: "SERVICE", label: "Specific services", hint: "One or more services" },
];

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const errorMessage = (err: unknown): string => {
  const e = err as { response?: { data?: { message?: string; error?: { message?: string; details?: { message: string }[] }; details?: { message: string }[] } }; message?: string };
  const data = e.response?.data;
  const details = data?.details ?? data?.error?.details;
  if (details?.length) return details.map((d) => d.message).join(" ");
  return data?.message ?? data?.error?.message ?? e.message ?? "Something went wrong.";
};

export const AdminReferralsPage: React.FC = () => {
  const { can } = usePermissions();
  const catalog = useCatalogOptions();

  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [tab, setTab] = useState<Audience>("CUSTOMER");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [toDelete, setToDelete] = useState<Program | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const res = await http.get<ApiResponse<Program[]>>("/admin/referral-programs");
      setPrograms(res.data.data ?? []);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const names = useMemo(() => {
    const m = new Map<string, string>();
    [...catalog.categories, ...catalog.services].forEach((o) => m.set(o.id, o.name));
    return m;
  }, [catalog.categories, catalog.services]);

  const scopeLabel = (p: Program) => {
    if (p.scope === "ALL") return "All services";
    const ids = p.scope === "CATEGORY" ? p.categoryIds : p.serviceIds;
    const list = ids.map((id) => names.get(id)).filter(Boolean) as string[];
    const prefix = p.scope === "CATEGORY" ? "Categories" : "Services";
    if (list.length === 0) return `${prefix} (${ids.length})`;
    return `${prefix}: ${list.slice(0, 3).join(", ")}${list.length > 3 ? ` +${list.length - 3}` : ""}`;
  };

  const shown = useMemo(() => programs.filter((p) => (p.audience ?? "CUSTOMER") === tab), [programs, tab]);
  const isPartnerTab = tab === "PARTNER";

  const discountLabel = (p: Program) =>
    p.value === 0
      ? "No discount"
      : p.discountType === "PERCENT"
      ? `${p.value}% off${p.maxDiscount ? ` (up to ₹${p.maxDiscount})` : ""}`
      : `₹${p.value} off`;

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY, audience: tab });
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (p: Program) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      audience: p.audience ?? "CUSTOMER",
      referrerReward: String(p.referrerReward ?? 50),
      refereeReward: String(p.refereeReward ?? 50),
      scope: p.scope,
      categoryIds: p.categoryIds,
      serviceIds: p.serviceIds,
      discountType: "FLAT",
      // Old percentage offers: the % value is not a rupee amount, so ask for a flat amount instead.
      value: p.discountType === "PERCENT" ? "" : String(p.value),
      maxDiscount: "",
      minOrder: String(p.minOrder ?? 0),
      startAt: toLocalInput(p.startAt),
      endAt: toLocalInput(p.endAt),
      active: p.active,
    });
    setFormError("");
    setFormOpen(true);
  };

  const closeForm = () => { setFormOpen(false); setEditingId(null); };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(form.value);
    if (!form.name.trim()) return setFormError("Give the referral offer a name.");
    const referrerReward = Number(form.referrerReward);
    const refereeReward = Number(form.refereeReward);
    if (!Number.isFinite(referrerReward) || referrerReward < 0) return setFormError("Enter the referrer's wallet credit (0 or more).");
    if (!Number.isFinite(refereeReward) || refereeReward < 0) return setFormError("Enter the friend's wallet credit (0 or more).");
    const isCustomer = form.audience === "CUSTOMER";
    if (isCustomer && (!Number.isFinite(value) || value < 0)) return setFormError("Enter a discount of 0 or more (0 = wallet credit only).");
    if (isCustomer && form.scope === "CATEGORY" && form.categoryIds.length === 0) return setFormError("Select at least one category.");
    if (isCustomer && form.scope === "SERVICE" && form.serviceIds.length === 0) return setFormError("Select at least one service.");
    const start = form.startAt ? new Date(form.startAt) : null;
    const end = form.endAt ? new Date(form.endAt) : null;
    if (start && end && end <= start) return setFormError("End date must be after the start date.");

    const payload = {
      name: form.name.trim(),
      audience: form.audience,
      referrerReward,
      refereeReward,
      // Partner offers are wallet credit only: no service scope, no booking discount.
      scope: isCustomer ? form.scope : "ALL",
      categoryIds: isCustomer && form.scope === "CATEGORY" ? form.categoryIds : [],
      serviceIds: isCustomer && form.scope === "SERVICE" ? form.serviceIds : [],
      discountType: "FLAT",
      value: isCustomer ? value : 0,
      maxDiscount: null,
      minOrder: isCustomer ? Number(form.minOrder) || 0 : 0,
      startAt: start ? start.toISOString() : null,
      endAt: end ? end.toISOString() : null,
      active: form.active,
    };

    try {
      setSaving(true);
      setFormError("");
      if (editingId) await http.patch(`/admin/referral-programs/${editingId}`, payload);
      else await http.post("/admin/referral-programs", payload);
      setNotice(editingId ? "Referral offer updated." : "Referral offer created.");
      closeForm();
      await load();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Program) => {
    try {
      await http.patch(`/admin/referral-programs/${p.id}`, { active: !p.active });
      setPrograms((rows) => rows.map((r) => (r.id === p.id ? { ...r, active: !p.active } : r)));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      setDeleting(true);
      await http.delete(`/admin/referral-programs/${toDelete.id}`);
      setNotice("Referral offer deleted.");
      setToDelete(null);
      await load();
    } catch (err) {
      setError(errorMessage(err));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const canCreate = can("coupons:create");
  const canUpdate = can("coupons:update");
  const canDelete = can("coupons:delete");

  return (
    <div className="ref-admin">
      <header className="ref-admin__header">
        <div>
          <h1><Gift size={22} aria-hidden="true" /> Referrals</h1>
          <p>
            When someone shares their referral code and a friend joins with it, both get the wallet credit amounts you set on the offer.
            Customers: both are credited as soon as the new friend registers.
            Partners: both after the new partner's first completed job.
          </p>
        </div>
        {canCreate && (
          <button type="button" className="ref-btn ref-btn--primary" onClick={openCreate}>
            <Plus size={16} aria-hidden="true" /> New referral offer
          </button>
        )}
      </header>

      {notice && <div className="ref-alert ref-alert--ok" role="status">{notice}</div>}
      {error && <div className="ref-alert ref-alert--error" role="alert">{error}</div>}

      <div className="ref-tabs" role="tablist" aria-label="Referral type">
        {AUDIENCE_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={tab === t.value}
            className={`ref-tab${tab === t.value ? " is-selected" : ""}`}
            onClick={() => { setTab(t.value); closeForm(); }}
          >
            {t.label}
            <small>{t.hint}</small>
          </button>
        ))}
      </div>

      {formOpen && (
        <form className="ref-card ref-form" onSubmit={save} noValidate>
          <h2>{editingId ? "Edit referral offer" : "New referral offer"}</h2>

          <label className="ref-field">
            <span>Offer name</span>
            <input
              value={form.name}
              maxLength={80}
              placeholder="e.g. Friend's first booking"
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>

          <div className="ref-row">
            <label className="ref-field">
              <span>Referral type</span>
              <select
                value={form.audience}
                onChange={(e) => setForm({ ...form, audience: e.target.value as Audience })}
              >
                {AUDIENCE_TABS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </label>
            <label className="ref-field">
              <span>Referrer wallet credit (₹)</span>
              <input
                type="number"
                min="0"
                value={form.referrerReward}
                onChange={(e) => setForm({ ...form, referrerReward: e.target.value })}
              />
            </label>
            <label className="ref-field">
              <span>New friend wallet credit (₹)</span>
              <input
                type="number"
                min="0"
                value={form.refereeReward}
                onChange={(e) => setForm({ ...form, refereeReward: e.target.value })}
              />
            </label>
          </div>

          {form.audience === "CUSTOMER" && (
          <>

          <div className="ref-row">
            <label className="ref-field">
              <span>Amount off (₹)</span>
              <input
                type="number"
                min="0"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
              />
            </label>
            <label className="ref-field">
              <span>Minimum order (₹)</span>
              <input
                type="number"
                min="0"
                value={form.minOrder}
                onChange={(e) => setForm({ ...form, minOrder: e.target.value })}
              />
            </label>
          </div>

          <fieldset className="ref-scope">
            <legend>Applies to</legend>
            <div className="ref-scope__options">
              {SCOPE_OPTIONS.map((o) => (
                <label key={o.value} className={`ref-scope__option${form.scope === o.value ? " is-selected" : ""}`}>
                  <input
                    type="radio"
                    name="scope"
                    checked={form.scope === o.value}
                    onChange={() => setForm({ ...form, scope: o.value })}
                  />
                  <span>
                    {o.label}
                    <small>{o.hint}</small>
                  </span>
                </label>
              ))}
            </div>

            {form.scope === "CATEGORY" && (
              <CheckGrid
                label="Categories"
                options={catalog.categories}
                selected={form.categoryIds}
                loading={catalog.loading}
                emptyText="No categories available."
                onChange={(categoryIds) => setForm({ ...form, categoryIds })}
              />
            )}
            {form.scope === "SERVICE" && (
              <CheckGrid
                label="Services"
                options={catalog.services}
                selected={form.serviceIds}
                loading={catalog.loading}
                searchable
                emptyText="No services available."
                onChange={(serviceIds) => setForm({ ...form, serviceIds })}
              />
            )}
          </fieldset>
          </>
          )}

          <div className="ref-row">
            <label className="ref-field">
              <span>Starts (optional)</span>
              <input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} />
            </label>
            <label className="ref-field">
              <span>Ends (optional)</span>
              <input type="datetime-local" value={form.endAt} onChange={(e) => setForm({ ...form, endAt: e.target.value })} />
            </label>
            <label className="ref-check">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <span>Active</span>
            </label>
          </div>

          {formError && <div className="ref-alert ref-alert--error" role="alert">{formError}</div>}

          <div className="ref-actions">
            <button type="button" className="ref-btn" onClick={closeForm} disabled={saving}>Cancel</button>
            <button type="submit" className="ref-btn ref-btn--primary" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save changes" : "Create offer"}
            </button>
          </div>
        </form>
      )}

      <section className="ref-card">
        {loading ? (
          <p className="ref-muted">Loading…</p>
        ) : shown.length === 0 ? (
          <p className="ref-muted">
            No {isPartnerTab ? "partner-to-partner" : "customer-to-customer"} referral offers yet. Create one to set the wallet credit for the referrer and the new friend.
          </p>
        ) : (
          <div className="ref-table-wrap">
            <table className="ref-table">
              <thead>
                <tr>
                  <th>Offer</th>
                  <th>Wallet credit</th>
                  {!isPartnerTab && <th>Discount</th>}
                  {!isPartnerTab && <th>Applies to</th>}
                  <th>Validity</th>
                  {!isPartnerTab && <th>Used</th>}
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Offer"><strong>{p.name}</strong></td>
                    <td data-label="Wallet credit">
                      ₹{p.referrerReward ?? 50} referrer
                      <small>₹{p.refereeReward ?? 50} new friend</small>
                    </td>
                    {!isPartnerTab && (
                      <td data-label="Discount">
                        {discountLabel(p)}
                        {p.minOrder > 0 && <small>Min order ₹{p.minOrder}</small>}
                      </td>
                    )}
                    {!isPartnerTab && <td data-label="Applies to">{scopeLabel(p)}</td>}
                    <td data-label="Validity">
                      {p.startAt || p.endAt
                        ? `${p.startAt ? new Date(p.startAt).toLocaleDateString() : "Now"} – ${p.endAt ? new Date(p.endAt).toLocaleDateString() : "No end"}`
                        : "Always"}
                    </td>
                    {!isPartnerTab && <td data-label="Used">{p.usedCount}</td>}
                    <td data-label="Status">
                      <div className="ref-switch-wrap">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={p.active}
                          className={`ref-switch${p.active ? " is-on" : ""}`}
                          onClick={() => void toggleActive(p)}
                          disabled={!canUpdate}
                          aria-label={`${p.active ? "Deactivate" : "Activate"} ${p.name}`}
                        >
                          <span className="ref-switch__knob" />
                        </button>
                        <span className={`ref-switch__label${p.active ? " is-on" : ""}`}>{p.active ? "Active" : "Inactive"}</span>
                      </div>
                    </td>
                    <td className="ref-table__actions">
                      {canUpdate && (
                        <button type="button" className="ref-icon" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`}>
                          <Pencil size={16} />
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" className="ref-icon ref-icon--danger" onClick={() => setToDelete(p)} aria-label={`Delete ${p.name}`}>
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={!!toDelete}
        title="Delete referral offer?"
        message={<>“{toDelete?.name}” will stop applying to new first bookings. Past bookings keep their discount.</>}
        confirmLabel="Delete"
        tone="danger"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
};

export default AdminReferralsPage;
