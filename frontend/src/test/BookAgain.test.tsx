import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { BookingDetailView } from "../types/bookingDetail";
import type { ServiceDetail } from "../types/catalog";
import { useBookingDraftStore } from "../features/booking/draftStore";

const fetchServiceDetail = vi.fn();

vi.mock("@/services/catalogApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/catalogApi")>();
  return {
    ...actual,
    fetchServiceDetail: (...a: unknown[]) => fetchServiceDetail(...a),
  };
});

import { planBookAgain } from "../features/booking/bookAgain";
import BookAgainButton from "../pages/customer/BookingDetails/components/BookAgainButton";

const service = (over: Partial<ServiceDetail> = {}): ServiceDetail =>
  ({
    id: "s1",
    slug: "deep-cleaning",
    name: "Deep Cleaning",
    basePrice: 1300,
    addOns: [
      { id: "a1", name: "Fridge", price: 250 },
      { id: "a2", name: "Balcony", price: 150 },
    ],
    ...over,
  }) as ServiceDetail;

const previous = (over: Partial<BookingDetailView> = {}): BookingDetailView =>
  ({
    _id: "b1",
    serviceId: "s1",
    quantity: 2,
    addOns: [
      { addOnId: "a1", quantity: 1 },
      { addOnId: "gone", quantity: 1 },
    ],
    addressSnapshot: {
      line1: "12 MG Road",
      city: "Nellore",
      state: "AP",
      pincode: "524001",
      sourceAddressId: "addr1",
    },
    date: "2026-10-12",
    slot: "10:00-12:00",
    ...over,
  }) as BookingDetailView;

describe("planBookAgain", () => {
  it("uses today's catalog prices and drops add-ons that are no longer offered", () => {
    const plan = planBookAgain(previous(), service());
    expect(plan.serviceSlug).toBe("deep-cleaning");
    expect(plan.basePrice).toBe(1300);
    expect(plan.quantity).toBe(2);
    expect(plan.addOns).toEqual([
      { id: "a1", quantity: 1, price: 250, name: "Fridge" },
    ]);
    expect(plan.droppedAddOns).toBe(1);
  });

  it("keeps the saved address, but leaves it for the customer to pick when there is no saved one", () => {
    expect(planBookAgain(previous(), service()).address?.id).toBe("addr1");
    const noSource = previous({
      addressSnapshot: {
        line1: "x",
        city: "y",
        state: "z",
        pincode: "1",
      },
    });
    expect(planBookAgain(noSource, service()).address).toBeNull();
  });

  it("caps the quantity at the server's limit", () => {
    expect(planBookAgain(previous({ quantity: 99 }), service()).quantity).toBe(
      20,
    );
  });
});

function Where() {
  const loc = useLocation();
  return <p data-testid="where">{`${loc.pathname}${loc.search}`}</p>;
}

function renderButton(booking = previous()) {
  return render(
    <MemoryRouter initialEntries={["/customer/bookings/b1"]}>
      <Routes>
        <Route
          path="/customer/bookings/:id"
          element={<BookAgainButton booking={booking} />}
        />
        <Route path="/customer/book/:slug" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Book Again button", () => {
  beforeEach(() => {
    fetchServiceDetail.mockReset();
    useBookingDraftStore.getState().clearDraft();
  });

  it("prefills a fresh draft and opens the wizard at Step 2", async () => {
    fetchServiceDetail.mockResolvedValue(service());
    // A leftover draft from some other attempt must not leak through.
    useBookingDraftStore.setState({
      date: "2026-01-01",
      slot: "08:00-10:00",
      couponCode: "OLD",
      idempotency: { signature: "old", key: "old-key" },
    });
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: /book again/i }));

    expect(await screen.findByTestId("where")).toHaveTextContent(
      "/customer/book/deep-cleaning?step=2",
    );
    expect(fetchServiceDetail).toHaveBeenCalledWith("s1");

    const d = useBookingDraftStore.getState();
    expect(d.serviceId).toBe("s1");
    expect(d.serviceSlug).toBe("deep-cleaning");
    expect(d.quantity).toBe(2);
    expect(d.addOns.map((a) => a.id)).toEqual(["a1"]);
    expect(d.addressId).toBe("addr1");
    expect(d.currentStep).toBe(2);
    expect(d.date).toBeNull();
    expect(d.slot).toBeNull();
    expect(d.couponCode).toBeNull();
    expect(d.idempotency).toBeNull();
    expect(d.notice).toMatch(/no longer offered/i);
  });

  it("explains when the service no longer exists and does not touch the draft", async () => {
    fetchServiceDetail.mockRejectedValue({ status: 404, message: "nope" });
    useBookingDraftStore.setState({ date: "2026-10-20" });
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: /book again/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /no longer available/i,
    );
    expect(useBookingDraftStore.getState().date).toBe("2026-10-20");
    expect(screen.queryByTestId("where")).not.toBeInTheDocument();
  });

  it("shows a retryable error when the network fails", async () => {
    fetchServiceDetail.mockRejectedValue({ status: 0, message: "offline" });
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: /book again/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/try again/i);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /book again/i })).toBeEnabled(),
    );
  });
});
