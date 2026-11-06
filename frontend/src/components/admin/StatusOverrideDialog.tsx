import React, { useEffect, useState } from "react";

import { adminBookingApi } from "@/services/adminBookingApi";
import { BookingActionPanel } from "@/components/admin/BookingActionPanel";
import type {
  AdminBooking,
  BookingStatus,
} from "@/types/adminBooking";

interface StatusOverrideDialogProps {
  booking: AdminBooking | null;
  open: boolean;
  onClose: () => void;
  onUpdated?: (booking: AdminBooking) => void;
}

const BOOKING_STATUS_OPTIONS: Array<{
  value: BookingStatus;
  label: string;
}> = [
  {
    value: "created",
    label: "Pending",
  },
  {
    value: "searching_for_partner",
    label: "Searching for Partner",
  },
  {
    value: "assigned",
    label: "Assigned",
  },
  {
    value: "en_route",
    label: "En Route",
  },
  {
    value: "arrived",
    label: "Arrived",
  },
  {
    value: "in_progress",
    label: "In Progress",
  },
  {
    value: "completed",
    label: "Completed",
  },
  {
    value: "rated",
    label: "Rated",
  },
  {
    value: "cancelled_by_customer",
    label: "Cancelled by Customer",
  },
  {
    value: "cancelled_by_partner",
    label: "Cancelled by Partner",
  },
  {
    value: "cancelled_by_admin",
    label: "Cancelled by Admin",
  },
  {
    value: "no_show",
    label: "No Show",
  },
  {
    value: "disputed",
    label: "Disputed",
  },
];

const EXTRA_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending Payment",
  confirmed: "Confirmed",
};

/**
 * Statuses an admin may move a booking to, mirroring the backend state machine
 * (bookings.stateMachine.ts). Anything not listed would be rejected by the API
 * with "Cannot move a booking from X to Y", so it is not offered here.
 */
const ADMIN_ALLOWED_NEXT: Record<string, string[]> = {
  pending_payment: ["cancelled_by_customer", "cancelled_by_admin"],
  confirmed: ["assigned", "cancelled_by_customer", "cancelled_by_admin"],
  created: ["cancelled_by_customer", "cancelled_by_admin"],
  searching_for_partner: ["assigned", "cancelled_by_customer", "cancelled_by_admin"],
  assigned: ["en_route", "cancelled_by_customer", "cancelled_by_partner", "cancelled_by_admin"],
  en_route: ["arrived", "cancelled_by_customer", "cancelled_by_partner", "cancelled_by_admin"],
  arrived: ["in_progress", "no_show", "cancelled_by_customer", "cancelled_by_partner", "cancelled_by_admin"],
  in_progress: ["completed", "disputed", "cancelled_by_customer", "cancelled_by_admin"],
  completed: ["rated", "disputed", "cancelled_by_customer", "cancelled_by_admin"],
  rated: ["disputed", "cancelled_by_customer", "cancelled_by_admin"],
  cancelled_by_partner: ["searching_for_partner", "cancelled_by_admin"],
  no_show: ["searching_for_partner", "cancelled_by_customer", "cancelled_by_admin", "disputed"],
  cancelled_by_customer: [],
  cancelled_by_admin: [],
  disputed: [],
};

function getStatusLabel(status: BookingStatus | string): string {
  return (
    BOOKING_STATUS_OPTIONS.find(
      (option) => option.value === status,
    )?.label ??
    EXTRA_STATUS_LABELS[status] ??
    status
  );
}

function getErrorMessage(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof err.message === "string"
  ) {
    return err.message;
  }

  return "Unable to update booking status. Please try again.";
}

export const StatusOverrideDialog: React.FC<
  StatusOverrideDialogProps
