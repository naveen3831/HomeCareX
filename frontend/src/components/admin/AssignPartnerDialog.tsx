import React, { useEffect, useMemo, useState } from "react";
import { adminBookingApi } from "@/services/adminBookingApi";
import { BookingActionPanel } from "@/components/admin/BookingActionPanel";

import type {
  AdminBooking,
  BookingPartnerCandidate,
} from "@/types/adminBooking";

interface AssignPartnerDialogProps {
  booking: AdminBooking | null;
  open: boolean;
  partners: BookingPartnerCandidate[];
  loading?: boolean;
  onClose: () => void;
  onAssigned?: (booking: AdminBooking) => void;
}

type PartnerCandidateView = BookingPartnerCandidate & {
  eligible?: boolean;
  eligibilityReasons?: string[];

  isOnline?: boolean;
  online?: boolean;
  is_online?: boolean;
  availability?: {
    isOnline?: boolean;
    online?: boolean;
    status?: string;
  };
  availabilityStatus?: string;
  onlineStatus?: string;
  status?: string;

  distanceKm?: number | null;
  serviceRadiusKm?: number | null;
  kycStatus?: string;
  accountStatus?: string;

  available?: boolean;
  isAvailable?: boolean;
  hasConflict?: boolean;

  rating?: number;
  ratingCount?: number;

  categories?: string[];
  cities?: string[];
  areas?: string[];
  conflictBookingIds?: string[];
};

function asPartnerView(
  partner: BookingPartnerCandidate,
): PartnerCandidateView {
  return partner as PartnerCandidateView;
}

function getOnlineStatus(
  partner: PartnerCandidateView,
): boolean | null {
  const booleanValues = [
    partner.isOnline,
    partner.online,
    partner.is_online,
    partner.availability?.isOnline,
    partner.availability?.online,
  ];

  for (const value of booleanValues) {
    if (typeof value === "boolean") {
      return value;
    }
  }

  const statusValues = [
    partner.availability?.status,
    partner.availabilityStatus,
    partner.onlineStatus,
    partner.status,
  ];

  for (const value of statusValues) {
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (
        ["online", "available", "active"].includes(normalized)
      ) {
        return true;
      }

      if (
        ["offline", "unavailable", "inactive"].includes(normalized)
      ) {
        return false;
      }
    }
  }

  return null;
}

function getPartnerAvailability(
  partner: PartnerCandidateView,
): boolean | null {
  if (typeof partner.available === "boolean") {
    return partner.available;
  }

  if (typeof partner.isAvailable === "boolean") {
    return partner.isAvailable;
  }

  return null;
}

function isEligiblePartner(
  partner: PartnerCandidateView,
): boolean {
  // An offline partner can never be assigned, even if the
  // backend flag says otherwise.
  return (
    partner.eligible === true &&
    getOnlineStatus(partner) !== false
  );
}

function getDistanceValue(
  partner: PartnerCandidateView,
): number {
  return typeof partner.distanceKm === "number" &&
    Number.isFinite(partner.distanceKm)
    ? partner.distanceKm
    : Number.POSITIVE_INFINITY;
}

/**
 * Order: assignable first, then online, then nearest to the
 * service location. Rating is the final tie-breaker.
 */
function comparePartners(
  a: PartnerCandidateView,
  b: PartnerCandidateView,
): number {
  const eligibleDiff =
    Number(isEligiblePartner(b)) - Number(isEligiblePartner(a));
  if (eligibleDiff !== 0) return eligibleDiff;

  const onlineDiff =
    Number(getOnlineStatus(b) === true) -
    Number(getOnlineStatus(a) === true);
  if (onlineDiff !== 0) return onlineDiff;

  const distanceDiff = getDistanceValue(a) - getDistanceValue(b);
  if (Number.isFinite(distanceDiff) && distanceDiff !== 0) {
    return distanceDiff;
  }

  return (b.rating ?? 0) - (a.rating ?? 0);
}

function getReasons(
  partner: PartnerCandidateView,
): string[] {
  return Array.isArray(partner.eligibilityReasons)
    ? partner.eligibilityReasons
    : [];
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === "string",
      )
    : [];
}

function formatDistance(
  distance: number | null | undefined,
): string {
  if (
    typeof distance !== "number" ||
    !Number.isFinite(distance)
  ) {
    return "Distance unavailable";
  }

  return `${distance.toFixed(1)} km away`;
}

function formatStatus(value?: string): string {
  if (!value) return "Unknown";

  return value.charAt(0).toUpperCase() +
    value.slice(1).toLowerCase();
}

