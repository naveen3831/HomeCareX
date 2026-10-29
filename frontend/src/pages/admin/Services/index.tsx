import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2, Eye, EyeOff, History, ImageIcon, Package, Pencil, Plus, Trash2, WifiOff, X, XCircle, Clock, ArrowDown, ArrowUp, GripVertical,
} from 'lucide-react';
import clsx from 'clsx';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  GripVertical,
  History,
  ImageIcon,
  Package,
  Pencil,
  Plus,
  Trash2,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/admin/PageHeader";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { BulkActionBar } from "@/components/admin/BulkActionBar";
import { FullScreenPanel } from "@/components/admin/FullScreenPanel";
import {
  AuditDiffDrawer,
  type AuditEntry,
} from "@/components/admin/AuditDiffDrawer";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { CategoryFilterMenu } from "@/components/admin/CategoryFilterMenu";
import { PermissionGate } from "@/components/admin/PermissionGate";
import {
  ServiceForm,
  type CategoryOption,
} from "@/components/admin/ServiceForm";
import { ServicePreview } from "@/components/admin/ServicePreview";

import { usePermissions } from "@/hooks/usePermissions";
import { useUIStore } from "@/store/useUIStore";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  adminServiceApi,
  getServiceApiMode,
  getServiceApiModeReason,
  type ServiceApiError,
} from "@/services/adminServiceApi";
import { adminCategoryApi } from "./adminCategoryApi";

import type { AdminCategory } from "@/types/adminCatalog";
import type {
  AdminService,
  ServiceAuditEntry,
  ServiceErrors,
  ServiceImage,
  ServiceInput,
} from "@/types/adminService";

import "../Categories/index.css";
import "./index.css";

export const CATALOG_MANAGE = "catalog:manage";

type Toast = {
  text: string;
  tone: "success" | "error";
} | null;

