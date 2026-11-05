import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  CheckCircle2, Eye, EyeOff, History, ImageIcon, Package, Pencil, Plus, Trash2, WifiOff, X, XCircle, Clock, ArrowDown, ArrowUp, GripVertical,
} from 'lucide-react';
import clsx from 'clsx';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/admin/PageHeader';
import { ConfirmDialog } from '@/components/admin/ConfirmDialog';
import { FullScreenPanel } from '@/components/admin/FullScreenPanel';
import { AuditDiffDrawer, type AuditEntry } from '@/components/admin/AuditDiffDrawer';
import { StatusBadge } from '@/components/admin/StatusBadge';
import { PageSearch } from '@/components/admin/PageSearch';
import { BulkActionBar } from '@/components/admin/BulkActionBar';
import { CategoryFilterMenu } from '@/components/admin/CategoryFilterMenu';
import { PermissionGate } from '@/components/admin/PermissionGate';
import { ServiceForm, type CategoryOption } from '@/components/admin/ServiceForm';
import { ServicePreview } from '@/components/admin/ServicePreview';
import { usePermissions } from '@/hooks/usePermissions';
import { useUIStore } from '@/store/useUIStore';
import { TablePagination, usePagination } from '@/components/tables';
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
const duration = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}`);

interface ServiceRowProps {
  s: AdminService;
  index: number;
  count: number;
  busy: boolean;
  reorderEnabled: boolean;
  canManage: boolean;
  online: boolean;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
  onPreview: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ServiceRow: React.FC<ServiceRowProps> = ({
  s, index, count, busy, reorderEnabled, canManage, online, selected,
  onSelect, onMove, onToggle, onPreview, onEdit, onDelete,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: s.id,
    disabled: !reorderEnabled,
  });
  const cover = s.images.find((image) => image.isPrimary) ?? s.images[0];
  const canChange = canManage && online;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={clsx('cat-row', 'svc-row-item', !s.active && 'is-inactive', isDragging && 'is-dragging', busy && 'is-busy')}
    >
      <button
        type="button"
        className="cat-grip"
        disabled={!reorderEnabled || busy}
        aria-label={`Drag ${s.name}`}
        title={reorderEnabled ? 'Drag to reorder' : 'Clear the search to drag'}
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} />
      </button>
      <input
        type="checkbox"
        checked={selected}
        onChange={(event) => onSelect(event.currentTarget.checked)}
        disabled={!canChange || busy}
        aria-label={`Select ${s.name}`}
      />
      <span className={clsx('cat-media', !s.active && 'is-off')}>
        <span className="cat-cover">
          {cover
            ? <img src={cover.url} alt="" loading="lazy" />
            : <span className="cat-cover__empty"><ImageIcon size={18} /></span>}
        </span>
      </span>
      <div className="cat-main">
        <div className="cat-name"><span>{s.name}</span></div>
        <div className="cat-sub"><code>/{s.slug}</code><span>{s.categoryName}</span></div>
        <div className="cat-pills">
          <span className="cat-pill"><b>{rupees(s.basePrice)}</b></span>
          <span className="cat-pill"><Clock size={11} aria-hidden /> {duration(s.durationMinutes)}</span>
        </div>
      </div>
      <div className="cat-actions">
        <span className="cat-actions__move">
          <button type="button" className="cat-iconbtn" onClick={() => onMove(-1)} disabled={!reorderEnabled || index === 0 || busy} aria-label={`Move ${s.name} up`} title="Move up"><ArrowUp size={15} /></button>
          <button type="button" className="cat-iconbtn" onClick={() => onMove(1)} disabled={!reorderEnabled || index === count - 1 || busy} aria-label={`Move ${s.name} down`} title="Move down"><ArrowDown size={15} /></button>
        </span>
        <button type="button" className="cat-iconbtn" onClick={onPreview} aria-label={`Preview ${s.name}`} title="Preview"><Eye size={15} /></button>
        <button type="button" className="cat-iconbtn" onClick={onEdit} disabled={!canChange} aria-label={`Edit ${s.name}`} title="Edit"><Pencil size={15} /></button>
        <button type="button" className="cat-iconbtn cat-iconbtn--danger" onClick={onDelete} disabled={!canChange} aria-label={`Delete ${s.name}`} title="Delete"><Trash2 size={15} /></button>
        <button
          type="button"
          role="switch"
          aria-checked={s.active}
          className={clsx('cat-toggle', s.active && 'is-on')}
          onClick={onToggle}
          disabled={!canChange || busy}
          aria-label={`${s.active ? 'Deactivate' : 'Activate'} ${s.name}`}
          title={s.active ? 'Visible to customers. Click to hide.' : 'Hidden from customers. Click to show.'}
        >
          <span className="cat-toggle__track"><i /></span>
          <span className="cat-toggle__text">{s.active ? 'Active' : 'Inactive'}</span>
        </button>
      </div>
    </li>
  );
};

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
  const [order, setOrder] = useState<string[]>(() => adminServiceApi.getOrder());
  const [params, setParams] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(() => new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [previewing, setPreviewing] = useState<AdminService | null>(null);
  const [savingImages, setSavingImages] = useState(false);

  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number>();

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

  const options = useMemo(() => toOptions(categories), [categories]);

  // ---- derived list ----
  const categoryParam = params.get('category') ?? '';
  const filtered = search.trim() !== '' || categoryParam !== '';
  const reorderEnabled = !filtered && canManage && online;

  // Saved manual order first; services not in it yet (new ones) sit on top, newest first.
  const ordered = useMemo(() => {
    const pos = new Map(order.map((id, n) => [id, n]));
    const known = items.filter((s) => pos.has(s.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
    const fresh = items.filter((s) => !pos.has(s.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return [...fresh, ...known];
  }, [items, order]);

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    // A parent category also shows its sub-categories' services.
    const catIds = new Set(categoryParam ? [categoryParam, ...categories.filter((c) => c.parentId === categoryParam).map((c) => c.id)] : []);
    return ordered.filter((s) => {
      if (categoryParam && !catIds.has(s.categoryId)) return false;
      if (!needle) return true;
      return [s.name, s.slug, s.categoryName].some((v) => (v ?? '').toLowerCase().includes(needle));
    });
  }, [ordered, categories, search, categoryParam]);
  const pager = usePagination(visible, { resetKey: `${search}|${categoryParam}` });
  const pageOffset = (pager.page - 1) * pager.pageSize;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function applyOrder(ids: string[], movedId: string, from: number, to: number) {
    const name = items.find((x) => x.id === movedId)?.name ?? 'Service';
    setOrder(ids);
    adminServiceApi.reorder(ids, { id: movedId, name, from, to });
    flash(`“${name}” moved to position ${to + 1}`);
  }
  const move = (id: string, dir: -1 | 1) => {
    const ids = ordered.map((x) => x.id); const from = ids.indexOf(id); const to = from + dir;
    if (to < 0 || to >= ids.length) return;
    applyOrder(arrayMove(ids, from, to), id, from, to);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over || e.active.id === e.over.id) return;
    const ids = ordered.map((x) => x.id);
    const from = ids.indexOf(String(e.active.id)); const to = ids.indexOf(String(e.over.id));
    if (from > -1 && to > -1) applyOrder(arrayMove(ids, from, to), String(e.active.id), from, to);
  };
  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const activeSvc = items.find((x) => x.id === activeId) ?? null;

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

  // Arriving from a category row ("Add service") opens the form with that category already chosen.
  useEffect(() => {
    if (loading || params.get('new') !== '' && params.get('new') !== '1') return;
    if (canManage) { setEditing(null); setFormError(''); setFormFields(undefined); setFormOpen(true); }
    const next = new URLSearchParams(params); next.delete('new'); setParams(next, { replace: true });
  }, [loading, params, canManage, setParams]);

  // ---- actions ----
  const openCreate = () => { setEditing(null); setFormError(''); setFormFields(undefined); setFormOpen(true); };
  const openEdit = (s: AdminService) => { setEditing(s); setFormError(''); setFormFields(undefined); setFormOpen(true); };

  async function save(input: ServiceInput) {
    setSaving(true); setFormError(''); setFormFields(undefined);
    try {
      const { service, ignored, localOnly } = editing
        ? await adminServiceApi.update(editing.id, input, options)
        : await adminServiceApi.create(input, options);
      setFormOpen(false);
      await load();
      if (ignored.length) flash(`“${service.name}” saved, but ${ignored.join(', ')} could not be kept: browser storage is full. Use smaller or fewer images.`, 'error');
      else flash(`${editing ? `“${service.name}” updated` : `“${service.name}” created and added to the catalog`}${localOnly?.length ? ` (${localOnly.join(', ')} are kept in this browser until the backend stores them)` : ''}`);
    } catch (e) {
      const err = e as ServiceApiError;
      setFormError(err.message);
      setFormFields(err.fields);
    } finally { setSaving(false); }
  }

  async function toggle(s: AdminService) {
    const next = !s.active;
    setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: next } : x)));
    setBusyIds((b) => new Set(b).add(s.id));
    try {
      await adminServiceApi.setActive([s.id], next);
      flash(`“${s.name}” ${next ? 'activated' : 'deactivated'}`);
    } catch (e) {
      setItems((prev) => prev.map((x) => (x.id === s.id ? { ...x, active: s.active } : x)));
      flash((e as ServiceApiError).message, 'error');
    } finally {
      setBusyIds((b) => { const n = new Set(b); n.delete(s.id); return n; });
    }
  }

  /** Bulk activate / deactivate every selected service (one PATCH per service; failures are listed). */
  async function bulkSetActive(next: boolean) {
    const ids = items.filter((x) => selectedIds.has(x.id)).map((x) => x.id);
    if (ids.length === 0) return;
    setBusyIds((b) => new Set([...b, ...ids]));
    try {
      const result = await adminServiceApi.setActive(ids, next);
      const changed = new Set(result.changed);
      setItems((prev) => prev.map((x) => (changed.has(x.id) ? { ...x, active: next } : x)));
      const verb = next ? 'activated' : 'deactivated';
      if (result.failed.length) {
        flash(`${result.changed.length} ${verb}, ${result.failed.length} failed: ${result.failed.map((f) => `${f.name} (${f.message})`).join('; ')}`, 'error');
      } else {
        flash(result.changed.length ? `${result.changed.length} service${result.changed.length === 1 ? '' : 's'} ${verb}` : `Already ${next ? 'active' : 'inactive'}`);
      }
      setSelectedIds(new Set(result.failed.map((f) => f.id)));
    } catch (e) {
      flash((e as ServiceApiError).message, 'error');
    } finally {
      setBusyIds((b) => { const n = new Set(b); ids.forEach((id) => n.delete(id)); return n; });
    }
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

      <div className="svc-toolbar">
        <PageSearch placeholder="Search name, slug or category…" />
        {filterMenu}
      </div>
      <p className="svc-count-note">{visible.length} of {items.length} services{categoryParam && filterOptions.find((o) => o.id === categoryParam) ? ` in ${filterOptions.find((o) => o.id === categoryParam)!.name}` : ''}</p>
      {filtered && <p className="cat-note">Drag-and-drop and Move Up/Down are paused while a search or category filter is active.</p>}

      {loadError && <div role="alert" className="cat-alert">{loadError} <button type="button" className="hcx-btn" onClick={() => { setLoading(true); void load(); }}>Retry</button></div>}

      {loading ? (
        <div className="cat-skel" aria-label="Loading services">{[0, 1, 2, 3, 4].map((n) => <span key={n} className="hcx-skeleton hcx-skeleton--block" style={{ height: 78 }} />)}</div>
      ) : visible.length === 0 ? (
        <div className="cat-empty">
          <Package size={34} aria-hidden />
          <h3>{items.length === 0 ? 'No services yet' : 'No services match your filters'}</h3>
          <p>{items.length === 0 ? 'Create your first service and it will appear in the customer catalog.' : 'Try a different search or category.'}</p>
          {items.length === 0
            ? <PermissionGate permission={CATALOG_MANAGE}><button type="button" className="hcx-btn hcx-btn--primary" onClick={openCreate} disabled={!online}><Plus size={16} /> New service</button></PermissionGate>
            : <button type="button" className="hcx-btn" onClick={() => { setPageSearch(''); setParams({}); }}>Clear filters</button>}
        </div>
      ) : (
        <>
          {canManage && (
            <BulkActionBar
              selectedCount={selectedIds.size} noun="services"
              onClear={() => setSelectedIds(new Set())}
              actions={[
                { label: 'Activate', icon: <Eye size={16} />, onClick: () => void bulkSetActive(true), disabled: !online },
                { label: 'Deactivate', icon: <EyeOff size={16} />, onClick: () => void bulkSetActive(false), disabled: !online },
              ]}
            />
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
            <SortableContext items={pager.pageItems.map((x) => x.id)} strategy={verticalListSortingStrategy}>
              <div className="cat-tree">
                <ul className="cat-list" aria-label="Services">
                  {pager.pageItems.map((s, i) => (
                    <ServiceRow
                      key={s.id} s={s} index={pageOffset + i} count={visible.length} busy={busyIds.has(s.id)} reorderEnabled={reorderEnabled}
                      canManage={canManage} online={online}
                      selected={selectedIds.has(s.id)}
                      onSelect={(checked) => setSelectedIds((prev) => { const n = new Set(prev); if (checked) n.add(s.id); else n.delete(s.id); return n; })}
                      onMove={(d) => move(s.id, d)} onToggle={() => void toggle(s)} onPreview={() => setPreviewing(s)}
                      onEdit={() => openEdit(s)} onDelete={() => setToDelete(s)}
                    />
                  ))}
                </ul>
              </div>
            </SortableContext>
            <DragOverlay>{activeSvc && <div className="cat-overlay"><GripVertical size={16} /><strong>{activeSvc.name}</strong></div>}</DragOverlay>
          </DndContext>
          <TablePagination {...pager} onPageChange={pager.setPage} onPageSizeChange={pager.setPageSize} label="services" />
        </>
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