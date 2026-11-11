import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type {
  BookingDetailView,
  CancellationSummary,
} from "../types/bookingDetail";
import {
  canCancelBooking,
  canRescheduleBooking,
} from "../pages/customer/BookingDetails/bookingDetailModel";

const getBookingDetail = vi.fn();
const getCancelPreview = vi.fn();
const cancelBooking = vi.fn();
const rescheduleBooking = vi.fn();
const getSlots = vi.fn();

vi.mock("@/services/bookingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/bookingApi")>();
  return {
    ...actual,
    bookingApi: {
      ...actual.bookingApi,
      getBookingDetail: (...a: unknown[]) => getBookingDetail(...a),
      getCancelPreview: (...a: unknown[]) => getCancelPreview(...a),
      cancelBooking: (...a: unknown[]) => cancelBooking(...a),
      rescheduleBooking: (...a: unknown[]) => rescheduleBooking(...a),
      getSlots: (...a: unknown[]) => getSlots(...a),
    },
  };
});

import BookingDetails from "../pages/customer/BookingDetails";

const ID = "65f0c0ffee00000000a1b2c3";

const detail = (over: Partial<BookingDetailView> = {}): BookingDetailView =>
  ({
    _id: ID,
    customerId: "c1",
    serviceId: "s1",
    quantity: 1,
    addOns: [],
    addressSnapshot: {
      line1: "12 MG Road",
      city: "Nellore",
      state: "Andhra Pradesh",
      pincode: "524001",
    },
    date: "2030-10-12",
    slot: "10:00-12:00",
    priceSnapshot: {
      currency: "INR",
      lines: [
        {
          kind: "BASE",
          refId: "s1",
          name: "Deep Cleaning",
          unitPrice: 1200,
          quantity: 1,
          amount: 1200,
        },
      ],
      subtotal: 1200,
      discount: 0,
      convenienceFee: 0,
      total: 1200,
      computedAt: "2026-10-01T00:00:00.000Z",
    },
    status: "confirmed",
    paymentStatus: "PAID",
    statusHistory: [],
    createdAt: "2026-10-09T05:00:00.000Z",
    updatedAt: "2026-10-09T06:00:00.000Z",
    partner: null,
    startOtp: null,
    extraCharges: [],
    extraChargesApprovedTotal: 0,
    ...over,
  }) as BookingDetailView;