function getBadgeClass(
  value: boolean | null,
): string {
  if (value === true) return "bk-badge bk-badge--success";
  if (value === false) return "bk-badge bk-badge--danger";
  return "bk-badge";
}

export const AssignPartnerDialog: React.FC<
  AssignPartnerDialogProps
> = ({
  booking,
  open,
  partners,
  loading = false,
  onClose,
  onAssigned,
}) => {
  const [selectedPartnerId, setSelectedPartnerId] =
    useState("");

  const [assignmentReason, setAssignmentReason] =
    useState("");

  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState("");

  const partnerViews = useMemo(
    () => partners.map(asPartnerView).sort(comparePartners),
    [partners],
  );

  useEffect(() => {
    if (!open) {
      setSelectedPartnerId("");
      setAssignmentReason("");
      setError("");
      setAssigning(false);
      return;
    }

    setSelectedPartnerId(booking?.partner?.id ?? "");
    setAssignmentReason("");
    setError("");
  }, [open, booking?.id]);

  const eligiblePartners = useMemo(
    () => partnerViews.filter(isEligiblePartner),
    [partnerViews],
  );

  // Only online partners near the customer's location are listed.
  const displayedPartners = eligiblePartners;

  const selectedPartner = useMemo(
    () =>
      partnerViews.find(
        (partner) => partner.id === selectedPartnerId,
      ) ?? null,
    [partnerViews, selectedPartnerId],
  );

  const onlineCount = useMemo(
    () =>
      partnerViews.filter(
        (partner) => getOnlineStatus(partner) === true,
      ).length,
    [partnerViews],
  );

  const unknownOnlineCount = useMemo(
    () =>
      partnerViews.filter(
        (partner) => getOnlineStatus(partner) === null,
      ).length,
    [partnerViews],
  );

  const handleAssign = async () => {
    if (!booking || !selectedPartner) {
      setError("Please select an eligible partner.");
      return;
    }

    if (!isEligiblePartner(selectedPartner)) {
      setError(
        "This partner is not eligible for this booking.",
      );
      return;
    }

    if (!assignmentReason.trim()) {
      setError("Assignment reason is required.");
      return;
    }

    setAssigning(true);
    setError("");

    try {
      const updatedBooking =
        await adminBookingApi.assignPartner(
          booking.id,
          {
            partnerId: selectedPartner.id,
            reason: assignmentReason.trim(),
          },
        );

      onAssigned?.(updatedBooking);
      onClose();
    } catch (err: unknown) {
      const message =
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof err.message === "string"
          ? err.message
          : "Unable to assign partner. Please try again.";

      setError(message);
    } finally {
      setAssigning(false);
    }
  };

  if (!open || !booking) return null;

  const isReassignment = Boolean(booking.partner);

  const canAssign =
    selectedPartner !== null &&
    isEligiblePartner(selectedPartner) &&
    assignmentReason.trim().length > 0 &&
    !assigning &&
    !loading;

  return (
    <BookingActionPanel
      title={isReassignment ? "Reassign Partner" : "Assign Partner"}
      subtitle={`Customer: ${booking.customer?.name || "-"}`}
      titleId="assign-title"
      onClose={onClose}
      closeDisabled={assigning}
      footer={
        <>
          <button
            type="button"
            className="bk-btn"
            onClick={onClose}
            disabled={assigning}
          >
            Cancel
          </button>

          <button
            type="button"
            className="bk-btn bk-btn--primary"
            onClick={() => void handleAssign()}
            disabled={!canAssign}
          >
            {assigning
              ? "Assigning..."
              : isReassignment
                ? "Reassign Partner"
                : "Assign Partner"}
          </button>
        </>
      }
    >
      <div className="bk-card">
        <p className="bk-card__title">{booking.service.name}</p>

        <p className="bk-card__text">
          {booking.service.category} · {booking.city} ·{" "}
          {booking.address.area} · {booking.slot.date} ·{" "}
          {booking.slot.startTime} - {booking.slot.endTime}
        </p>
      </div>

      <div className="bk-toolbar">
        <span className="bk-toolbar__count">
          {eligiblePartners.length} eligible · {onlineCount} online
          {unknownOnlineCount > 0
            ? ` · ${unknownOnlineCount} status unknown`
            : ""}
        </span>
      </div>

      {loading ? (
        <div className="bk-empty">Loading partners...</div>
      ) : displayedPartners.length === 0 ? (
        <div className="bk-empty">
          {partnerViews.length === 0
            ? "No partner records were returned by the server."
            : "No online partners are available near the customer's location for this booking."}
        </div>
      ) : (
        <div className="bk-partner-list">
          {displayedPartners.map((partner) => {
            const eligible = isEligiblePartner(partner);
            const online = getOnlineStatus(partner);
            const availability = getPartnerAvailability(partner);
            const selected = partner.id === selectedPartnerId;
            const offline = online === false;
            const isNearest =
              eligible && partner.id === eligiblePartners[0]?.id;

            const reasons = getReasons(partner);
            const categories = getStringArray(partner.categories);
            const cities = getStringArray(partner.cities);
            const areas = getStringArray(partner.areas);
            const conflicts = getStringArray(partner.conflictBookingIds);

            return (
              <button
                key={partner.id}
                type="button"
                className={[
                  "bk-partner",
                  selected ? "bk-partner--selected" : "",
                  !eligible ? "bk-partner--disabled" : "",
                  offline ? "bk-partner--offline" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={!eligible || offline || assigning}
                aria-disabled={!eligible || offline}
                onClick={() => setSelectedPartnerId(partner.id)}
                aria-pressed={selected}
              >
                <div className="bk-partner__head">
                  <div>
                    <p className="bk-partner__name">{partner.name}</p>
                    <p className="bk-partner__email">
                      {partner.email ?? "Partner"}
                    </p>
                  </div>

                  {selected ? (
                    <span className="bk-tag">Selected</span>
                  ) : isNearest ? (
                    <span className="bk-tag">Nearest</span>
                  ) : null}
                </div>

                <div className="bk-badges">
                  {categories.length > 0 && (
                    <span className="bk-badge">
                      Categories: {categories.join(", ")}
                    </span>
                  )}

                  {cities.length > 0 && (
                    <span className="bk-badge">
                      City: {cities.join(", ")}
                    </span>
                  )}

                  {areas.length > 0 && (
                    <span className="bk-badge">
                      Areas: {areas.join(", ")}
                    </span>
                  )}

                  <span className={getBadgeClass(online)}>
                    {online === true
                      ? "Online"
                      : online === false
                        ? "Offline"
                        : "Online status unknown"}
                  </span>

                  <span className="bk-badge">
                    {formatDistance(partner.distanceKm)}
                  </span>

                  {typeof partner.serviceRadiusKm === "number" && (
                    <span className="bk-badge">
                      Radius: {partner.serviceRadiusKm} km
                    </span>
                  )}

                  {partner.kycStatus !== undefined && (
                    <span
                      className={getBadgeClass(
                        partner.kycStatus.toLowerCase() === "approved",
                      )}
                    >
                      KYC: {formatStatus(partner.kycStatus)}
                    </span>
                  )}

                  {partner.accountStatus !== undefined && (
                    <span
                      className={getBadgeClass(
                        partner.accountStatus.toLowerCase() === "active",
                      )}
                    >
                      Account: {formatStatus(partner.accountStatus)}
                    </span>
                  )}

                  {availability !== null && (
                    <span className={getBadgeClass(availability)}>
                      {availability ? "Available" : "Unavailable"}
                    </span>
                  )}

                  {typeof partner.rating === "number" && (
                    <span className="bk-badge">
                      Rating: {partner.rating.toFixed(1)}
                      {typeof partner.ratingCount === "number"
                        ? ` (${partner.ratingCount})`
                        : ""}
                    </span>
                  )}

                  {conflicts.length > 0 && (
                    <span className="bk-badge bk-badge--danger">
                      {conflicts.length} schedule conflict(s)
                    </span>
                  )}
                </div>

                {!eligible && (
                  <div className="bk-partner__reason">
                    <strong>Cannot assign:</strong>{" "}
                    {offline && !reasons.length
                      ? "Partner is offline"
                      : reasons.length > 0
                        ? reasons.join(" · ")
                        : "The backend has marked this partner as ineligible."}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="bk-card">
        <div className="bk-field">
          <label htmlFor="assignment-reason" className="bk-label">
            Assignment Reason <span className="bk-required">*</span>
          </label>

          <textarea
            id="assignment-reason"
            className="bk-textarea"
            value={assignmentReason}
            onChange={(event) => {
              setAssignmentReason(event.target.value);

              if (error === "Assignment reason is required.") {
                setError("");
              }
            }}
            placeholder="Enter reason for assigning this partner"
            rows={4}
            disabled={assigning}
          />

          <p className="bk-help">Reason is required for audit purposes.</p>
        </div>

        {error && (
          <div className="bk-alert" role="alert">
            {error}
          </div>
        )}
      </div>
    </BookingActionPanel>
  );
};

export default AssignPartnerDialog;