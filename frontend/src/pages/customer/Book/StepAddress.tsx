import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Briefcase, Check, CheckCircle2, ChevronRight, Home, Loader2, MapPin, Pencil, Plus, Trash2, TriangleAlert, X, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import BookingSummary from "./components/BookingSummary";
import MapAddressPicker, { type PickedLocation } from "@/components/customer/maps/MapAddressPicker";
import { useQuery } from "@tanstack/react-query";
import { useAddresses, useBookingDraftStore } from "@/features/booking";
import { LoadingState, ErrorState, EmptyState } from "@/components/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { addressApi } from "@/services/addressApi";
import type { NormalizedApiError } from "@/services/bookingApi";
import { ADDRESS_LABELS, type AddressView } from "@/types/address";
import type { AddressSnapshot } from "@/types/booking";

const LABELS = ADDRESS_LABELS;
const LABEL_ICONS: Record<string, LucideIcon> = { Home, Work: Briefcase, Other: MapPin };

interface FormState {
  label: string;
  /** Typed by the customer. */
  house: string;
  /** Filled from the map until the customer types their own. */
  street: string;
  /** Filled from the map (locality / neighbourhood). */
  area: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
}
const EMPTY_FORM: FormState = { label: "Home", house: "", street: "", area: "", landmark: "", city: "", state: "", pincode: "" };

function toSnapshot(a: AddressView): AddressSnapshot {
  return {
    label: a.label,
    line1: a.line1,
    line2: a.line2,
    landmark: a.landmark,
    city: a.city,
    state: a.state,
    pincode: a.pincode,
    location: a.location ?? { lat: 0, lng: 0 },
    sourceAddressId: a.id,
  };
}

const inputClass = `min-h-[42px] w-full rounded-xl border border-line bg-canvas px-3.5 py-1.5 text-base text-ink transition-colors placeholder:text-[13px] placeholder:text-muted/60 focus:border-brand sm:placeholder:text-sm sm:min-h-[48px] sm:px-4 sm:py-2.5 sm:text-sm ${FOCUS_RING}`;


interface DeleteConfirmDialogProps {
  open: boolean;
  busy: boolean;
  error: string | null;
  address: AddressView;
  onCancel: () => void;
  onConfirm: () => void;
}