> = ({
  booking,
  open,
  onClose,
  onUpdated,
}) => {
  const [status, setStatus] =
    useState<BookingStatus>("created");

  const [reason, setReason] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!open || !booking) {
      setReason("");
      setSubmitting(false);
      setError("");
      return;
    }

    setStatus(booking.status);
    setReason("");
    setSubmitting(false);
    setError("");
  }, [open, booking]);

  if (!open || !booking) {
    return null;
  }

  const trimmedReason =
    reason.trim();

  const reasonError =
    reason.length > 0 &&
    trimmedReason.length === 0
      ? "Reason cannot be empty."
      : "";

  const allowedNext = ADMIN_ALLOWED_NEXT[booking.status] ?? [];

  const statusChoices = BOOKING_STATUS_OPTIONS.filter((option) =>
    allowedNext.includes(option.value),
  );

  const noTransitions = statusChoices.length === 0;

  const sameStatus =
    status === booking.status;

  const canSubmit =
    !submitting &&
    trimmedReason.length > 0 &&
    !sameStatus;

  const handleStatusChange = (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setStatus(
      event.target.value as BookingStatus,
    );

    setError("");
  };

  const handleReasonChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setReason(
      event.target.value,
    );

    setError("");
  };

  const handleSubmit = async () => {
    if (!booking) {
      return;
    }

    if (!trimmedReason) {
      setError(
        "A reason is required for a status override.",
      );
      return;
    }

    if (sameStatus) {
      setError(
        "Please select a different status before submitting.",
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const updatedBooking =
        await adminBookingApi.overrideStatus(
          booking.id,
          {
            status,
            reason: trimmedReason,
          },
        );

      onUpdated?.(
        updatedBooking,
      );

      onClose();
    } catch (err) {
      setError(
        getErrorMessage(err),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BookingActionPanel
      title="Override Booking Status"
      subtitle={`Customer: ${booking.customer?.name || "-"}`}
      titleId="status-override-title"
      onClose={onClose}
      closeDisabled={submitting}
      closeLabel="Close status override"
      footer={
        <>
          <button
            type="button"
            className="bk-btn"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>

          <button
            type="button"
            className="bk-btn bk-btn--primary"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {submitting ? "Updating..." : "Override Status"}
          </button>
        </>
      }
    >
      <div className="bk-card">
        <p className="bk-card__title">Update booking status</p>

        <p className="bk-card__text">
          Administrators can override the booking status when a
          manual correction is required. A reason is required and
          will be recorded for audit purposes.
        </p>
      </div>

      <div className="bk-card">
        <div className="bk-field">
          <span className="bk-label">Current Status</span>

          <div
            className="bk-current"
            aria-label={`Current status: ${getStatusLabel(
              booking.status,
            )}`}
          >
            <span>Current</span>
            <span>{getStatusLabel(booking.status)}</span>
          </div>
        </div>

        <div className="bk-field">
          <label htmlFor="booking-new-status" className="bk-label">
            New Status <span className="bk-required">*</span>
          </label>

          <select
            id="booking-new-status"
            className="bk-select"
            value={status}
            onChange={handleStatusChange}
            disabled={submitting || noTransitions}
          >
            <option value={booking.status}>
              {getStatusLabel(booking.status)} (current)
            </option>
            {statusChoices.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {noTransitions ? (
            <p className="bk-help">
              This booking is in a final state, so its status cannot be changed.
            </p>
          ) : null}
        </div>

        <div className="bk-field">
          <label htmlFor="booking-status-reason" className="bk-label">
            Reason <span className="bk-required">*</span>
          </label>

          <textarea
            id="booking-status-reason"
            className={[
              "bk-textarea",
              reasonError ? "bk-textarea--error" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            value={reason}
            onChange={handleReasonChange}
            placeholder="Enter the reason for overriding this booking status"
            disabled={submitting}
            aria-required="true"
            aria-invalid={Boolean(reasonError)}
            aria-describedby="booking-status-reason-help"
          />

          {reasonError ? (
            <p className="bk-error">{reasonError}</p>
          ) : (
            <p id="booking-status-reason-help" className="bk-help">
              A reason is required and will be recorded with the
              status override.
            </p>
          )}
        </div>

        {sameStatus && (
          <div className="bk-alert bk-alert--warning" role="status">
            The selected status is already the current status. Select
            a different status to continue.
          </div>
        )}

        {error && (
          <div className="bk-alert" role="alert">
            {error}
          </div>
        )}
      </div>
    </BookingActionPanel>
  );
};