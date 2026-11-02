import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TopBar from "@/components/customer/TopBar";
import Payments from "@/pages/customer/Payments";
import type { PaymentsPage } from "@/types/payment";

vi.mock("@/components/customer/LocationPicker", () => ({ default: () => <div>Deliver to Home</div> }));
vi.mock("@/components/customer/NotificationBell", () => ({ default: () => <span data-testid="bell" /> }));
vi.mock("@/hooks/useUnreadNotifications", () => ({ useUnreadNotifications: () => 0 }));

const mockList = vi.fn();

vi.mock("@/services/paymentApi", () => ({
  paymentApi: {
    list: (...args: unknown[]) => mockList(...args),
  },
}));

const samplePayments: PaymentsPage = {
  page: 1,
  limit: 10,
  total: 2,
  items: [
    {
      id: "65f0c0ffee00000000cf97b7db",
      bookingId: "65f0c0ffee00000000a1b2c3",
      bookingRef: "BK-6F4A6",
      serviceName: "Electrician Visit (General)",
      bookingDate: "2026-10-06T10:00:00.000Z",
      amount: 278,
      currency: "INR",
      method: null,
      status: "PENDING",
      paidAt: null,
      createdAt: "2026-10-06T09:00:00.000Z",
      receiptNo: null,
    },
    {
      id: "65f0c0ffee00000000d15bf58d",
      bookingId: "65f0c0ffee00000000a1b2c4",
      bookingRef: "BK-BF586",
      serviceName: "Deep Home Cleaning",
      bookingDate: "2026-10-06T14:00:00.000Z",
      amount: 1578,
      currency: "INR",
      method: "card",
      status: "PAID",
      paidAt: "2026-10-06T14:05:00.000Z",
      createdAt: "2026-10-06T14:00:00.000Z",
      receiptNo: "RCPT-1002",
    },
  ],
};

function LocationSpy() {
  const { pathname, search } = useLocation();
  return <div data-testid="current-path">{pathname}{search}</div>;
}

function DummyProfile() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>Profile Page</h1>
      <button
        type="button"
        onClick={() => navigate("/customer/payments", { state: { from: "/customer/profile" } })}
      >
        Open Payments
      </button>
    </div>
  );
}

function DummyDashboard() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>Dashboard Page</h1>
      <button
        type="button"
        onClick={() => navigate("/customer/payments", { state: { from: "/customer" } })}
      >
        Open Payments from Dashboard
      </button>
    </div>
  );
}

function PaymentsPageWrapper() {
  return (
    <div>
      <TopBar sidebarOpen={false} onToggleSidebar={() => undefined} />
      <Payments />
    </div>
  );
}

function DummyBookingDetails() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.state?.from) {
      if (location.state.from === "/customer/tracking" || location.state.from.includes("/payments")) {
        if (window.history.length > 1) {
          navigate(-1);
        } else {
          navigate(location.state.from, {
            replace: true,
            state: { origin: location.state?.origin },
          });
        }
      } else {
        navigate(location.state.from);
      }
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/customer/bookings");
    }
  };

  return (
    <div>
      <h1>Booking Details</h1>
      <button type="button" onClick={handleBack}>
        Back to Payments
      </button>
    </div>
  );
}