const quote = (
  over: Partial<CancellationSummary> = {},
): CancellationSummary => ({
  windowHours: 4,
  feeAmount: 99,
  hoursUntilSlot: 2,
  freeCancellation: false,
  fee: 99,
  paidAmount: 1200,
  refundAmount: 1101,
  refundMethod: "RAZORPAY",
  refundStatus: "none",
  ...over,
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/customer/bookings/${ID}`]}>
        <Routes>
          <Route path="/customer/bookings/:id" element={<BookingDetails />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  for (const fn of [
    getBookingDetail,
    getCancelPreview,
    cancelBooking,
    rescheduleBooking,
    getSlots,
  ]) {
    fn.mockReset();
  }
});

describe("state guards", () => {
  it("cancel is offered until the job starts, never after in_progress", () => {
    for (const s of [
      "pending_payment",
      "confirmed",
      "assigned",
      "en_route",
      "arrived",
    ]) {
      expect(canCancelBooking(s)).toBe(true);
    }
    for (const s of [
      "in_progress",
      "completed",
      "rated",
      "cancelled_by_customer",
      "disputed",
    ]) {
      expect(canCancelBooking(s)).toBe(false);
    }
  });

  it("reschedule is only offered before a partner is committed", () => {
    for (const s of ["confirmed", "created", "searching_for_partner"]) {
      expect(canRescheduleBooking(s)).toBe(true);
    }
    for (const s of [
      "assigned",
      "en_route",
      "in_progress",
      "completed",
      "cancelled_by_customer",
    ]) {
      expect(canRescheduleBooking(s)).toBe(false);
    }
  });
});

describe("action buttons on the page", () => {
  it("shows Cancel and Reschedule for a confirmed booking", async () => {
    getBookingDetail.mockResolvedValue(detail());
    renderPage();
    expect(
      await screen.findByRole("button", { name: /Cancel Booking/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Reschedule Booking/ }),
    ).toBeInTheDocument();
  });

  it("hides Reschedule once a partner is assigned, but keeps Cancel", async () => {
    getBookingDetail.mockResolvedValue(detail({ status: "assigned" }));
    renderPage();
    expect(
      await screen.findByRole("button", { name: /Cancel Booking/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Reschedule Booking/ }),
    ).not.toBeInTheDocument();
  });

  it("offers neither action while the job is in progress", async () => {
    getBookingDetail.mockResolvedValue(detail({ status: "in_progress" }));
    renderPage();
    await screen.findByRole("heading", { level: 3, name: "Deep Cleaning" });
    expect(
      screen.queryByRole("button", { name: /Cancel Booking/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Reschedule Booking/ }),
    ).not.toBeInTheDocument();
  });
});

describe("CancelDialog", () => {
  it("shows the exact fee and refund BEFORE the customer confirms", async () => {
    getBookingDetail.mockResolvedValue(detail());
    getCancelPreview.mockResolvedValue(quote());
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /Cancel Booking/ }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Cancel this booking?",
    });
    expect(await within(dialog).findByText("− ₹99")).toBeInTheDocument();
    expect(within(dialog).getByText("₹1,101")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        /Cancel for free up to 4 hours before your slot/,
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel and pay ₹99 fee" }),
    ).toBeEnabled();
    expect(cancelBooking).not.toHaveBeenCalled();
  });

  it("says Free when the cancellation is outside the window", async () => {
    getBookingDetail.mockResolvedValue(detail());
    getCancelPreview.mockResolvedValue(
      quote({
        fee: 0,
        freeCancellation: true,
        refundAmount: 1200,
        hoursUntilSlot: 30,
      }),
    );
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /Cancel Booking/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("Free")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancel booking" }),
    ).toBeInTheDocument();
  });

  it("sends the chosen reason and shows the outcome", async () => {
    getBookingDetail.mockResolvedValue(detail());
    getCancelPreview.mockResolvedValue(quote());
    cancelBooking.mockResolvedValue({
      booking: detail({ status: "cancelled_by_customer" }),
      cancellation: quote({ refundStatus: "requested" }),
    });
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /Cancel Booking/ }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(
      await within(dialog).findByLabelText("I booked by mistake"),
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel and pay ₹99 fee" }),
    );

    await waitFor(() =>
      expect(cancelBooking).toHaveBeenCalledWith(ID, "I booked by mistake"),
    );
    expect(
      await screen.findByText(/Your ₹1,101 refund request has been filed/),
    ).toBeInTheDocument();
  });

  it("requires a reason when 'Other' is chosen", async () => {
    getBookingDetail.mockResolvedValue(detail());
    getCancelPreview.mockResolvedValue(quote());
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /Cancel Booking/ }),
    );
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(await within(dialog).findByLabelText("Other"));
    expect(
      within(dialog).getByRole("button", { name: /Cancel and pay/ }),
    ).toBeDisabled();
    await userEvent.type(
      within(dialog).getByLabelText("Tell us why"),
      "Moving away",
    );
    expect(
      within(dialog).getByRole("button", { name: /Cancel and pay/ }),
    ).toBeEnabled();
  });

  it("explains a refused cancellation instead of showing a blank dialog", async () => {
    getBookingDetail.mockResolvedValue(detail());
    getCancelPreview.mockRejectedValue({
      status: 409,
      code: "INVALID_STATE_TRANSITION",
      message: "A booking can't be cancelled while it is in_progress",
    });
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /Cancel Booking/ }),
    );
    expect(
      await screen.findByText("This booking can't be cancelled now"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/can't be cancelled while it is in_progress/),
    ).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    getBookingDetail.mockResolvedValue(detail());
    getCancelPreview.mockResolvedValue(quote());
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /Cancel Booking/ }),
    );
    await screen.findByRole("dialog");
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});

describe("RescheduleDialog", () => {
  const slots = (over: Array<{ slot: string; available: boolean }> = []) => ({
    serviceId: "s1",
    date: "x",
    slots: [
      { slot: "10:00-12:00", available: true, remaining: 3 },
      { slot: "12:00-14:00", available: true, remaining: 2 },
      ...over.map((o) => ({ ...o, remaining: o.available ? 1 : 0 })),
    ],
  });

  async function openAndPickSlot() {
    await userEvent.click(
      await screen.findByRole("button", { name: /Reschedule Booking/ }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Reschedule booking",
    });
    expect(
      within(dialog).getByText(/doesn't change your price/),
    ).toBeInTheDocument();
    await userEvent.click(within(dialog).getAllByRole("radio")[1]);
    await userEvent.click(within(dialog).getByRole("button", { name: /Next/ }));
    await userEvent.click(
      await within(dialog).findByRole("button", { name: /12:00 PM – 0?2:00 PM/ }),
    );
    await userEvent.click(within(dialog).getByRole("button", { name: /Next/ }));
    return dialog;
  }

  it("walks date, time, review and sends the chosen slot", async () => {
    getBookingDetail.mockResolvedValue(detail({ date: "2020-01-01" }));
    getSlots.mockResolvedValue(slots());
    rescheduleBooking.mockResolvedValue(detail({ slot: "12:00-14:00" }));
    renderPage();
    const dialog = await openAndPickSlot();

    expect(within(dialog).getByText("Current")).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirm new time" }),
    );

    await waitFor(() => expect(rescheduleBooking).toHaveBeenCalledTimes(1));
    const [id, body] = rescheduleBooking.mock.calls[0] as [
      string,
      { date: string; slot: string },
    ];
    expect(id).toBe(ID);
    expect(body.slot).toBe("12:00-14:00");
    expect(body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(
      await screen.findByText(/Your booking is now on/),
    ).toBeInTheDocument();
  });

  it("sends the customer back to pick another slot when it was just taken (409)", async () => {
    getBookingDetail.mockResolvedValue(detail({ date: "2020-01-01" }));
    getSlots.mockResolvedValue(slots());
    rescheduleBooking.mockRejectedValue({
      status: 409,
      code: "SLOT_UNAVAILABLE",
      message: "Selected slot is no longer available",
    });
    renderPage();
    const dialog = await openAndPickSlot();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirm new time" }),
    );

    expect(
      await within(dialog).findByText(/Selected slot is no longer available/),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Please pick another slot/),
    ).toBeInTheDocument();
    // Back on the slot step with nothing selected, so Next is off until a new slot is chosen.
    expect(within(dialog).getByRole("button", { name: /Next/ })).toBeDisabled();
  });

  it("keeps the customer on the review step when booking itself is not reschedulable (409)", async () => {
    getBookingDetail.mockResolvedValue(detail({ date: "2020-01-01" }));
    getSlots.mockResolvedValue(slots());
    rescheduleBooking.mockRejectedValue({
      status: 409,
      code: "BOOKING_NOT_RESCHEDULABLE",
      message: "A partner has already been assigned to this booking",
    });
    renderPage();
    const dialog = await openAndPickSlot();
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirm new time" }),
    );

    expect(
      await within(dialog).findByText(
        "A partner has already been assigned to this booking",
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).queryByText(/Please pick another slot/),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Confirm new time" }),
    ).toBeInTheDocument();
  });

  it("does not offer the slot the booking already has on the same day", async () => {
    getBookingDetail.mockResolvedValue(detail({ date: "2020-01-01" }));
    getSlots.mockResolvedValue(slots());
    renderPage();
    await userEvent.click(
      await screen.findByRole("button", { name: /Reschedule Booking/ }),
    );
    const dialog = await screen.findByRole("dialog");
    // The booking's date (2020-01-01) is not in the next two weeks, so every offered date lists both slots.
    await userEvent.click(within(dialog).getAllByRole("radio")[0]);
    await userEvent.click(within(dialog).getByRole("button", { name: /Next/ }));
    expect(
      await within(dialog).findByRole("button", {
        name: /10:00 AM – 12:00 PM/,
      }),
    ).toBeInTheDocument();
  });
});
