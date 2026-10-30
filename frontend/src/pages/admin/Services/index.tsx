import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, Eye, EyeOff, History, Package, Plus, WifiOff, X, XCircle,
} from 'lucide-react';
import clsx from 'clsx';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/admin/PageHeader';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { FullScreenPanel } from '@/components/admin/FullScreenPanel';
import { AuditDiffDrawer, type AuditEntry } from '@/components/admin/AuditDiffDrawer';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { CategoryFilterMenu } from '@/components/admin/CategoryFilterMenu';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { ServiceForm, type CategoryOption } from '@/components/admin/ServiceForm';
import { ServicePreview } from '@/components/admin/ServicePreview';
import { usePermissions } from '@/hooks/usePermissions';
import { useUIStore } from '@/store/useUIStore';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { adminServiceApi, getServiceApiMode, getServiceApiModeReason, type ServiceApiError } from '@/services/adminServiceApi';
import { adminCategoryApi } from './adminCategoryApi';
import type { AdminCategory } from '@/types/adminCatalog';
import {
  type AdminService, type ServiceAuditEntry, type ServiceErrors, type ServiceInput, type ServiceImage,
} from '@/types/adminService';
import '../Categories/index.css';
import './index.css';

export const CATALOG_MANAGE = 'catalog:manage';

