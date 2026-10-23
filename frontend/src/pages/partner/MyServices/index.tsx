import { useEffect, useId, useMemo, useState } from "react";
import EmptyState from "@/components/common/EmptyState";
import ErrorState from "@/components/common/ErrorState";
import OfflineState from "@/components/common/OfflineState";
import { classifyApiError } from "@/lib/apiError";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useLoad } from "../useLoad";
import {
  getPartnerServices,
  savePartnerServices,
  type PartnerServices,
} from "./myServices.api";

export const approvedPartnerServices = [
  "AC Repair",
  "AC Service",
  "Washing Machine",
  "Refrigerator",
  "Geyser",
  "Microwave",
  "Water Purifier",
  "Laptop Repair",
] as const;

export const isApprovedPartnerService = (serviceName: string) =>
  approvedPartnerServices.some(
    (service) => service.toLowerCase() === serviceName.trim().toLowerCase(),
  );

const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600";

const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

export default function PartnerMyServicesPage() {
  const { status, data, error, reload, setData } =
    useLoad<PartnerServices>(getPartnerServices);
  const online = useOnlineStatus();
  const [selectedOverride, setSelectedOverride] = useState<string[] | null>(null);
const selected = useMemo(
  () => selectedOverride ?? data?.selectedIds ?? [],
  [selectedOverride, data?.selectedIds],
);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const headingId = useId();

  useEffect(() => {
    if (!showSuccessPopup) return;
    const timer = window.setTimeout(() => {
      setShowSuccessPopup(false);
    }, 3500);
    return () => window.clearTimeout(timer);
  }, [showSuccessPopup]);

  useEffect(() => {
    if (!showSuccessPopup) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowSuccessPopup(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showSuccessPopup]);

  const dirty = useMemo(
    () => (data ? !sameSet(selected, data.selectedIds) : false),
    [data, selected],
  );

  const toggle = (id: string) => {
    setSaved(false);
    setShowSuccessPopup(false);
    setSaveError(null);
    setSelectedOverride((current) => {
      const currentSelection = current ?? data?.selectedIds ?? [];
      return currentSelection.includes(id)
        ? currentSelection.filter((x) => x !== id)
        : [...currentSelection, id];
    });
  };

  const resetSelection = () => {
    if (!data) return;
    setSelectedOverride(null);
    setSaveError(null);
    setShowSuccessPopup(false);
  };

  const save = async () => {
    if (!data || saving || !dirty || !online) return;
    setSaving(true);
    setSaveError(null);
    setShowSuccessPopup(false);
    try {
      const next = await savePartnerServices(selected);
      setData(next);
      setSelectedOverride(null);
      setSaved(true);
      setShowSuccessPopup(true);
    } catch (err) {
      const c = classifyApiError(err, "Could not save your services.");
      setSaveError(c.details?.[0]?.message ?? c.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="box-border w-full max-w-none min-w-0 space-y-3 p-3 sm:p-5 lg:px-6 lg:py-4">
      {showSuccessPopup && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="services-saved-title"
          data-testid="services-saved-popup"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px]"
          onClick={() => setShowSuccessPopup(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl border border-line bg-white p-6 text-center shadow-2xl"
          >
            <p
              id="services-saved-title"
              role="status"
              aria-live="polite"
              className="text-base font-semibold text-brand"
            >
              Services saved successfully
            </p>
            <p className="mt-1.5 text-sm text-muted">
              Your approved service preferences have been updated.
            </p>
            <div className="mt-5 flex justify-center">
              <button
                type="button"
                autoFocus
                onClick={() => setShowSuccessPopup(false)}
                className={`min-h-[40px] min-w-[100px] rounded-lg bg-brand-500 px-5 text-sm font-medium text-white transition hover:bg-brand-600 ${focusRing}`}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="min-w-0">
        <h1 className="text-xl font-semibold text-brand">My services</h1>
        <p className="mt-0.5 text-sm text-muted">
          Choose the services you offer. Only services approved by the platform
          are listed. You will receive job requests for the ones you pick.
        </p>
      </header>

      {status === "loading" && (
        <div
          aria-busy="true"
          aria-live="polite"
          className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3"
          data-testid="services-loading"
        >
          <span className="sr-only">Loading services</span>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-11 animate-pulse rounded border border-line bg-panel"
            />
          ))}
        </div>
      )}

      {status === "offline" && <OfflineState onRetry={reload} />}

      {status === "error" && (
        <ErrorState
          title="Couldn't load your services"
          message={error?.message ?? "Please try again."}
          onRetry={reload}
        />
      )}

      {status === "ready" && data && data.approved.length === 0 && (
        <EmptyState
          title="No services available yet"
          message="The platform has not approved any services. Check back soon."
          actionLabel="Refresh"
          onAction={reload}
        />
      )}

      {status === "ready" && data && data.approved.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
          className="w-full min-w-0 space-y-3"
        >
          {selected.length > 0 && (
            <div className="mb-4 rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-emerald-900 uppercase tracking-wide">
                  Assigned to your profile ({selected.length})
                </span>
                <span className="text-2xs text-emerald-700">Active for job matching</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.approved
                  .filter((s) => selected.includes(s.id))
                  .map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-white px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-2xs"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {s.name}
                    </span>
                  ))}
              </div>
            </div>
          )}

          <fieldset
            aria-labelledby={headingId}
            className="m-0 w-full min-w-0 border-0 p-0"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-brand">
              <span id={headingId}>Approved services</span>
              <span className="text-muted" aria-live="polite">
                {selected.length} of {data.approved.length} selected
              </span>
            </div>

            <ul className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {data.approved.map((s) => {
                const checked = selected.includes(s.id);
                return (
                  <li key={s.id} className="flex min-w-0">
                    <label
                      className={`flex h-full min-h-[42px] w-full min-w-0 cursor-pointer select-none items-center gap-2.5 rounded border px-3 py-2 text-sm transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-600 ${
                        checked
                          ? "border-brand-500 bg-panel font-medium text-brand"
                          : "border-line bg-white hover:border-brand-500/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        aria-label={s.name}
                        onChange={() => toggle(s.id)}
                        className="h-4 w-4 shrink-0 cursor-pointer rounded accent-brand-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                      />
                      <span className="min-w-0 flex-1 break-words leading-snug [overflow-wrap:anywhere]">
                        {s.name}
                      </span>
                      {checked && (
                        <span aria-hidden="true" className="shrink-0 rounded bg-emerald-50 px-2 py-0.5 text-2xs font-semibold text-emerald-700 border border-emerald-200">
                          Assigned
                        </span>
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>

          {selected.length === 0 && (
            <p className="rounded border border-dashed border-line bg-panel p-3 text-sm text-muted">
              You have not selected any service yet, so you will not receive job
              requests.
            </p>
          )}

          {!online && (
            <p role="alert" className="text-sm text-orange-700">
              You are offline. Reconnect to save your changes.
            </p>
          )}

          {saveError && (
            <p role="alert" className="text-sm text-red-600">
              {saveError}
            </p>
          )}

          {saved && !dirty && (
            <p role="status" className="sr-only">
              Services saved.
            </p>
          )}

          <div className="sticky bottom-0 z-20 -mx-3 flex flex-wrap items-center justify-center gap-3 border-t border-line bg-white/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5 lg:-mx-6 lg:px-6">
            <button
              type="submit"
              disabled={!dirty || saving || !online}
              className={`min-h-[42px] rounded bg-brand-500 px-6 text-sm font-medium text-white shadow-sm transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-brand-500/75 disabled:text-white ${focusRing}`}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              disabled={!dirty || saving}
              onClick={resetSelection}
              className={`min-h-[42px] rounded border border-line bg-white px-5 text-sm font-medium text-brand transition hover:bg-panel disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`}
            >
              Reset
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
