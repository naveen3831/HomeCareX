
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  History,
  Package,
  Plus,
  WifiOff,
  X,
  XCircle,
} from "lucide-react";
import clsx from "clsx";
import { useSearchParams } from "react-router-dom";

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
import { ServiceForm, type CategoryOption } from "@/components/admin/ServiceForm";
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

const rupees = (amount: number) =>
  `₹${Number(amount || 0).toLocaleString("en-IN")}`;

function toOptions(categories: AdminCategory[]): CategoryOption[] {
  const byId = new Map(categories.map((category) => [category.id, category]));

  return categories
    .map((category) => ({
      id: category.id,
      name:
        category.parentId && byId.has(category.parentId)
          ? `${byId.get(category.parentId)!.name} › ${category.name}`
          : category.name,
      active: category.active,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function toInput(service: AdminService): ServiceInput {
  return {
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
  };
}

export const AdminServicesPage: React.FC = () => {
  const online = useOnlineStatus();
  const { can } = usePermissions();
  const canManage = can(CATALOG_MANAGE);

  const [items, setItems] = useState<AdminService[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Shared search used by the admin navigation.
  const search = useUIStore((state) => state.pageSearch);
  const setPageSearch = useUIStore((state) => state.setPageSearch);

  const [params, setParams] = useSearchParams();

  // All selected service IDs use a single consistent representation.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [searchTerm, setSearchTerm] = useState("");

  const [previewing, setPreviewing] = useState<AdminService | null>(null);
  const [savingImages, setSavingImages] = useState(false);

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
  const [auditEntry, setAuditEntry] = useState<AuditEntry | null>(null);

  const [toast, setToast] = useState<Toast>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const flash = useCallback(
    (text: string, tone: "success" | "error" = "success") => {
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

    try {
      const cats = await adminCategoryApi
        .list()
        .catch(() => [] as AdminCategory[]);

      setCategories(cats);

      const services = await adminServiceApi.list();
      setItems(services);
      setLoadError("");
    } catch (error) {
      setLoadError(
        (error as ServiceApiError)?.message ||
          "Unable to load services. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPageSearch("");
  }, [setPageSearch]);

  useEffect(() => {
    setSelectedIds((previous) => {
      const existingIds = new Set(items.map((service) => service.id));
      return new Set(
        [...previous].filter((id) => existingIds.has(id)),
      );
    });
  }, [items]);

  const options = useMemo(() => toOptions(categories), [categories]);

  const categoryParam = params.get("category") ?? "";

  const filtered = Boolean(
    search.trim() ||
      searchTerm.trim() ||
      statusFilter !== "all" ||
      categoryParam,
  );

  const visible = useMemo(() => {
    const needle = (search || searchTerm).trim().toLowerCase();

    const categoryIds = new Set(
      categoryParam
        ? [
            categoryParam,
            ...categories
              .filter((category) => category.parentId === categoryParam)
              .map((category) => category.id),
          ]
        : [],
    );

    return items.filter((service) => {
      if (categoryParam && !categoryIds.has(service.categoryId)) {
        return false;
      }

      if (statusFilter === "active" && !service.active) {
        return false;
      }

      if (statusFilter === "inactive" && service.active) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        service.name,
        service.slug,
        service.categoryName,
      ].some((value) =>
        (value ?? "").toLowerCase().includes(needle),
      );
    });
  }, [
    items,
    categories,
    search,
    searchTerm,
    statusFilter,
    categoryParam,
  ]);

  const filterOptions = useMemo(() => {
    return options.map((option) => {
      const categoryIds = new Set([
        option.id,
        ...categories
          .filter((category) => category.parentId === option.id)
          .map((category) => category.id),
      ]);

      return {
        ...option,
        count: items.filter((service) =>
          categoryIds.has(service.categoryId),
        ).length,
      };
    });
  }, [options, categories, items]);

  const stats = useMemo(
    () => ({
      total: items.length,
      active: items.filter((service) => service.active).length,
      inactive: items.filter((service) => !service.active).length,
    }),
    [items],
  );

  const selectedServices = useMemo(
    () => items.filter((service) => selectedIds.has(service.id)),
    [items, selectedIds],
  );

  const chooseCategory = (id: string) => {
    setParams(id ? { category: id } : {});
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setParams({});
    setPageSearch("");
  };

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    setFormFields(undefined);
    setFormOpen(true);
  };

  const openEdit = (service: AdminService) => {
    setEditing(service);
    setFormError("");
    setFormFields(undefined);
    setFormOpen(true);
  };

  // Support links from the Categories page that request a new service.
  useEffect(() => {
    if (loading || !["", "1"].includes(params.get("new") ?? "")) {
      return;
    }

    if (params.has("new")) {
      if (canManage) {
        openCreate();
      }

      const next = new URLSearchParams(params);
      next.delete("new");
      setParams(next, { replace: true });
    }
  }, [loading, params, canManage, setParams]);

  async function save(input: ServiceInput) {
    setSaving(true);
    setFormError("");
    setFormFields(undefined);

    try {
      const result = editing
        ? await adminServiceApi.update(editing.id, input, options)
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
          ? ` Some data is only stored in this browser: ${localOnly.join(", ")}.`
          : "";

        flash(
          `${editing ? `"${service.name}" updated` : `"${service.name}" created`}.${warning}`,
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
    if (!online || !canManage || busyIds.has(service.id)) {
      return;
    }

    const next = !service.active;

    setBusyIds((previous) => new Set(previous).add(service.id));
    setItems((previous) =>
      previous.map((item) =>
        item.id === service.id ? { ...item, active: next } : item,
      ),
    );

    try {
      await adminServiceApi.setActive([service.id], next);

      flash(
        `"${service.name}" ${next ? "activated" : "deactivated"}`,
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
        const nextIds = new Set(previous);
        nextIds.delete(service.id);
        return nextIds;
      });
    }
  }

  async function bulkSetActive(next: boolean) {
    const ids = [...selectedIds];

    if (!ids.length || !online || !canManage) {
      return;
    }

    setBusyIds((previous) => new Set([...previous, ...ids]));

    try {
      const result = await adminServiceApi.setActive(ids, next);
      const changedIds = new Set(result.changed);

      setItems((previous) =>
        previous.map((service) =>
          changedIds.has(service.id)
            ? { ...service, active: next }
            : service,
        ),
      );

      if (result.failed.length > 0) {
        flash(
          `${result.changed.length} updated; ${result.failed.length} failed: ${result.failed
            .map((failure) => `${failure.name} (${failure.message})`)
            .join("; ")}`,
          "error",
        );
      } else {
        flash(
          `${result.changed.length} service(s) ${
            next ? "activated" : "deactivated"
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
        const nextIds = new Set(previous);
        ids.forEach((id) => nextIds.delete(id));
        return nextIds;
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
          item.id === result.service.id ? result.service : item,
        ),
      );

      setPreviewing(result.service);
      flash(`Photos for "${service.name}" saved.`);
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
      setToDelete(null);
      setSelectedIds((previous) => {
        const next = new Set(previous);
        next.delete(toDelete.id);
        return next;
      });

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
    } catch {
      setAudit([]);
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

      {!online && (
        <div className="cat-banner" role="status">
          <WifiOff size={15} />
          You are offline. Changes are disabled until the connection returns.
        </div>
      )}

      {mode === "demo" && (
        <div className="cat-banner" role="status">
          <WifiOff size={15} />
          Backend not reachable ({getServiceApiModeReason()}): showing local
          demo data.
        </div>
      )}

      {!canManage && (
        <div className="cat-banner cat-banner--info" role="status">
          You can view services but need the "{CATALOG_MANAGE}" permission to
          make changes.
        </div>
      )}

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
        <label className="svc-filter" htmlFor="svc-status-filter">
          <span>Filter by status</span>
          <select
            id="svc-status-filter"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "all" | "active" | "inactive",
              )
            }
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>

        <label className="svc-search" htmlFor="svc-search-input">
          <span className="sr-only">Search services</span>
          <input
            id="svc-search-input"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search services"
          />
        </label>

        <CategoryFilterMenu
          options={filterOptions}
          value={categoryParam}
          onChange={chooseCategory}
          total={visible.length}
        />
      </div>

      <p className="svc-count-note">
        {visible.length} of {items.length} services
      </p>

      {canManage && selectedServices.length > 0 && (
        <div
          className="cat-toolbar cat-toolbar--bulk"
          role="toolbar"
          aria-label="Bulk actions"
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
              Clear
            </button>
          </div>
        </div>
      )}

      {filtered && (
        <button
          type="button"
          className="hcx-btn"
          onClick={clearFilters}
        >
          Clear filters
        </button>
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
        <table className="hcx-table" aria-label="Services" aria-busy="true">
          <thead>
            <tr>
              {canManage && <th scope="col">Select</th>}
              <th scope="col">Name</th>
              <th scope="col">Category</th>
              <th scope="col">Price</th>
              <th scope="col">Status</th>
              {canManage && <th scope="col">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map((number) => (
              <tr key={number}>
                <td colSpan={canManage ? 6 : 4}>
                  <span className="hcx-skeleton hcx-skeleton--row" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
              : "Try a different search or category."}
          </p>

          {items.length === 0 && canManage ? (
            <button
              type="button"
              className="hcx-btn hcx-btn--primary"
              onClick={openCreate}
              disabled={!online}
            >
              <Plus size={16} />
              New service
            </button>
          ) : (
            items.length > 0 && (
              <button
                type="button"
                className="hcx-btn"
                onClick={clearFilters}
              >
                Clear filters
              </button>
            )
          )}
        </div>
      ) : (
        <>
          <table className="hcx-table" aria-label="Services">
            <thead>
              <tr>
                {canManage && (
                  <th scope="col" className="hcx-table__check">
                    <span className="sr-only">Select</span>
                  </th>
                )}
                <th scope="col">Name</th>
                <th scope="col">Category</th>
                <th scope="col">Price</th>
                <th scope="col">Status</th>
                {canManage && <th scope="col">Actions</th>}
              </tr>
            </thead>

            <tbody>
              {visible.map((service) => (
                <tr key={service.id}>
                  {canManage && (
                    <td className="hcx-table__check">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(service.id)}
                        disabled={busyIds.has(service.id)}
                        onChange={(event) =>
                          setSelectedIds((previous) => {
                            const next = new Set(previous);

                            if (event.target.checked) {
                              next.add(service.id);
                            } else {
                              next.delete(service.id);
                            }

                            return next;
                          })
                        }
                        aria-label={`Select ${service.name}`}
                      />
                    </td>
                  )}

                  <td>
                    <strong>{service.name}</strong>
                    <div>
                      <code>/{service.slug}</code>
                    </div>
                  </td>

                  <td>{service.categoryName || "—"}</td>
                  <td>{rupees(service.basePrice)}</td>

                  <td>
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
                      disabled={
                        !canManage ||
                        !online ||
                        busyIds.has(service.id)
                      }
                      onClick={() => void toggle(service)}
                    >
                      <span />
                    </button>
                    <span>{service.active ? "Active" : "Inactive"}</span>
                  </td>

                  {canManage && (
                    <td>
                      <div className="cat-head-actions">
                        <button
                          type="button"
                          className="hcx-btn"
                          onClick={() => setPreviewing(service)}
                        >
                          Preview
                        </button>

                        <button
                          type="button"
                          className="hcx-btn"
                          onClick={() => openEdit(service)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="hcx-btn hcx-btn--danger-ghost"
                          disabled={!online}
                          onClick={() => setToDelete(service)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

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
            "{toDelete?.name}" will be permanently removed and recorded in
            the audit log. A service with existing bookings may not be
            deletable; deactivate it instead if required.
          </>
        }
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />

      <ConfirmDialog
        open={Boolean(bulkAction)}
        loading={false}
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
                      time: new Date(entry.time).toLocaleString(),
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
                  <span className="cat-audit__n">{entry.entityName}</span>
                  <small>{new Date(entry.time).toLocaleString()}</small>
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
