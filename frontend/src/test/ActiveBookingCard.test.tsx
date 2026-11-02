import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ActiveBookingCard from "@/pages/customer/Dashboard/sections/ActiveBookingCard";
import type { DashboardBookingDto } from "@/features/customer";

const mockBookings: DashboardBookingDto[] = [
  {
    id: "b1",
    serviceName: "Deep Home Cleaning",
    status: "arrived",
    scheduledAt: "2026-10-29T22:35:00.000Z",
    partnerName: "Test P,",
    progressStep: 3,
    address: { line1: "123 Main St", area: "Kukatpally", city: "Hyderabad" },
    total: 1499,
  },
  {
    id: "b2",
    serviceName: "Plumbing – Tap & Leak Repair",
    status: "en_route",
    scheduledAt: "2026-10-07T16:23:00.000Z",
    partnerName: "Kiran, M.",
    progressStep: 2,
    address: { line1: "456 Side St", area: "Madhapur", city: "Hyderabad" },
    total: 599,
  },
  {
    id: "b3",
    serviceName: "Appliance Repair",
    status: "in_progress",
    scheduledAt: "2026-10-07T14:23:00.000Z",
    partnerName: "Ramesh K.",
    progressStep: 4,
    address: { line1: "789 High St", area: "Gachibowli", city: "Hyderabad" },
    total: 799,
  },
];

describe("ActiveBookingCard Redesign", () => {
  it("renders section header with icon, title, count badge and view all link", () => {
    render(
      <MemoryRouter>
        <ActiveBookingCard bookings={mockBookings} />
      </MemoryRouter>
    );

    expect(screen.getByText("Active Bookings")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("View all")).toBeInTheDocument();
  });

  it("limits display to 2 bookings by default so QuickActions stay clearly in view", () => {
    render(
      <MemoryRouter>
        <ActiveBookingCard bookings={mockBookings} />
      </MemoryRouter>
    );

    // First 2 bookings are displayed
    expect(screen.getByText("Deep Home Cleaning")).toBeInTheDocument();
    expect(screen.getByText("Plumbing – Tap & Leak Repair")).toBeInTheDocument();
    expect(screen.getByText("Test P, has arrived")).toBeInTheDocument();
    expect(screen.getByText("Kiran, M. is on the way")).toBeInTheDocument();

    // 3rd booking is hidden from dashboard stack to preserve vertical room
    expect(screen.queryByText("Appliance Repair")).not.toBeInTheDocument();

    // Status pills for visible cards
    expect(screen.getAllByText("Arrived").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("En Route").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the 4-step progress stepper with step labels for displayed cards", () => {
    render(
      <MemoryRouter>
        <ActiveBookingCard bookings={mockBookings} />
      </MemoryRouter>
    );

    // 2 displayed cards have stepper steps
    expect(screen.getAllByText("Assigned").length).toBe(2);
    expect(screen.getAllByText("En Route").length).toBeGreaterThanOrEqual(2);
  });
});
