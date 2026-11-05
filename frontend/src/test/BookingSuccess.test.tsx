import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BookingSuccess from "../pages/customer/BookingSuccess";
import type { BookingView } from "@/types/booking";

const mockBooking: BookingView = {
  _id: "6aeadddf817c98e57d8edab7",
  customerId: "cust123",
  serviceId: "srv123",
  quantity: 1,
  addOns: [],
  addressSnapshot: {
    line1: "Flat 402, Green Meadows",
    line2: "Hitec City",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
  },
  date: "2026-11-04",
  slot: "14:00-16:00",
  priceSnapshot: {
    currency: "INR",
    lines: [
      {
        kind: "BASE",
        refId: "srv123",
        name: "Home Cleaning Service",
        unitPrice: 741,
        quantity: 1,
        amount: 741,
      },
    ],
    subtotal: 741,
    discount: 0,
    convenienceFee: 0,
    total: 741,
    computedAt: "2026-11-04T07:25:19.869Z",
  },
  status: "confirmed",
  paymentStatus: "PAID",
  paymentDetails: {
    method: "upi",
    status: "PAID",
    paidAt: "2026-11-04T07:25:55.443Z",
  },
  statusHistory: [
    {
      from: null,
      to: "confirmed",
      at: "2026-11-04T07:25:55.443Z",
      actorRole: "customer",
    },
  ],
  createdAt: "2026-11-04T07:25:19.869Z",
  updatedAt: "2026-11-04T07:25:55.443Z",
};

vi.mock("@/services/bookingApi", () => ({
  bookingApi: {
    getBooking: vi.fn(async () => mockBooking),
  },
}));

vi.mock("@/pages/customer/Dashboard/sections/BookingThumb", () => ({
  default: () => <div data-testid="booking-thumb" />,
}));

function renderComponent() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/customer/booking/success/6aeadddf817c98e57d8edab7"]}>
        <Routes>
          <Route path="/customer/booking/success/:id" element={<BookingSuccess />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("BookingSuccess Component Redesign", () => {
  it("renders the confirmation banner with heading, subtitle and status badge", async () => {
    renderComponent();

    expect(await screen.findByRole("heading", { name: "Booking Confirmed!" })).toBeInTheDocument();
    expect(
      screen.getByText(/Your service has been booked successfully/i),
    ).toBeInTheDocument();
    expect(screen.getByText("HomeCareX")).toBeInTheDocument();
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);
  });

  it("renders booking details with service name, scheduled date, slot, address and payment info", async () => {
    renderComponent();

    const serviceNames = await screen.findAllByText("Home Cleaning Service");
    expect(serviceNames.length).toBeGreaterThan(0);
    expect(screen.getAllByText("November 4, 2026").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/02:00 PM – 04:00 PM/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Flat 402, Green Meadows/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText("UPI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Paid online").length).toBeGreaterThan(0);
  });

  it("renders the booking reference and total amount correctly", async () => {
    renderComponent();

    const refs = await screen.findAllByText("#8EDAB7");
    expect(refs.length).toBeGreaterThan(0);
    expect(screen.getAllByText("₹741").length).toBeGreaterThan(0);
  });

  it("renders the two-step progress tracker (Booking Confirmed and Service Visit)", async () => {
    renderComponent();

    expect(await screen.findByText("Service Visit")).toBeInTheDocument();
  });

  it("renders the navigation action buttons with correct links", async () => {
    renderComponent();

    const bookingsBtn = await screen.findByRole("link", { name: /View My Bookings/i });
    expect(bookingsBtn).toHaveAttribute("href", "/customer/bookings");

    const homeBtn = screen.getByRole("link", { name: /Return to Home/i });
    expect(homeBtn).toHaveAttribute("href", "/customer");
  });
});