function DeleteConfirmDialog({
  open,
  busy,
  error,
  address,
  onCancel,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cancelBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, busy, onCancel]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center p-0 md:p-4">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => !busy && onCancel()}
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity"
      />

      {/* Dialog card */}
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-address-title"
        aria-describedby="delete-address-desc"
        className="relative z-10 w-full max-w-md overflow-hidden rounded-t-[28px] md:rounded-3xl bg-white p-5 md:p-6 text-center shadow-2xl transition-all"
      >
        {/* Mobile drag handle */}
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 md:hidden" />

        {/* Icon */}
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600 shadow-sm">
          <Trash2 className="h-6 w-6 stroke-[2]" aria-hidden="true" />
        </div>

        <h3 id="delete-address-title" className="mt-3 text-lg md:text-xl font-bold text-slate-900">
          Delete address?
        </h3>
        <p id="delete-address-desc" className="mt-1 text-xs md:text-sm text-slate-500">
          Are you sure you want to delete this address? This action cannot be undone.
        </p>

        {/* Address preview snippet */}
        <div className="mt-3.5 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 text-left">
          <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs md:text-sm">
            <MapPin className="h-3.5 w-3.5 text-brand" />
            <span>{address.label}</span>
          </div>
          <p className="mt-1 text-xs text-slate-600 line-clamp-2">
            {address.line1 || address.house}
            {address.line2 ? `, ${address.line2}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {address.city}, {address.state} – {address.pincode}
          </p>
        </div>

        {error && (
          <div role="alert" className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-left text-xs text-danger">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={clsx(
              "inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-xs md:text-sm font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 active:scale-95 disabled:opacity-50",
              FOCUS_RING,
            )}
          >
            Keep address
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={clsx(
              "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-rose-600 px-4 text-xs md:text-sm font-bold text-white shadow-sm hover:bg-rose-700 active:scale-95 disabled:opacity-50",
              FOCUS_RING,
            )}
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Deleting…</span>
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                <span>Yes, delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function StepAddress() {
  const selectedAddressId = useBookingDraftStore((s) => s.addressId);
  const setAddress = useBookingDraftStore((s) => s.setAddress);
  const setStep = useBookingDraftStore((s) => s.setStep);

  // Destructure create, update, and delete mutations/functions from your hook if available
  const { addresses, isLoading, isError, error, refetch, createAddress, isCreating } = useAddresses();

  const [mode, setMode] = useState<"list" | "new">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [notServiceable, setNotServiceable] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [editingLocation, setEditingLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [streetEdited, setStreetEdited] = useState(false);
  const [addressToDelete, setAddressToDelete] = useState<AddressView | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const successTimerRef = useRef<number | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    successTimerRef.current = window.setTimeout(() => {
      setSuccessMessage(null);
      successTimerRef.current = null;
    }, 4500);
  };

  useEffect(() => {
    return () => {
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current);
    };
  }, []);

  // Live serviceability hint once a full 6-digit pincode is typed
  const pincodeReady = /^\d{6}$/.test(form.pincode);
  const serviceability = useQuery({
    queryKey: ["serviceability", form.pincode],
    queryFn: () => addressApi.checkServiceability(form.pincode),
    enabled: mode === "new" && pincodeReady,
    staleTime: 5 * 60 * 1000,
  });

  // Sort addresses so the default address appears first
  const sortedAddresses = [...addresses].sort((a, b) => (b.isDefault ? 1 : 0) - (a.isDefault ? 1 : 0));

  // A customer with no saved address starts straight on the map.
  const [autoOpened, setAutoOpened] = useState(false);
  useEffect(() => {
    if (!isLoading && !isError && addresses.length === 0 && !autoOpened) {
      setAutoOpened(true);
      setMode("new");
    }
  }, [isLoading, isError, addresses.length, autoOpened]);

  const applyPick = (p: PickedLocation) => {
    setLocation({ lat: p.lat, lng: p.lng });
    setForm((f) => ({
      ...f,
      street: streetEdited || !p.line1 ? f.street : p.line1,
      area: p.area || f.area,
      city: p.city || f.city,
      state: p.state || f.state,
      pincode: p.pincode ? p.pincode.slice(0, 6) : f.pincode,
    }));
  };

  const selected = addresses.find((a) => a.id === selectedAddressId);
  const canContinue = Boolean(selected && selected.serviceable);

  const choose = (address: AddressView) => {
    if (!address.serviceable) {
      setNotServiceable(true);
      return;
    }
    setNotServiceable(false);
    setAddress(address.id, toSnapshot(address));
  };

  const setField = (key: keyof FormState) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleEdit = (addr: AddressView, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card selection when clicking edit
    setEditingId(addr.id);
    setForm({
      label: addr.label,
      house: addr.house ?? (addr.street ? "" : addr.line1),
      street: addr.street ?? "",
      area: addr.area ?? addr.line2 ?? "",
      landmark: addr.landmark ?? "",
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
    });
    setFormError(null);
    setNotServiceable(false);
    setLocation(addr.location ? { lat: addr.location.lat, lng: addr.location.lng } : undefined);
    setEditingLocation(addr.location ? { lat: addr.location.lat, lng: addr.location.lng } : null);
    setStreetEdited(true);
    setMode("new");
  };

    const handleDelete = (addrOrId: AddressView | string, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent card selection when clicking delete
    const addr = typeof addrOrId === "string" ? addresses.find((a) => a.id === addrOrId) : addrOrId;
    if (addr) {
      setDeleteError(null);
      setAddressToDelete(addr);
    }
  };

  const confirmDelete = async () => {
    if (!addressToDelete) return;
    const id = addressToDelete.id;
    setIsDeletingId(id);
    setDeleteError(null);

    try {
      await addressApi.delete(id);
      if (selectedAddressId === id) {
        setAddress("", null as any);
      }
      setAddressToDelete(null);
      showSuccess("Address deleted successfully!");
      refetch();
    } catch (err) {
      setDeleteError((err as NormalizedApiError).message ?? "Failed to delete address. Please try again.");
    } finally {
      setIsDeletingId(null);
    }
  };

  const submitNew = async (e: FormEvent) => {
    e.preventDefault();
    if (isCreating) return; 
    // Addresses saved before house / street existed only have one line, so don't force a street on those.
    const editing = addresses.find((a) => a.id === editingId);
    const streetRequired = !(editing && !editing.house && !editing.street);
    if (!form.house.trim() || (streetRequired && !form.street.trim()) || !form.city.trim() || !form.state.trim() || !/^\d{6}$/.test(form.pincode.trim())) {
      setFormError(`Please fill in your house number, ${streetRequired ? "street, " : ""}city, state and a 6-digit pincode.`);
      return;
    }
    setFormError(null);

    try {
      const check = await addressApi.checkServiceability(form.pincode.trim());
      if (!check.serviceable) {
        setFormError("Sorry, we don't currently service this pincode. Please enter a different address or serviceable pincode.");
        return;
      }

      const validLocation =
        location && typeof location.lat === "number" && typeof location.lng === "number" && !isNaN(location.lat) && !isNaN(location.lng)
          ? { lat: location.lat, lng: location.lng }
          : undefined;

      const payload = {
        label: ADDRESS_LABELS.find((l) => l === form.label) ?? "Home",
        house: form.house.trim(),
        ...(form.street.trim() ? { street: form.street.trim() } : {}),
        ...(form.area.trim() ? { area: form.area.trim() } : {}),
        ...(form.landmark.trim() ? { landmark: form.landmark.trim() } : {}),
        city: form.city.trim(),
        state: form.state.trim(),
        pincode: form.pincode.trim(),
        ...(validLocation ? { location: validLocation } : {}),
      };

      if (editingId) {
        const updated = await addressApi.update(editingId, payload);
        if (selectedAddressId === editingId) {
          setAddress(updated.id, toSnapshot(updated));
        }
        showSuccess("Address updated successfully!");
      } else {
        const created = await createAddress(payload);
        setAddress(created.id, toSnapshot(created));
        showSuccess("Address added successfully!");
      }

      setNotServiceable(false);
      setForm(EMPTY_FORM);
      setLocation(undefined);
      setEditingLocation(null);
      setStreetEdited(false);
      setEditingId(null);
      setMode("list");
      refetch();
    } catch (err) {
      setFormError((err as NormalizedApiError).message ?? "Couldn't save this address. Please try again.");
    }
  };

const startNew = () => {
  setEditingId(null);
  setForm(EMPTY_FORM);
  setFormError(null);
  setNotServiceable(false);
  setLocation(undefined);
  setEditingLocation(null);
  setStreetEdited(false);
  setMode("new");
};

const backToList = () => {
  setEditingId(null);
  setFormError(null);
  setNotServiceable(false);
  setMode("list");
};

const desktopBackBtn = (
  <button
    type="button"
    onClick={() => setStep(1)}
    className={clsx("inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-canvas", FOCUS_RING)}
  >
    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    Back
  </button>
);

const desktopActions =
  mode === "new" ? (
    <>
      <button
        type="button"
        onClick={backToList}
        className={clsx("inline-flex min-h-[48px] items-center justify-center rounded-full border border-line bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-canvas", FOCUS_RING)}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="address-form"
        disabled={isCreating}
        className={clsx("inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#3730A3] disabled:opacity-50", FOCUS_RING)}
      >
        {isCreating ? "Saving…" : editingId ? "Update address" : "Save & select"}
      </button>
    </>
  ) : (
    <>
      {desktopBackBtn}
      <button
        type="button"
        onClick={() => setStep(3)}
        disabled={!canContinue}
        className={clsx("group inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-95", FOCUS_RING)}
      >
        Next step
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
      </button>
    </>
  );

const mobileActions =
  mode === "new" ? (
    <div className="flex w-full items-center gap-3">
      <button
        type="button"
        onClick={backToList}
        className={clsx(
          "inline-flex min-h-[50px] items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50",
          FOCUS_RING,
        )}
      >
        Cancel
      </button>
      <button
        type="submit"
        form="address-form"
        disabled={isCreating}
        className={clsx(
          "inline-flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-full bg-[#4F46E5] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#3730A3] disabled:opacity-50",
          FOCUS_RING,
        )}
      >
        {isCreating ? "Saving…" : editingId ? "Update address" : "Save & select"}
      </button>
    </div>
  ) : (
    <div className="flex w-full items-center gap-3">
      <button
        type="button"
        onClick={() => setStep(1)}
        className={clsx(
          "inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-7 text-sm font-bold text-slate-800 shadow-xs transition-colors hover:bg-slate-50 active:scale-95",
          FOCUS_RING,
        )}
      >
        <ArrowLeft className="h-4 w-4 text-slate-700" aria-hidden="true" />
        Back
      </button>
      <button
        type="button"
        onClick={() => setStep(3)}
        disabled={!canContinue}
        className={clsx(
          "group inline-flex min-h-[50px] flex-1 items-center justify-center gap-2 rounded-full bg-[#4F46E5] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-50 active:scale-95",
          FOCUS_RING,
        )}
      >
        Next Step
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
      </button>
    </div>
  );

return (
  <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8">
    <div className="min-w-0 space-y-4 sm:space-y-6 pb-[56px] lg:pb-0">
      {/* Intro */}
      <div className="flex items-start gap-3.5">
        <span className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl sm:rounded-2xl bg-[#EEF2FF] sm:bg-brand text-[#4F46E5] sm:text-white shadow-xs">
          <MapPin className="h-5 w-5" aria-hidden="true" strokeWidth={2.2} />
        </span>
        <div>
          <h3 className="text-base sm:text-2xl font-bold tracking-tight text-slate-900 sm:text-ink">
            Choose Service Address
          </h3>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 sm:text-muted">
            Choose where you'd like the service performed.
          </p>
        </div>
      </div>

      {/* Success notification */}
      {successMessage && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-900 shadow-2xs animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true" />
            <span className="text-xs sm:text-sm font-semibold">{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="rounded-full p-1 text-emerald-700 hover:bg-emerald-100 transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {addressToDelete && (
        <DeleteConfirmDialog
          open={Boolean(addressToDelete)}
          busy={isDeletingId === addressToDelete.id}
          error={deleteError}
          address={addressToDelete}
          onCancel={() => {
            if (isDeletingId) return;
            setAddressToDelete(null);
            setDeleteError(null);
          }}
          onConfirm={confirmDelete}
        />
      )}

      <section aria-label="Service address" className="rounded-3xl border-0 bg-transparent p-0 shadow-none lg:border lg:border-line lg:bg-panel lg:p-6 lg:shadow-[0_24px_60px_-48px_rgba(67,56,202,.55)]">
        {mode === "list" && notServiceable && (
          <div role="alert" className="mb-4 rounded-2xl border border-danger bg-danger-soft px-4 py-3 text-sm text-ink">
            Sorry, we don't currently service that area. Please choose a different address.
          </div>
        )}

        {mode === "new" && (
          <div className="mb-5 flex items-center justify-between gap-3">
            <h4 className="text-base font-bold text-ink">{editingId ? "Edit address" : "Add a new address"}</h4>
            {addresses.length > 0 && (
              <button type="button" onClick={backToList} className={clsx("inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-brand hover:bg-brand-soft", FOCUS_RING)}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Saved addresses
              </button>
            )}
          </div>
        )}

        {mode === "list" && (
          <>
            {isLoading && <LoadingState label="Loading your addresses…" />}
            {isError && <ErrorState title="Couldn't load your addresses" message={error?.message} onRetry={refetch} />}
            {!isLoading && !isError && addresses.length === 0 && (
              <EmptyState
                title="No saved addresses yet"
                description="Add an address to continue."
                action={
                  <button
                    type="button"
                    onClick={startNew}
                    className={clsx("min-h-[44px] rounded-full bg-brand px-5 text-sm font-semibold text-white", FOCUS_RING)}
                  >
                    + Add new address
                  </button>
                }
              />
            )}
            {!isLoading && !isError && addresses.length > 0 && (
              <div role="radiogroup" aria-label="Saved addresses" className="grid gap-3 sm:gap-3.5">
                {/* Add new address banner matching reference design */}
                <button
                  type="button"
                  onClick={startNew}
                  className={clsx(
                    "flex w-full items-center gap-3.5 rounded-2xl border border-dashed border-[#C7D2FE] bg-[#F7F8FE] p-3.5 sm:p-4 text-left transition-all hover:bg-[#EEF2FF] hover:border-[#818CF8]",
                    FOCUS_RING,
                  )}
                >
                  <span className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-[#4F46E5] text-white shadow-xs">
                    <Plus className="h-5 w-5" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[#4F46E5]">Add New Address</span>
                    <span className="block text-xs text-slate-500">Pin it on the map and we'll fill in the details.</span>
                  </span>
                  <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" aria-hidden="true" />
                </button>

                {/* Saved address cards */}
                {sortedAddresses.map((addr) => {
                  const isSelected = selectedAddressId === addr.id;
                  const isDeleting = isDeletingId === addr.id;
                  const Icon = LABEL_ICONS[addr.label] ?? MapPin;
                  return (
                    <div
                      key={addr.id}
                      role="radio"
                      aria-checked={isSelected}
                      aria-disabled={!addr.serviceable}
                      tabIndex={0}
                      onClick={() => choose(addr)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") choose(addr);
                      }}
                      className={clsx(
                        "relative w-full cursor-pointer overflow-hidden rounded-2xl text-left transition-all duration-200 motion-reduce:transition-none p-3.5 sm:p-4",
                        FOCUS_RING,
                        isSelected
                          ? "border-2 border-[#4F46E5] bg-white sm:bg-[#F9FAFE] shadow-xs"
                          : "border border-slate-200/90 bg-white hover:border-[#C7D2FE] shadow-xs",
                        isDeleting && "opacity-50",
                      )}
                    >
                      <div className="flex items-start gap-3 sm:gap-3.5">
                        <span
                          className={clsx(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            isSelected ? "bg-[#EEF2FF] text-[#4F46E5]" : "bg-slate-100 text-slate-600",
                          )}
                        >
                          <Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-bold text-slate-900">{addr.label}</span>
                                {isSelected && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-[#4F46E5] px-2.5 py-0.5 text-[11px] font-bold text-white shadow-xs">
                                    <Check className="h-3 w-3 stroke-[2.5]" aria-hidden="true" /> Selected
                                  </span>
                                )}
                                {!addr.serviceable && (
                                  <span className="inline-flex items-center rounded-full bg-[#FEE2E2] px-2.5 py-0.5 text-[11px] font-semibold text-[#EF4444]">
                                    Not serviceable
                                  </span>
                                )}
                              </div>
                              {addr.isDefault && (
                                <span className="mt-1 inline-block rounded-md bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold text-[#4F46E5]">
                                  Default
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => handleEdit(addr, e)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                                aria-label={`Edit ${addr.label} address`}
                                title="Edit address"
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                disabled={isDeleting}
                                onClick={(e) => handleDelete(addr, e)}
                                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                aria-label={`Delete ${addr.label} address`}
                                title="Delete address"
                              >
                                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                              </button>
                            </div>
                          </div>

                          <div className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
                            <p className="break-words">{addr.line1}</p>
                            {addr.line2 && <p className="break-words">{addr.line2}</p>}
                            <p className="break-words text-slate-500">
                              {addr.city}, {addr.state} – {addr.pincode}
                              {addr.landmark ? ` · Near ${addr.landmark}` : ""}
                            </p>
                          </div>
                        </div>
                      </div>

                      {!addr.serviceable && (
                        <div className="mt-3.5 flex items-center justify-between rounded-xl bg-[#FEF2F2] border border-[#FEE2E2] px-3 py-2 text-xs text-[#DC2626]">
                          <span className="inline-flex items-center gap-1.5 font-medium">
                            <TriangleAlert className="h-4 w-4 text-[#EF4444] shrink-0" aria-hidden="true" />
                            We don't serve this area yet.
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleEdit(addr, e)}
                            className="font-semibold text-[#DC2626] underline hover:text-[#B91C1C]"
                          >
                            Edit pincode
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {mode === "new" && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-xs">
            <form id="address-form" onSubmit={submitNew} className="space-y-4" noValidate>
            <div>
              <p className="mb-2 text-xs font-semibold text-ink">Pin your location</p>
              <MapAddressPicker
                key={editingId ?? "new"}
                value={editingLocation}
                onPick={applyPick}
                autoLocate={!editingId}
                className="h-[300px] sm:h-[340px]"
              />
              <p className="mt-2 text-xs text-muted">Drag the map or search. We'll fill in the details below. You can still edit them.</p>
            </div>
            {formError && (
              <div role="alert" className="rounded-2xl border border-danger bg-danger-soft px-4 py-3 text-sm text-ink">
                {formError}
              </div>
            )}
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-ink">Save as</legend>
              <div className="grid grid-cols-3 gap-2">
                {LABELS.map((l) => {
                  const Icon = LABEL_ICONS[l];
                  const active = form.label === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setForm((f) => ({ ...f, label: l }))}
                      className={clsx(
                        "flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border text-[13px] font-medium transition-colors sm:min-h-[48px] sm:gap-2 sm:text-sm",
                        active ? "border-brand bg-brand-soft text-brand" : "border-line bg-canvas text-muted hover:border-brand/50",
                        FOCUS_RING,
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" /> {l}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <label htmlFor="addr-house" className="mb-1.5 block text-xs font-semibold text-ink">House / flat no.</label>
                <input id="addr-house" value={form.house} onChange={setField("house")} maxLength={100} autoComplete="address-line1" placeholder="Flat 302, Manjeera Trinity" className={inputClass} />
              </div>
              <div>
                <label htmlFor="addr-street" className="mb-1.5 block text-xs font-semibold text-ink">Street / road</label>
                <input id="addr-street" value={form.street} onChange={(e) => { setField("street")(e); setStreetEdited(true); }} maxLength={150} autoComplete="address-line2" className={inputClass} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <label htmlFor="addr-area" className="mb-1.5 block text-xs font-semibold text-ink">Area / locality (optional)</label>
                <input id="addr-area" value={form.area} onChange={setField("area")} maxLength={150} className={inputClass} />
              </div>
              <div>
                <label htmlFor="addr-landmark" className="mb-1.5 block text-xs font-semibold text-ink">Landmark (optional)</label>
                <input id="addr-landmark" value={form.landmark} onChange={setField("landmark")} maxLength={200} className={inputClass} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <label htmlFor="addr-city" className="mb-1.5 block text-xs font-semibold text-ink">City</label>
                <input id="addr-city" value={form.city} onChange={setField("city")} autoComplete="address-level2" className={inputClass} />
              </div>
              <div>
                <label htmlFor="addr-state" className="mb-1.5 block text-xs font-semibold text-ink">State</label>
                <input id="addr-state" value={form.state} onChange={setField("state")} autoComplete="address-level1" className={inputClass} />
              </div>
            </div>
            <div>
              <label htmlFor="addr-pincode" className="mb-1.5 block text-xs font-semibold text-ink">Pincode</label>
              <input
                id="addr-pincode"
                value={form.pincode}
                onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) }))}
                inputMode="numeric"
                maxLength={6}
                autoComplete="postal-code"
                aria-describedby="addr-pincode-hint"
                className={clsx(inputClass, "sm:max-w-[16rem]")}
              />
              <p id="addr-pincode-hint" role="status" aria-live="polite" className="mt-2 flex min-h-[1.75rem] items-center text-xs">
                {!pincodeReady && <span className="text-muted">Enter your 6-digit pincode to check we serve your area.</span>}
                {pincodeReady && serviceability.isFetching && (
                  <span className="inline-flex items-center gap-1.5 text-muted">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> Checking your area…
                  </span>
                )}
                {pincodeReady && !serviceability.isFetching && serviceability.data?.serviceable && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> We serve {serviceability.data.city}.
                  </span>
                )}
                {pincodeReady && !serviceability.isFetching && serviceability.data && !serviceability.data.serviceable && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-3 py-1 font-medium text-danger">
                    <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" /> We don&apos;t service this pincode yet.
                  </span>
                )}
                {pincodeReady && serviceability.isError && <span className="text-muted">Couldn&apos;t check this pincode right now.</span>}
              </p>
            </div>
          </form>
        </div>
      )}
      </section>

        {/* Mobile / tablet: sticky action bar (Back & Next Step) */}
        <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] md:bottom-0 z-20 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.06)] lg:hidden">
          <div className="mx-auto max-w-md">
            {mobileActions}
          </div>
        </div>
      </div>

      {/* Desktop: sticky summary */}
      <BookingSummary ariaLabel="Your booking" actions={desktopActions} footnote="Only serviceable areas can be selected" />
    </div>
);
}