type Toast = { text: string; tone: 'success' | 'error' } | null;
const rupees = (n: number) => `Γé╣${n.toLocaleString('en-IN')}`;
const duration = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} hr${m % 60 ? ` ${m % 60} min` : ''}`);

/** "Parent ΓÇ║ Child" labels so sub-categories are recognisable in a flat list. */
function toOptions(cats: AdminCategory[]): CategoryOption[] {
  const byId = new Map(cats.map((c) => [c.id, c]));
  return cats
    .map((c) => ({ id: c.id, name: c.parentId && byId.get(c.parentId) ? `${byId.get(c.parentId)!.name} ΓÇ║ ${c.name}` : c.name, active: c.active }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const toInput = (service: AdminService): ServiceInput => ({
  name: service.name,
  categoryId: service.categoryId,
  description: service.description,
  basePrice: service.basePrice,
  durationMinutes: service.durationMinutes,
  images: service.images,
  inclusions: service.inclusions,
  exclusions: service.exclusions,
  faqs: service.faqs,
  addOns: service.addOns,
  checklist: service.checklist,
  active: service.active,
});

interface ServiceRowProps {
  service: AdminService;
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
  service,
  index,
  count,
  busy,
  reorderEnabled,
  canManage,
  online,
  selected,
  onSelect,
  onMove,
  onToggle,
  onPreview,
  onEdit,
  onDelete,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: service.id,
    disabled: !reorderEnabled,
  });

  const cover =
    service.images.find((image) => image.isPrimary) ??
    service.images[0];

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className="cat-group"
    >
      <div
        className={clsx(
          "svc-row-item",
          !service.active && "is-inactive",
          busy && "is-busy",
          isDragging && "is-dragging",
        )}
      >
        {canManage && (
          <input
            type="checkbox"
            checked={selected}
            disabled={busy}
            aria-label={`Select ${service.name}`}
            onChange={(event) => onSelect(event.target.checked)}
          />
        )}

        <button
          type="button"
          className="cat-grip"
          disabled={!reorderEnabled}
          aria-label={`Drag ${service.name} to reorder`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={18} />
        </button>

        <div className="cat-media">
          <span className="cat-cover">
            {cover ? (
              <img src={cover.url} alt="" loading="lazy" />
            ) : (
              <span className="cat-cover__empty">
                <ImageIcon size={18} aria-hidden />
              </span>
            )}
          </span>

          {service.images.length > 1 && (
            <span className="svc-count">
              {service.images.length} photos
            </span>
          )}
        </div>

        <div className="cat-main">
          <div className="cat-name">
            <span>{service.name}</span>
            {!service.active && (
              <span className="cat-meta">Inactive</span>
            )}
          </div>

          <div className="cat-sub">
            <code>/{service.slug}</code>
            <span>{service.categoryName || "Uncategorized"}</span>
          </div>

          <div className="svc-facts">
            <b>{rupees(service.basePrice)}</b>
            <span>
              <Clock size={12} aria-hidden />{" "}
              {duration(service.durationMinutes)}
            </span>
          </div>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={service.active}
          aria-label={`${service.name} is ${
            service.active ? "active" : "inactive"
          }`}
          className={clsx(
            "cat-switch",
            service.active && "is-on",
          )}
          disabled={!canManage || !online || busy}
          onClick={onToggle}
        >
          <span />
        </button>

        <div className="cat-actions">
          <button
            type="button"
            className="cat-iconbtn"
            onClick={() => onMove(-1)}
            disabled={!reorderEnabled || index === 0}
            aria-label={`Move ${service.name} up`}
            title="Move up"
          >
            <ArrowUp size={16} />
          </button>

          <button
            type="button"
            className="cat-iconbtn"
            onClick={() => onMove(1)}
            disabled={
              !reorderEnabled || index === count - 1
            }
            aria-label={`Move ${service.name} down`}
            title="Move down"
          >
            <ArrowDown size={16} />
          </button>

          <button
            type="button"
            className="cat-iconbtn"
            onClick={onPreview}
            aria-label={`Preview ${service.name}`}
            title="Preview"
          >
            <Eye size={16} />
          </button>

          <PermissionGate permission={CATALOG_MANAGE}>
            <button
              type="button"
              className="cat-iconbtn"
              onClick={onEdit}
              aria-label={`Edit ${service.name}`}
              title="Edit"
            >
              <Pencil size={16} />
            </button>

            <button
              type="button"
              className="cat-iconbtn cat-iconbtn--danger"
              onClick={onDelete}
              disabled={!online}
              aria-label={`Delete ${service.name}`}
              title="Delete"
            >
              <Trash2 size={16} />
            </button>
          </PermissionGate>
        </div>
      </div>
    </li>
  );
};

export const AdminServicesPage: React.FC = () => {
  const online = useOnlineStatus();
  const { can } = usePermissions();
  const canManage = can(CATALOG_MANAGE);

  const [items, setItems] = useState<AdminService[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const search = useUIStore((state) => state.pageSearch);
  const setPageSearch = useUIStore((state) => state.setPageSearch);
  const [order, setOrder] = useState<string[]>(() => adminServiceApi.getOrder());
  const [params, setParams] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<AdminService | null>(null);
  const [savingImages, setSavingImages] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<number>();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminService | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [formFields, setFormFields] = useState<
    ServiceErrors | undefined
  >();

  const [toDelete, setToDelete] = useState<AdminService | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [bulkAction, setBulkAction] = useState<
    "activate" | "deactivate" | null
  >(null);

  const [auditOpen, setAuditOpen] = useState(false);
  const [audit, setAudit] = useState<ServiceAuditEntry[]>([]);
  const [auditEntry, setAuditEntry] =
    useState<AuditEntry | null>(null);

  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const [searchSlot, setSearchSlot] =
    useState<HTMLElement | null>(null);

  const flash = useCallback(
    (
      text: string,
      tone: "success" | "error" = "success",
    ) => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }

      setToast({ text, tone });

      toastTimer.current = setTimeout(() => {
        setToast(null);
      }, 5500);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    try {
      const cats = await adminCategoryApi
        .list()
        .catch(() => [] as AdminCategory[]);

      const services = await adminServiceApi.list();

      setCategories(cats);
      setItems(services);

      const savedOrder = adminServiceApi.getOrder();
      const existingIds = new Set(services.map((item) => item.id));

      setOrder([
        ...savedOrder.filter((id) => existingIds.has(id)),
        ...services
          .map((item) => item.id)
          .filter((id) => !savedOrder.includes(id)),
      ]);
    } catch (error) {
      setLoadError(
        (error as ServiceApiError)?.message ||
          "Unable to load services. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPageSearch("");
  }, [setPageSearch]);

  useEffect(() => {
    setSearchSlot(
      document.getElementById("admin-search-slot"),
    );
  }, []);

  useEffect(() => {
    const existingIds = new Set(items.map((item) => item.id));

    setSelectedIds((previous) => {
      const next = new Set(
        [...previous].filter((id) => existingIds.has(id)),
      );

      return next.size === previous.size ? previous : next;
    });
  }, [items]);

  const options = useMemo(
    () => toOptions(categories),
    [categories],
  );

  const categoryParam = params.get("category") ?? "";

  // ---- derived list ----
  const categoryParam = params.get('category') ?? '';
  const filtered = search.trim() !== '' || categoryParam !== '';
  const reorderEnabled = !filtered && canManage && online;

  const filtered = Boolean(
    search.trim() ||
      localSearch.trim() ||
      statusFilter !== "all" ||
      categoryParam,
  );

  const reorderEnabled =
    !filtered && canManage && online && !loading;

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  function applyOrder(ids: string[], movedId: string, from: number, to: number) {
    const name = items.find((x) => x.id === movedId)?.name ?? 'Service';
    setOrder(ids);
    adminServiceApi.reorder(ids, { id: movedId, name, from, to });
    flash(`ΓÇ£${name}ΓÇ¥ moved to position ${to + 1}`);
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

  const filterOptions = useMemo(
    () =>
      options.map((option) => {
        const categoryIds = new Set([
          option.id,
          ...categories
            .filter(
              (category) => category.parentId === option.id,
            )
            .map((category) => category.id),
        ]);

        return {
          ...option,
          count: items.filter((service) =>
            categoryIds.has(service.categoryId),
          ).length,
        };
      }),
    [options, categories, items],
  );

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((item) => item.active).length,
      inactive: items.filter((item) => !item.active).length,
    }),
    [items],
  );

  const selectedServices = useMemo(
    () =>
      items.filter((service) =>
        selectedIds.has(service.id),
      ),
    [items, selectedIds],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  async function applyOrder(ids: string[], movedId: string, from: number, to: number) {
    const name = items.find((x) => x.id === movedId)?.name ?? 'Service';
    const before = items;
    const pos = new Map(ids.map((id, n) => [id, n]));
    setItems((cur) => cur.map((s) => (pos.has(s.id) ? { ...s, sortOrder: pos.get(s.id)! } : s))); // show it at once
    try {
      await adminServiceApi.reorder(ids, { id: movedId, name, from, to });
      flash(`“${name}” moved to position ${to + 1}. Customers will see this order.`);
    } catch (e) {
      setItems(before); // the server refused: put the list back so the screen never lies
      flash((e as ServiceApiError).message, 'error');
    }
  }
  const move = (id: string, dir: -1 | 1) => {
    const ids = ordered.map((x) => x.id); const from = ids.indexOf(id); const to = from + dir;
    if (to < 0 || to >= ids.length) return;
    void applyOrder(arrayMove(ids, from, to), id, from, to);
  };
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over || e.active.id === e.over.id) return;
    const ids = ordered.map((x) => x.id);
    const from = ids.indexOf(String(e.active.id)); const to = ids.indexOf(String(e.over.id));
    if (from > -1 && to > -1) void applyOrder(arrayMove(ids, from, to), String(e.active.id), from, to);
  };

  const filterMenu = (
    <CategoryFilterMenu
      options={filterOptions}
      value={categoryParam}
      onChange={chooseCategory}
      total={visible.length}
    />
  );

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormError("");
    setFormFields(undefined);
    setFormOpen(true);
  }, []);

  const openEdit = useCallback((service: AdminService) => {
    setEditing(service);
    setFormError("");
    setFormFields(undefined);
    setFormOpen(true);
  }, []);

  // Support links such as /admin/services?new=1&category=<id>.
  useEffect(() => {
    if (
      loading ||
      !params.has("new")
    ) {
      return;
    }

    if (canManage) {
      openCreate();
    }

  // ---- actions ----
  const openCreate = () => { setEditing(null); setFormError(''); setFormFields(undefined); setFormOpen(true); };
  const openEdit = (s: AdminService) => { setEditing(s); setFormError(''); setFormFields(undefined); setFormOpen(true); };
    const next = new URLSearchParams(params);
    next.delete("new");
    setParams(next, { replace: true });
  }, [loading, params, canManage, openCreate, setParams]);

  async function save(input: ServiceInput) {
    setSaving(true);
    setFormError("");
    setFormFields(undefined);

    try {
      const result = editing
        ? await adminServiceApi.update(
            editing.id,
            input,
            options,
          )
        : await adminServiceApi.create(input, options);

      const { service, ignored, localOnly } = result;

      setFormOpen(false);
      await load();

      if (ignored.length > 0) {
        flash(
          `"${service.name}" saved, but some images could not be stored. Try using fewer or smaller images.`,
          "error",
        );
      } else {
        const warning = localOnly?.length
          ? ` Some data is only stored in this browser: ${localOnly.join(
              ", ",
            )}.`
          : "";

        flash(
          `${
            editing
              ? `"${service.name}" updated`
              : `"${service.name}" created`
          }.${warning}`,
          localOnly?.length ? "error" : "success",
        );
      }
    } catch (error) {
      const apiError = error as ServiceApiError;

      setFormError(
        apiError?.message || "Unable to save this service.",
      );
      setFormFields(apiError?.fields);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(service: AdminService) {
    if (
      !online ||
      !canManage ||
      busyIds.has(service.id)
    ) {
      return;
    }

    const nextActive = !service.active;

    setBusyIds((previous) =>
      new Set(previous).add(service.id),
    );

    setItems((previous) =>
      previous.map((item) =>
        item.id === service.id
          ? { ...item, active: nextActive }
          : item,
      ),
    );

    try {
      await adminServiceApi.setActive(
        [service.id],
        nextActive,
      );

      flash(
        `"${service.name}" ${
          nextActive ? "activated" : "deactivated"
        }`,
      );
    } catch (error) {
      setItems((previous) =>
        previous.map((item) =>
          item.id === service.id
            ? { ...item, active: service.active }
            : item,
        ),
      );

      flash(
        (error as ServiceApiError)?.message ||
          "Unable to update service status.",
        "error",
      );
    } finally {
      setBusyIds((previous) => {
        const next = new Set(previous);
        next.delete(service.id);
        return next;
      });
    }
  }

  async function bulkSetActive(nextActive: boolean) {
    const ids = [...selectedIds];

    if (!ids.length || !online || !canManage) {
      return;
    }

    setBusyIds(
      (previous) => new Set([...previous, ...ids]),
    );

    try {
      const result = await adminServiceApi.setActive(
        ids,
        nextActive,
      );

      const changedIds = new Set(result.changed);

      setItems((previous) =>
        previous.map((service) =>
          changedIds.has(service.id)
            ? { ...service, active: nextActive }
            : service,
        ),
      );

      if (result.failed.length > 0) {
        flash(
          `${result.changed.length} updated; ${
            result.failed.length
          } failed: ${result.failed
            .map(
              (failure) =>
                `${failure.name} (${failure.message})`,
            )
            .join("; ")}`,
          "error",
        );
      } else {
        flash(
          `${result.changed.length} service(s) ${
            nextActive ? "activated" : "deactivated"
          }.`,
        );
      }

      setSelectedIds(
        new Set(result.failed.map((failure) => failure.id)),
      );
    } catch (error) {
      flash(
        (error as ServiceApiError)?.message ||
          "Unable to update selected services.",
        "error",
      );
    } finally {
      setBusyIds((previous) => {
        const next = new Set(previous);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }
  }

  async function confirmBulkAction() {
    if (!bulkAction || selectedIds.size === 0) {
      return;
    }

    const activate = bulkAction === "activate";
    setBulkAction(null);
    await bulkSetActive(activate);
  }

  function applyOrder(
    ids: string[],
    movedId: string,
    from: number,
    to: number,
  ) {
    const name =
      items.find((item) => item.id === movedId)?.name ??
      "Service";

    setOrder(ids);

    try {
      const result = adminServiceApi.reorder(ids, {
        id: movedId,
        name,
        from,
        to,
      });

      if (
        result &&
        typeof (result as Promise<unknown>).catch === "function"
      ) {
        void (result as Promise<unknown>).catch(() => {
          flash(
            "The order could not be saved. Refresh to verify the current order.",
            "error",
          );
        });
      }
    } catch {
      flash(
        "The order could not be saved. Refresh to verify the current order.",
        "error",
      );
      return;
    }

    flash(`"${name}" moved to position ${to + 1}`);
  }

  function move(id: string, direction: -1 | 1) {
    if (!reorderEnabled) {
      return;
    }

    const ids = visible.map((service) => service.id);
    const from = ids.indexOf(id);
    const to = from + direction;

    if (from < 0 || to < 0 || to >= ids.length) {
      return;
    }

    applyOrder(arrayMove(ids, from, to), id, from, to);
  }

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);

    if (
      !reorderEnabled ||
      !event.over ||
      event.active.id === event.over.id
    ) {
      return;
    }

    const ids = visible.map((service) => service.id);
    const from = ids.indexOf(String(event.active.id));
    const to = ids.indexOf(String(event.over.id));

    if (from >= 0 && to >= 0) {
      applyOrder(
        arrayMove(ids, from, to),
        String(event.active.id),
        from,
        to,
      );
    }
  }

  const activeService =
    items.find((item) => item.id === activeId) ?? null;

  async function saveImages(
    service: AdminService,
    images: ServiceImage[],
  ) {
    setSavingImages(true);

    try {
      const result = await adminServiceApi.update(
        service.id,
        { ...toInput(service), images },
        options,
      );

      setItems((previous) =>
        previous.map((item) =>
          item.id === result.service.id
            ? result.service
            : item,
        ),
      );

      setPreviewing(result.service);

      if (result.ignored.length > 0) {
        flash(
          `Photos for "${service.name}" were updated, but some images could not be stored.`,
          "error",
        );
      } else {
        flash(`Photos for "${service.name}" saved.`);
      }
    } catch (error) {
      flash(
        (error as ServiceApiError)?.message ||
          "Unable to save service photos.",
        "error",
      );
    } finally {
      setSavingImages(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete || !online || !canManage) {
      return;
    }

    setDeleting(true);

    try {
      await adminServiceApi.remove(toDelete.id);

      flash(`"${toDelete.name}" deleted.`);
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(toDelete.id);
        return next;
      });

      setToDelete(null);
      await load();
    } catch (error) {
      flash(
        (error as ServiceApiError)?.message ||
          "Unable to delete this service.",
        "error",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function openAudit() {
    setAuditOpen(true);

    try {
      setAudit(await adminServiceApi.auditLog());
    } catch (error) {
      setAudit([]);

      flash(
        (error as ServiceApiError)?.message ||
          "Unable to load the service audit log.",
        "error",
      );
    }
  }

  const mode = getServiceApiMode();

  return (
    <div className="admin-page-container cat-page svc-page">
      <PageHeader
        title="Services"
        description="Manage bookable services, categories, prices, durations, and availability."
        actions={
          <div className="cat-head-actions">
            <button
              type="button"
              className="hcx-btn"
              onClick={() => void openAudit()}
            >
              <History size={16} />
              Audit log
            </button>

            <PermissionGate permission={CATALOG_MANAGE}>
              <button
                type="button"
                className="hcx-btn hcx-btn--primary"
                onClick={openCreate}
                disabled={!online || loading}
              >
                <Plus size={16} />
                New service
              </button>
            </PermissionGate>
          </div>
        }
      />

      {!online && <div className="cat-banner" role="status"><WifiOff size={15} /> You are offline. You can browse what has loaded, but changes are disabled until the connection returns.</div>}
      {mode === 'demo' && <div className="cat-banner" role="status"><WifiOff size={15} /> Backend not reachable ({getServiceApiModeReason()}): showing local demo data. Changes are saved in this browser only.</div>}
      {!canManage && <div className="cat-banner cat-banner--info" role="status">You can view services but need the ΓÇ£{CATALOG_MANAGE}ΓÇ¥ permission to change them.</div>}

      {toast && (
        <div
          role="status"
          className={clsx(
            "cat-toast",
            toast.tone === "error" && "is-error",
          )}
        >
          {toast.tone === "error" ? (
            <XCircle size={16} />
          ) : (
            <CheckCircle2 size={16} />
          )}

          <span>{toast.text}</span>

          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={() => setToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div className="cat-stats">
        <div className="cat-stat">
          <span className="cat-stat__i is-brand">
            <Package size={18} />
          </span>
          <div>
            <b>{stats.total}</b>
            <small>Total</small>
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

      <div className="svc-toolbar">
        <label
          className="svc-filter"
          htmlFor="svc-status-filter"
        >
          <span>Filter by status</span>
          <select
            id="svc-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as StatusFilter,
              )
            }
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <label
          className="svc-search"
          htmlFor="svc-search-input"
        >
          <span className="sr-only">Search services</span>
          <input
            id="svc-search-input"
            type="search"
            value={localSearch}
            onChange={(event) =>
              setLocalSearch(event.target.value)
            }
            placeholder="Search services"
          />
        </label>

        {searchSlot
          ? createPortal(filterMenu, searchSlot)
          : filterMenu}
      </div>

      <p className="svc-count-note">
        {visible.length} of {items.length} services
      </p>

      {filtered && (
        <div className="cat-note">
          Reordering is paused while search, status, or category
          filters are active.
          <button
            type="button"
            className="hcx-btn"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        </div>
      )}

      {canManage && selectedServices.length > 0 && (
        <div
          className="cat-toolbar cat-toolbar--bulk"
          role="toolbar"
          aria-label="Bulk service actions"
        >
          <span>{selectedServices.length} selected</span>

          <div className="cat-head-actions">
            <button
              type="button"
              className="hcx-btn"
              disabled={!online}
              onClick={() => void bulkSetActive(true)}
            >
              Activate
            </button>

            <button
              type="button"
              className="hcx-btn"
              disabled={!online}
              onClick={() => setBulkAction("deactivate")}
            >
              Deactivate
            </button>

            <button
              type="button"
              className="hcx-btn"
              onClick={() => setSelectedIds(new Set())}
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {loadError && (
        <div role="alert" className="cat-alert">
          {loadError}
          <button
            type="button"
            className="hcx-btn"
            onClick={() => void load()}
          >
            Try again
          </button>
        </div>
      )}

      {loading ? (
        <div
          className="cat-skel"
          aria-label="Loading services"
          aria-busy="true"
        >
          {[0, 1, 2, 3, 4].map((number) => (
            <span
              key={number}
              className="hcx-skeleton hcx-skeleton--block"
              style={{ height: 78 }}
            />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="cat-empty">
          <Package size={34} aria-hidden />

          <h3>
            {items.length === 0
              ? "No services yet"
              : "No services match your filters"}
          </h3>

          <p>
            {items.length === 0
              ? "Create your first service to add it to the catalog."
              : "Try a different search, status, or category."}
          </p>

          {items.length === 0 ? (
            <PermissionGate permission={CATALOG_MANAGE}>
              <button
                type="button"
                className="hcx-btn hcx-btn--primary"
                onClick={openCreate}
                disabled={!online}
              >
                <Plus size={16} />
                New service
              </button>
            </PermissionGate>
          ) : (
            <button
              type="button"
              className="hcx-btn"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveId(null)}
          >
            <SortableContext
              items={visible.map((service) => service.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="cat-tree">
                <ul
                  className="cat-list"
                  aria-label="Services"
                >
                  {visible.map((service, index) => (
                    <ServiceRow
                      key={service.id}
                      service={service}
                      index={index}
                      count={visible.length}
                      busy={busyIds.has(service.id)}
                      reorderEnabled={reorderEnabled}
                      canManage={canManage}
                      online={online}
                      selected={selectedIds.has(service.id)}
                      onSelect={(checked) =>
                        setSelectedIds((previous) => {
                          const next = new Set(previous);

                          if (checked) {
                            next.add(service.id);
                          } else {
                            next.delete(service.id);
                          }

                          return next;
                        })
                      }
                      onMove={(direction) =>
                        move(service.id, direction)
                      }
                      onToggle={() => void toggle(service)}
                      onPreview={() => setPreviewing(service)}
                      onEdit={() => openEdit(service)}
                      onDelete={() => setToDelete(service)}
                    />
                  ))}
                </ul>
              </div>
            </SortableContext>

            <DragOverlay>
              {activeService && (
                <div className="cat-overlay">
                  <GripVertical size={16} />
                  <strong>{activeService.name}</strong>
                </div>
              )}
            </DragOverlay>
          </DndContext>

          {canManage && (
            <BulkActionBar
              selectedCount={selectedIds.size}
              noun="services"
              onClear={() => setSelectedIds(new Set())}
              actions={[
                {
                  label: "Activate",
                  icon: <Eye size={16} />,
                  onClick: () => void bulkSetActive(true),
                  disabled: !online,
                },
                {
                  label: "Deactivate",
                  icon: <EyeOff size={16} />,
                  onClick: () => setBulkAction("deactivate"),
                  disabled: !online,
                },
              ]}
            />
          )}
        </>
      )}

      <ServicePreview
        service={previewing}
        canManage={canManage && online}
        saving={savingImages}
        onClose={() => setPreviewing(null)}
        onSaveImages={(service, images) =>
          void saveImages(service, images)
        }
      />

      <ServiceForm
        open={formOpen}
        editing={editing}
        presetCategoryId={categoryParam || undefined}
        categories={options}
        saving={saving}
        serverError={formError}
        serverFields={formFields}
        onClose={() => setFormOpen(false)}
        onSubmit={(input) => void save(input)}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        tone="danger"
        loading={deleting}
        title="Delete service?"
        confirmLabel="Delete"
        message={
          <>
            "{toDelete?.name}" will be permanently removed and
            recorded in the audit log. A service with existing
            bookings may not be deletable; deactivate it instead
            if required.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={Boolean(bulkAction)}
        loading={busyIds.size > 0}
        title={
          bulkAction === "activate"
            ? "Activate selected services?"
            : "Deactivate selected services?"
        }
        confirmLabel={bulkAction ?? "Confirm"}
        message={
          <>
            This will update {selectedIds.size} selected service
            {selectedIds.size === 1 ? "" : "s"}.
          </>
        }
        onCancel={() => setBulkAction(null)}
        onConfirm={() => void confirmBulkAction()}
      />

      <FullScreenPanel
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        title="Service audit log"
        subtitle="Review service changes recorded by the catalog API."
      >
        {audit.length === 0 ? (
          <p className="cat-note">No activity yet.</p>
        ) : (
          <ul className="cat-audit">
            {audit.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() =>
                    setAuditEntry({
                      id: entry.id,
                      actor: entry.actor,
                      action: entry.action,
                      entity: `Service · ${entry.entityName}`,
                      entityId: entry.entityId,
                      time: new Date(
                        entry.time,
                      ).toLocaleString(),
                      before: entry.before,
                      after: entry.after,
                    })
                  }
                >
                  <StatusBadge
                    status={entry.action}
                    tone={
                      entry.action === "delete"
                        ? "danger"
                        : entry.action === "create"
                          ? "success"
                          : "info"
                    }
                    dot={false}
                  />

                  <span className="cat-audit__n">
                    {entry.entityName}
                  </span>

                  <small>
                    {new Date(entry.time).toLocaleString()}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        )}
      </FullScreenPanel>

      <AuditDiffDrawer
        entry={auditEntry}
        onClose={() => setAuditEntry(null)}
      />
    </div>
  );
};

export default AdminServicesPage;