type Toast = { text: string; tone: 'success' | 'error' } | null;
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** "Parent › Child" labels so sub-categories are recognisable in a flat list. */
function toOptions(cats: AdminCategory[]): CategoryOption[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  return cats
    .map((c) => ({ id: c.id, name: c.parentId && byId.get(c.parentId) ? `${byId.get(c.parentId)!.name} › ${c.name}` : c.name, active: c.active }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const toInput = (s: AdminService): ServiceInput => ({
  name: s.name, categoryId: s.categoryId, description: s.description, basePrice: s.basePrice, durationMinutes: s.durationMinutes,
  images: s.images, inclusions: s.inclusions, exclusions: s.exclusions, faqs: s.faqs, addOns: s.addOns, checklist: s.checklist, active: s.active,
});

export const AdminServicesPage: React.FC = () => {
  const online = useOnlineStatus();
  const { can } = usePermissions();
  const canManage = can(CATALOG_MANAGE);

  const [items, setItems] = useState<AdminService[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // Search text comes from the search bar below the navbar (same as Manage Partners).
  const search = useUIStore((state) => state.pageSearch);
  const setPageSearch = useUIStore((state) => state.setPageSearch);
  useEffect(() => { setPageSearch(''); }, [setPageSearch]);
  const [order] = useState<string[]>(() => adminServiceApi.getOrder());
  const [params, setParams] = useSearchParams();
  const [previewing, setPreviewing] = useState<AdminService | null>(null);
  const [savingImages, setSavingImages] = useState(false);

  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number>();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<'activate' | 'deactivate' | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminService | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [formFields, setFormFields] = useState<ServiceErrors | undefined>();

  const [toDelete, setToDelete] = useState<AdminService | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState<ServiceAuditEntry[]>([]);
  const [auditEntry, setAuditEntry] = useState<AuditEntry | null>(null);

  const flash = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    setToast({ text, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 5500);
  }, []);
  useEffect(() => () => window.clearTimeout(toastTimer.current), []);

  const load = useCallback(async () => {
    try {
      // Categories first: it decides the categories' live/demo mode, which the services store follows for counts.
      const cats = await adminCategoryApi.list().catch(() => [] as AdminCategory[]);
      setCategories(cats);
      setItems(await adminServiceApi.list());
      setLoadError('');
    } catch (e) {
      setLoadError((e as ServiceApiError).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelectedIds((prev) => prev.filter((id) => items.some((x) => x.id === id))); }, [items]);

  const options = useMemo(() => toOptions(categories), [categories]);

  // ---- derived list ----
  const categoryParam = params.get('category') ?? '';
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const filtered = search.trim() !== '' || searchTerm.trim() !== '' || statusFilter !== 'all' || categoryParam !== '';

  // Saved manual order first; services not in it yet (new ones) sit on top, newest first.
  const ordered = useMemo(() => {
    const pos = new Map(order.map((id, n) => [id, n]));
    const known = items.filter((s) => pos.has(s.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
    const fresh = items.filter((s) => !pos.has(s.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return [...fresh, ...known];
  }, [items, order]);

  const visible = useMemo(() => {
    const needle = (search || searchTerm).trim().toLowerCase();
    // A parent category also shows its sub-categories' services.
    const catIds = new Set(categoryParam ? [categoryParam, ...categories.filter((c) => c.parentId === categoryParam).map((c) => c.id)] : []);
    return ordered.filter((s) => {
      if (categoryParam && !catIds.has(s.categoryId)) return false;
      if (statusFilter === 'active' && !s.active) return false;
      if (statusFilter === 'inactive' && s.active) return false;
      if (!needle) return true;
      return [s.name, s.slug, s.categoryName].some((v) => (v ?? '').toLowerCase().includes(needle));
    });
  }, [ordered, categories, search, searchTerm, statusFilter, categoryParam]);

  // Category filter: parents include their sub-categories' services, so counts follow what the filter will show.
  const filterOptions = useMemo(() => {
    const countFor = (id: string) => {
      const ids = new Set([id, ...categories.filter((c) => c.parentId === id).map((c) => c.id)]);
      return items.filter((s) => ids.has(s.categoryId)).length;
    };
    return options.map((o) => ({ ...o, count: countFor(o.id) }));
  }, [options, categories, items]);
  const chooseCategory = (id: string) => setParams(id ? { category: id } : {});
  const filterMenu = <CategoryFilterMenu options={filterOptions} value={categoryParam} onChange={chooseCategory} total={visible.length} />;

  const stats = useMemo(() => ({
    total: items.length, active: items.filter((s) => s.active).length, inactive: items.filter((s) => !s.active).length,
  }), [items]);

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const selectedServices = useMemo(() => items.filter((x) => selectedIds.includes(x.id)), [items, selectedIds]);

  const bulkActionLabel = bulkAction === 'activate' ? 'Activate' : bulkAction === 'deactivate' ? 'Deactivate' : '';

  async function runBulkAction(action: 'activate' | 'deactivate') {
    const ids = [...selectedIds];
    if (!ids.length) return;
    try {
      const result = await adminServiceApi.setActive(ids, action === 'activate');
      const failed = result.failed;
      const changed = result.changed.length;
      const failedText = failed.length ? `, ${failed.length} failed: ${failed.map((f) => `${f.name} (${f.message})`).join(', ')}` : '';
      flash(`${changed} ${action === 'activate' ? 'activated' : 'deactivated'}${failedText}`);
      if (failed.length === 0 || changed > 0) setSelectedIds([]);
    } catch (e) {
      flash((e as ServiceApiError).message, 'error');
    }
  }

  async function confirmBulkAction() {
    if (!bulkAction || selectedIds.length === 0) return;
    const action = bulkAction;
    setBulkAction(null);
    await runBulkAction(action);
  }

  // Arriving from a category row ("Add service") opens the form with that category already chosen.
  useEffect(() => {
    if (loading || params.get('new') !== '' && params.get('new') !== '1') return;
    if (canManage) { setEditing(null); setFormError(''); setFormFields(undefined); setFormOpen(true); }
    const next = new URLSearchParams(params); next.delete('new'); setParams(next, { replace: true });
  }, [loading, params, canManage, setParams]);

  // ---- actions ----
  const openCreate = () => { setEditing(null); setFormError(''); setFormFields(undefined); setFormOpen(true); };

  async function save(input: ServiceInput) {
    setSaving(true); setFormError(''); setFormFields(undefined);
    try {
      const { service, ignored, localOnly } = editing
        ? await adminServiceApi.update(editing.id, input, options)
        : await adminServiceApi.create(input, options);
      setFormOpen(false);
      await load();
      if (ignored.length) flash(`“${service.name}” saved, but ${ignored.join(', ')} could not be kept: browser storage is full. Use smaller or fewer images.`, 'error');
      else {
        const extraWarning = localOnly?.length ? ` (did not store: ${localOnly.join(', ')}; kept in this browser until the backend stores them)` : '';
        flash(`${editing ? `“${service.name}” updated` : `“${service.name}” created and added to the catalog`}${extraWarning}`, localOnly?.length ? 'error' : 'success');
      }
    } catch (e) {
      const err = e as ServiceApiError;
      setFormError(err.message);
      setFormFields(err.fields);
    } finally { setSaving(false); }
  }

  async function saveImages(svc: AdminService, images: ServiceImage[]) {
    setSavingImages(true);
    try {
      const { service } = await adminServiceApi.update(svc.id, { ...toInput(svc), images }, options);
      setItems((prev) => prev.map((x) => (x.id === service.id ? service : x)));
      setPreviewing(service);
      flash(`Photos for “${service.name}” saved`);
    } catch (e) {
      flash((e as ServiceApiError).message, 'error');
    } finally { setSavingImages(false); }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await adminServiceApi.remove(toDelete.id);
      flash(`“${toDelete.name}” deleted`);
      setToDelete(null);
      await load();
    } catch (e) {
      flash((e as ServiceApiError).message, 'error');
      setToDelete(null);
    } finally { setDeleting(false); }
  }

  async function openAudit() {
    setAuditOpen(true);
    try { setAudit(await adminServiceApi.auditLog()); } catch { setAudit([]); }
  }

  const mode = getServiceApiMode();

  return (
    <div className="admin-page-container cat-page svc-page">
      <PageHeader
        title="Services"
        description="Everything customers can book: category, photos, price, duration, what is and is not included, FAQs, add-ons and the on-site checklist."
        actions={
          <div className="cat-head-actions">
            <button type="button" className="hcx-btn" onClick={() => void openAudit()}><History size={16} /> Audit log</button>
            <PermissionGate permission={CATALOG_MANAGE}>
              <button type="button" className="hcx-btn hcx-btn--primary" onClick={openCreate} disabled={!online || loading}><Plus size={16} /> New service</button>
            </PermissionGate>
          </div>
        }
      />

      {!online && <div className="cat-banner" role="status"><WifiOff size={15} /> You are offline. You can browse what has loaded, but changes are disabled until the connection returns.</div>}
      {mode === 'demo' && <div className="cat-banner" role="status"><WifiOff size={15} /> Backend not reachable ({getServiceApiModeReason()}): showing local demo data. Changes are saved in this browser only.</div>}
      {!canManage && <div className="cat-banner cat-banner--info" role="status">You can view services but need the “{CATALOG_MANAGE}” permission to change them.</div>}

      {toast && (
        <div role="status" className={clsx('cat-toast', toast.tone === 'error' && 'is-error')}>
          {toast.tone === 'error' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}<span>{toast.text}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      <div className="cat-stats">
        <div className="cat-stat"><span className="cat-stat__i is-brand"><Package size={18} /></span><div><b>{stats.total}</b><small>Total</small></div></div>
        <div className="cat-stat"><span className="cat-stat__i is-ok"><Eye size={18} /></span><div><b>{stats.active}</b><small>Active</small></div></div>
        <div className="cat-stat"><span className="cat-stat__i is-off"><EyeOff size={18} /></span><div><b>{stats.inactive}</b><small>Inactive</small></div></div>
      </div>

      {canManage && selectedServices.length > 0 && (
        <div className="cat-toolbar cat-toolbar--bulk" role="toolbar" aria-label="Bulk actions">
          <span>{selectedServices.length} selected</span>
          <div className="cat-head-actions">
            <button type="button" className="hcx-btn" onClick={() => void runBulkAction('activate')}>Activate</button>
            <button type="button" className="hcx-btn" onClick={() => setBulkAction('deactivate')}>Deactivate</button>
            <button type="button" className="hcx-btn" onClick={() => setSelectedIds([])}>Clear</button>
          </div>
        </div>
      )}

      <div className="svc-toolbar">
        <label className="svc-filter" htmlFor="svc-status-filter">
          <span>Filter by status</span>
          <select id="svc-status-filter" aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <label className="svc-search" htmlFor="svc-search-input">
          <span className="sr-only">Search services</span>
          <input id="svc-search-input" type="search" aria-label="Search services" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search services" />
        </label>
        {filterMenu}
      </div>
      <p className="svc-count-note">{visible.length} of {items.length} services{categoryParam && filterOptions.find((o) => o.id === categoryParam) ? ` in ${filterOptions.find((o) => o.id === categoryParam)!.name}` : ''}</p>
      {loadError && <div role="alert" className="cat-alert">{loadError} <button type="button" className="hcx-btn" onClick={() => { setLoading(true); void load(); }}>Try again</button></div>}

      {filtered && (
        <button type="button" className="hcx-btn" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setParams({}); setPageSearch(''); }}>Clear filters</button>
      )}

      {loading ? (
        <table className="hcx-table" aria-label="Services" aria-busy="true">
          <thead>
            <tr>
              {canManage && <th scope="col" className="hcx-table__check"><span className="sr-only">Select</span></th>}
              <th scope="col">Name</th>
              <th scope="col">Category</th>
              <th scope="col">Price</th>
              <th scope="col">Status</th>
              {canManage && <th scope="col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {[0,1,2,3].map((n) => (
              <tr key={n}><td colSpan={canManage ? 6 : 5}><span className="hcx-skeleton hcx-skeleton--row" /></td></tr>
            ))}
          </tbody>
        </table>
      ) : visible.length === 0 ? (
        <div className="cat-empty">
          <Package size={34} aria-hidden />
          <h3>{items.length === 0 ? 'No services yet' : 'No services match your filters'}</h3>
          <p>{items.length === 0 ? 'Create your first service and it will appear in the customer catalog.' : 'Try a different search or category.'}</p>
          {items.length === 0
            ? <PermissionGate permission={CATALOG_MANAGE}><button type="button" className="hcx-btn hcx-btn--primary" onClick={openCreate} disabled={!online}><Plus size={16} /> New service</button></PermissionGate>
            : <button type="button" className="hcx-btn" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setParams({}); setPageSearch(''); }}>Clear filters</button>}
        </div>
      ) : (
        <table className="hcx-table" aria-label="Services" aria-busy={loading ? 'true' : 'false'}>
          <thead>
            <tr>
              {canManage && <th scope="col" className="hcx-table__check"><span className="sr-only">Select</span></th>}
              <th scope="col">Name</th>
              <th scope="col">Category</th>
              <th scope="col">Price</th>
              <th scope="col">Status</th>
              {canManage && <th scope="col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visible.map((s) => (
              <tr key={s.id}>
                {canManage && (
                  <td className="hcx-table__check">
                    <input type="checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelected(s.id)} aria-label={`Select row ${s.id}`} />
                  </td>
                )}
                <td>{s.name}</td>
                <td>{s.categoryName || '—'}</td>
                <td>{rupees(s.basePrice)}</td>
                <td>{s.active ? 'Active' : 'Inactive'}</td>
                {canManage && (
                  <td>
                    <button type="button" className="hcx-btn hcx-btn--danger-ghost" onClick={() => setToDelete(s)} aria-label={`Delete ${s.name}`}>Delete</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <ServicePreview service={previewing} canManage={canManage && online} saving={savingImages} onClose={() => setPreviewing(null)} onSaveImages={(svc, imgs) => void saveImages(svc, imgs)} />

      <ServiceForm
        open={formOpen} editing={editing} presetCategoryId={categoryParam || undefined} categories={options} saving={saving} serverError={formError} serverFields={formFields}
        onClose={() => setFormOpen(false)} onSubmit={(i) => void save(i)}
      />

      <ConfirmDialog
        open={!!toDelete} tone="danger" loading={deleting} title="Delete service?" confirmLabel="Delete"
        message={<>“{toDelete?.name}” will be permanently removed and recorded in the audit log. A service that already has bookings cannot be deleted; deactivate it instead.</>}
        onCancel={() => setToDelete(null)} onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={Boolean(bulkAction)} loading={false} title={bulkAction === 'activate' ? 'Activate selected services?' : 'Deactivate selected services?'} confirmLabel={bulkAction ? bulkActionLabel : 'Confirm'}
        message={<>This will update {selectedServices.length} selected service{selectedServices.length === 1 ? '' : 's'}.</>}
        onCancel={() => setBulkAction(null)} onConfirm={() => void confirmBulkAction()}
      />

      <FullScreenPanel open={auditOpen} onClose={() => setAuditOpen(false)} title="Service audit log" subtitle="Every create, edit, status change and delete, with before and after values. Recorded in this browser until the backend has an audit write endpoint.">
        {audit.length === 0 ? <p className="cat-note">No activity yet.</p> : (
          <ul className="cat-audit">
            {audit.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setAuditEntry({
                  id: a.id, actor: a.actor, action: a.action, entity: `Service · ${a.entityName}`, entityId: a.entityId,
                  time: new Date(a.time).toLocaleString(), before: a.before, after: a.after,
                })}>
                  <StatusBadge status={a.action} tone={a.action === 'delete' ? 'danger' : a.action === 'create' ? 'success' : 'info'} dot={false} />
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

export default AdminServicesPage;