function TestPaymentsApp({ initialEntries }: { initialEntries: string[] }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <LocationSpy />
        <Routes>
          <Route path="/customer" element={<DummyDashboard />} />
          <Route path="/customer/profile" element={<DummyProfile />} />
          <Route path="/customer/payments" element={<PaymentsPageWrapper />} />
          <Route path="/customer/bookings/:id" element={<DummyBookingDetails />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Payments Mobile Back Navigation Flow", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    mockList.mockResolvedValue(samplePayments);
  });

  it("Scenario A: Profile -> Payments -> Booking Details -> Back to Payments -> Back to Profile", async () => {
    const user = userEvent.setup();

    render(<TestPaymentsApp initialEntries={["/customer/profile"]} />);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/profile");

    // 1. Profile -> Payments
    await user.click(screen.getByRole("button", { name: "Open Payments" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/payments");

    // Wait for payment cards to load
    const cards = await screen.findAllByRole("link", { name: /electrician visit/i });
    expect(cards.length).toBeGreaterThan(0);

    // 2. Payments -> Booking Details (click on Electrician card)
    await user.click(cards[0]);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/bookings/65f0c0ffee00000000a1b2c3");

    // 3. Booking Details -> Back to Payments
    await user.click(screen.getByRole("button", { name: "Back to Payments" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/payments");

    // 4. Payments -> Back to Profile (must navigate directly to Profile, NEVER back to Booking Details)
    await user.click(screen.getByRole("button", { name: /back from payments/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/profile");
  });

  it("Scenario B: Repeated navigation: Profile -> Payments -> Booking 1 -> Back -> Payments -> Booking 2 -> Back -> Payments -> Back to Profile", async () => {
    const user = userEvent.setup();

    render(<TestPaymentsApp initialEntries={["/customer/profile"]} />);

    // Step 1: Open Payments from Profile
    await user.click(screen.getByRole("button", { name: "Open Payments" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/payments");

    // Step 2: Open Booking 1
    const cards1 = await screen.findAllByRole("link", { name: /electrician visit/i });
    await user.click(cards1[0]);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/bookings/65f0c0ffee00000000a1b2c3");

    // Step 3: Back to Payments from Booking 1
    await user.click(screen.getByRole("button", { name: "Back to Payments" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/payments");

    // Step 4: Open Booking 2
    const cards2 = await screen.findAllByRole("link", { name: /deep home cleaning/i });
    await user.click(cards2[0]);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/bookings/65f0c0ffee00000000a1b2c4");

    // Step 5: Back to Payments from Booking 2
    await user.click(screen.getByRole("button", { name: "Back to Payments" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/payments");

    // Step 6: Back from Payments -> must navigate directly to Profile, NOT Booking 1 or Booking 2
    await user.click(screen.getByRole("button", { name: /back from payments/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/profile");
  });

  it("Scenario C1: Direct entry with no prior origin falls back to Profile", async () => {
    const user = userEvent.setup();

    render(<TestPaymentsApp initialEntries={["/customer/payments"]} />);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/payments");

    // Click back button from Payments when entered directly
    await user.click(screen.getByRole("button", { name: /back from payments/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/profile");
  });

  it("Scenario C2: Entry from Dashboard returns to Dashboard", async () => {
    const user = userEvent.setup();

    render(<TestPaymentsApp initialEntries={["/customer"]} />);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer");

    // Dashboard -> Payments
    await user.click(screen.getByRole("button", { name: "Open Payments from Dashboard" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/payments");

    // Open Booking Details
    const cards = await screen.findAllByRole("link", { name: /electrician visit/i });
    await user.click(cards[0]);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/bookings/65f0c0ffee00000000a1b2c3");

    // Return to Payments
    await user.click(screen.getByRole("button", { name: "Back to Payments" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/payments");

    // Back from Payments should navigate to Dashboard (originating page)
    await user.click(screen.getByRole("button", { name: /back from payments/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer");
  });

  it("Preserves selected filter when navigating to Booking Details and returning", async () => {
    const user = userEvent.setup();

    render(<TestPaymentsApp initialEntries={["/customer/profile"]} />);

    // Profile -> Payments
    await user.click(screen.getByRole("button", { name: "Open Payments" }));

    // Select Paid filter tab
    const paidTab = await screen.findByRole("tab", { name: "Paid" });
    await user.click(paidTab);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/payments?status=PAID");

    // Click a booking card
    const cards = await screen.findAllByRole("link", { name: /deep home cleaning/i });
    await user.click(cards[0]);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/bookings/65f0c0ffee00000000a1b2c4");

    // Return to Payments
    await user.click(screen.getByRole("button", { name: "Back to Payments" }));

    // Filter ?status=PAID must be preserved
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/payments?status=PAID");

    // Back button still goes to Profile
    await user.click(screen.getByRole("button", { name: /back from payments/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/profile");
  });
});
