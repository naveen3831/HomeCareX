import React from "react";

import type {
  AdminBooking,
  BookingStatus,
  PaymentStatus,
} from "@/types/adminBooking";

interface BookingTableProps {
  bookings: AdminBooking[];
  onBookingSelect?: (booking: AdminBooking) => void;
}

function formatDate(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function getStatusLabel(status: BookingStatus): string {
  switch (status) {
    case "created":
      return "Pending";

    case "searching_for_partner":
      return "Searching for Partner";

    case "assigned":
      return "Assigned";

    case "en_route":
      return "En Route";

    case "arrived":
      return "Arrived";

    case "in_progress":
      return "In Progress";

    case "completed":
      return "Completed";

    case "rated":
      return "Rated";

    case "cancelled_by_customer":
      return "Cancelled by Customer";

    case "cancelled_by_partner":
      return "Cancelled by Partner";

    case "cancelled_by_admin":
      return "Cancelled by Admin";

    case "no_show":
      return "No Show";

    case "disputed":
      return "Disputed";

    default:
      return status;
  }
}

function getStatusClass(status: BookingStatus): string {
  switch (status) {
    case "completed":
    case "rated":
      return "booking-table__status booking-table__status--completed";

    case "cancelled_by_customer":
    case "cancelled_by_partner":
    case "cancelled_by_admin":
    case "no_show":
      return "booking-table__status booking-table__status--cancelled";

    case "in_progress":
    case "en_route":
    case "arrived":
      return "booking-table__status booking-table__status--progress";

    case "assigned":
      return "booking-table__status booking-table__status--assigned";

    case "searching_for_partner":
      return "booking-table__status booking-table__status--confirmed";

    case "disputed":
      return "booking-table__status booking-table__status--cancelled";

    case "created":
    default:
      return "booking-table__status booking-table__status--pending";
  }
}

function getPaymentClass(status: PaymentStatus): string {
  switch (status) {
    case "Paid":
      return "booking-table__status booking-table__status--paid";

    case "Failed":
      return "booking-table__status booking-table__status--failed";

    case "Refunded":
      return "booking-table__status booking-table__status--refunded";

    case "Pending":
    default:
      return "booking-table__status booking-table__status--payment-pending";
  }
}
const SLOT_RANGE = /^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/;

const toClock = (value?: string) => {
  if (!value) return "";
  if (/^\d{1,2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata",
      });
};

/** startTime may already be a "18:00-20:00" range, and endTime may be an ISO timestamp. Show one clean range. */
const formatSlotRange = (slot?: { startTime?: string; endTime?: string }) => {
  const start = slot?.startTime ?? "";
  if (SLOT_RANGE.test(start)) return start.replace(/\s+/g, "");
  const a = toClock(start);
  const b = toClock(slot?.endTime);
  return a && b && a !== b ? `${a}-${b}` : a || b || "-";
};
export const BookingTable: React.FC<BookingTableProps> = ({
  bookings,
  onBookingSelect,
}) => {
  if (bookings.length === 0) {
    return (
      <>
        <style>{`
          .booking-table__empty {
            padding: 40px 20px;
            text-align: center;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            background: #ffffff;
          }

          .booking-table__empty h3 {
            margin: 0 0 8px;
            font-size: 16px;
            color: #111827;
          }

          .booking-table__empty p {
            margin: 0;
            color: #6b7280;
            font-size: 14px;
          }
        `}</style>

        <div className="booking-table__empty">
          <h3>No bookings found</h3>

          <p>
            There are no bookings matching the current filters.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{`
        .booking-table__wrapper {
          width: 100%;
          overflow-x: auto;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #ffffff;
        }

        .booking-table {
          width: 100%;
          min-width: 1100px;
          border-collapse: collapse;
        }

        .booking-table th,
        .booking-table td {
          padding: 12px 16px;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }

        .booking-table th {
          background: #f8fafc;
          color: #374151;
          font-size: 13px;
          font-weight: 600;
          white-space: nowrap;
           position: sticky;                  /* new */
  top: 0;                            /* new */
  z-index: 1;  
        }

        .booking-table td {
          color: #111827;
          font-size: 14px;
          vertical-align: middle;
        }

        .booking-table tbody tr:last-child td {
          border-bottom: none;
        }

        .booking-table__row--clickable {
          cursor: pointer;
        }

        .booking-table__row--clickable:hover {
          background: #f8fafc;
        }

        .booking-table__booking-id {
          white-space: nowrap;
        }

        .booking-table__booking-button {
          padding: 0;
          border: 0;
          background: transparent;
          color: #2563eb;
          font: inherit;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
        }

        .booking-table__booking-button:hover {
          text-decoration: underline;
        }

        .booking-table__booking-button:focus-visible {
          outline: 2px solid #2563eb;
          outline-offset: 3px;
          border-radius: 3px;
        }

        .booking-table__primary {
          font-weight: 500;
          color: #111827;
        }

        .booking-table__secondary {
          margin-top: 3px;
          color: #6b7280;
          font-size: 12px;
          line-height: 1.4;
        }

        .booking-table__amount {
          font-weight: 600;
          color: #111827;
          white-space: nowrap;
        }

        .booking-table__created {
          color: #4b5563;
          font-size: 13px;
          white-space: nowrap;
        }

        .booking-table__unassigned {
          color: #9ca3af;
          font-style: italic;
        }

        .booking-table__status {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.2;
          white-space: nowrap;
        }

        .booking-table__status--completed {
          background: #dcfce7;
          color: #166534;
        }

        .booking-table__status--cancelled {
          background: #fee2e2;
          color: #991b1b;
        }

        .booking-table__status--progress {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .booking-table__status--confirmed {
          background: #e0e7ff;
          color: #3730a3;
        }

        .booking-table__status--assigned {
          background: #fef3c7;
          color: #92400e;
        }

        .booking-table__status--pending {
          background: #f3f4f6;
          color: #374151;
        }

        .booking-table__status--paid {
          background: #dcfce7;
          color: #166534;
        }

        .booking-table__status--failed {
          background: #fee2e2;
          color: #991b1b;
        }

        .booking-table__status--refunded {
          background: #e0e7ff;
          color: #3730a3;
        }

        .booking-table__status--payment-pending {
          background: #f3f4f6;
          color: #374151;
        }

        .booking-table__empty {
          padding: 40px 20px;
          text-align: center;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          background: #ffffff;
        }

        .booking-table__empty h3 {
          margin: 0 0 8px;
          font-size: 16px;
          color: #111827;
        }

        .booking-table__empty p {
          margin: 0;
          color: #6b7280;
          font-size: 14px;
        }

        /* Phones and small tablets: one card per booking instead of a 1100px-wide table (nothing to swipe sideways) */
        .booking-cards { display: none; margin: 0; padding: 0; list-style: none; }

        @media (max-width: 768px) {
          .booking-table__wrapper { display: none; }

          .booking-cards { display: flex; flex-direction: column; gap: 10px; }
          .booking-card { display: flex; flex-direction: column; gap: 10px; padding: 12px 14px; background: #fff; border: 1px solid #e8ebf3; border-radius: 14px; box-shadow: 0 1px 2px rgba(15, 23, 42, .04); cursor: pointer; -webkit-tap-highlight-color: transparent; }
          .booking-card:active { background: #f8fafc; }
          .booking-card:focus-visible { outline: 2px solid #4338ca; outline-offset: 2px; }
          .booking-card__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
          .booking-card__who { min-width: 0; }
          .booking-card__name { display: block; overflow: hidden; font-size: 15px; font-weight: 700; color: #0f172a; text-overflow: ellipsis; white-space: nowrap; }
          .booking-card__sub { display: block; margin-top: 1px; font-size: 12px; color: #64748b; }
          .booking-card__top .booking-table__status { flex: none; }
          .booking-card__service { padding: 8px 10px; font-size: 13px; font-weight: 600; color: #0f172a; background: #f8fafc; border-radius: 10px; }
          .booking-card__service small { display: block; margin-top: 1px; font-size: 12px; font-weight: 400; color: #64748b; }
          .booking-card__meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; margin: 0; }
          .booking-card__meta div { min-width: 0; }
          .booking-card__meta dt { font-size: 11px; color: #94a3b8; }
          .booking-card__meta dd { margin: 1px 0 0; overflow: hidden; font-size: 13px; font-weight: 600; color: #0f172a; text-overflow: ellipsis; white-space: nowrap; }
          .booking-card__meta dd.is-unassigned { font-weight: 500; color: #b45309; }
          .booking-card__foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 10px; border-top: 1px solid #f1f5f9; }
          .booking-card__created { font-size: 11px; color: #94a3b8; }
        }

        @media (max-width: 360px) {
          .booking-table th,
          .booking-table td {
            padding: 10px 12px;
          }
        }
      `}</style>

      <div className="booking-table__wrapper">
        <table className="booking-table">
          <thead>
            <tr>
              <th scope="col">Customer</th>
              <th scope="col">Service</th>
              <th scope="col">Partner</th>
              <th scope="col">City</th>
              <th scope="col">Scheduled</th>
              <th scope="col">Amount</th>
              <th scope="col">Status</th>
              <th scope="col">Payment</th>
              <th scope="col">Created</th>
            </tr>
          </thead>

          <tbody>
            {bookings.map((booking) => (
              <tr
                key={booking.id}
                className={
                  onBookingSelect
                    ? "booking-table__row booking-table__row--clickable"
                    : "booking-table__row"
                }
                onClick={() => onBookingSelect?.(booking)}
              >
                {/* CUSTOMER (first column; opens the booking) */}
                <td>
                  <div className="booking-table__primary">
                    {onBookingSelect ? (
                      <button
                        type="button"
                        className="booking-table__booking-button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onBookingSelect(booking);
                        }}
                        aria-label={`Open booking for ${
                          booking.customer?.name || "customer"
                        }`}
                      >
                        {booking.customer?.name || "-"}
                      </button>
                    ) : (
                      booking.customer?.name || "-"
                    )}
                  </div>

                  {booking.customer?.phone && (
                    <div className="booking-table__secondary">
                      {booking.customer.phone}
                    </div>
                  )}

                  {booking.customer?.email && (
                    <div className="booking-table__secondary">
                      {booking.customer.email}
                    </div>
                  )}
                </td>

                {/* SERVICE */}
                <td>
                  <div className="booking-table__primary">
                    {booking.service?.name || "-"}
                  </div>

                  <div className="booking-table__secondary">
                    {booking.service?.category || "-"}
                  </div>

                  <div className="booking-table__secondary">
                    {booking.service?.durationMinutes
                      ? `${booking.service.durationMinutes} min`
                      : "-"}
                  </div>
                </td>

                {/* PARTNER */}
                <td>
                  {booking.partner ? (
                    <>
                      <div className="booking-table__primary">
                        {booking.partner.name || "-"}
                      </div>

                      <div className="booking-table__secondary">
                        {booking.partner.category || "-"}
                      </div>
                    </>
                  ) : (
                    <span className="booking-table__unassigned">
                      Unassigned
                    </span>
                  )}
                </td>

                {/* CITY */}
                <td>
                  <div className="booking-table__primary">
                    {booking.city ||
                      booking.address?.city ||
                      "-"}
                  </div>

                  <div className="booking-table__secondary">
                    {booking.address?.area || "-"}
                  </div>
                </td>

                {/* SCHEDULED */}
                <td>
                  <div className="booking-table__primary">
                    {formatDate(booking.slot?.date || "")}
                  </div>

                 <div className="booking-table__secondary">
  {formatSlotRange(booking.slot)}
</div>
                </td>

                {/* AMOUNT */}
                <td className="booking-table__amount">
                  {formatAmount(
                    Number(
                      booking.pricing?.totalAmount ?? 0,
                    ),
                  )}
                </td>

                {/* STATUS */}
                <td>
                  <span
                    className={getStatusClass(
                      booking.status,
                    )}
                  >
                    {getStatusLabel(
                      booking.status,
                    )}
                  </span>
                </td>

                {/* PAYMENT */}
                <td>
                  <span
                    className={getPaymentClass(
                      booking.payment?.status ||
                        "Pending",
                    )}
                  >
                    {booking.payment?.status ||
                      "Pending"}
                  </span>
                </td>

                {/* CREATED */}
                <td>
                  <span className="booking-table__created">
                    {formatDateTime(
                      booking.createdAt,
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="booking-cards" aria-label="Bookings">
        {bookings.map((booking) => (
          <li key={booking.id}>
            <div
              className="booking-card"
              role={onBookingSelect ? "button" : undefined}
              tabIndex={onBookingSelect ? 0 : undefined}
              onClick={() => onBookingSelect?.(booking)}
              onKeyDown={(event) => {
                if (onBookingSelect && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  onBookingSelect(booking);
                }
              }}
            >
              <div className="booking-card__top">
                <div className="booking-card__who">
                  <span className="booking-card__name">
                    {booking.customer?.name || "-"}
                  </span>
                  {booking.customer?.phone && (
                    <span className="booking-card__sub">{booking.customer.phone}</span>
                  )}
                </div>
                <span className={getStatusClass(booking.status)}>
                  {getStatusLabel(booking.status)}
                </span>
              </div>

              <div className="booking-card__service">
                {booking.service?.name || "-"}
                <small>
                  {booking.service?.category || "-"}
                  {booking.service?.durationMinutes
                    ? ` · ${booking.service.durationMinutes} min`
                    : ""}
                </small>
              </div>

              <dl className="booking-card__meta">
                <div>
                  <dt>Scheduled</dt>
                  <dd>
                    {formatDate(booking.slot?.date || "")}
                    {booking.slot?.startTime ? `, ${booking.slot.startTime}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Amount</dt>
                  <dd>{formatAmount(Number(booking.pricing?.totalAmount ?? 0))}</dd>
                </div>
                <div>
                  <dt>City</dt>
                  <dd>
                    {booking.city || booking.address?.city || "-"}
                    {booking.address?.area ? `, ${booking.address.area}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Partner</dt>
                  <dd className={booking.partner ? undefined : "is-unassigned"}>
                    {booking.partner ? booking.partner.name || "-" : "Unassigned"}
                  </dd>
                </div>
              </dl>

              <div className="booking-card__foot">
                <span className={getPaymentClass(booking.payment?.status || "Pending")}>
                  {booking.payment?.status || "Pending"}
                </span>
                <span className="booking-card__created">
                  {formatDateTime(booking.createdAt)}
                </span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
};

export default BookingTable;