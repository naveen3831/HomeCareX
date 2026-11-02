import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/components/customer/LocationPicker", () => ({ default: () => <div>Deliver to Home</div> }));
vi.mock("@/components/customer/NotificationBell", () => ({ default: () => <span data-testid="bell" /> }));
vi.mock("@/hooks/useUnreadNotifications", () => ({ useUnreadNotifications: () => 0 }));

import TopBar from "@/components/customer/TopBar";

function LocationSpy() {
  const { pathname } = useLocation();
  return <div data-testid="current-path">{pathname}</div>;
}

function DummyProfile() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>Profile Page</h1>
      <button
        type="button"
        onClick={() => navigate("/customer/tracking", { state: { from: "/customer/profile" } })}
      >
        Active Booking
      </button>
    </div>
  );
}

function DummyActiveBookings() {
  const navigate = useNavigate();
  return (
    <div>
      <TopBar sidebarOpen={false} onToggleSidebar={() => undefined} />
      <h1>Active Bookings</h1>
      <button
        type="button"
        onClick={() =>
          navigate("/customer/bookings/b123", { state: { from: "/customer/tracking" } })
        }
      >
        View Details
      </button>
      <button
        type="button"
        onClick={() =>
          navigate("/customer/bookings/b123/track", { state: { from: "/customer/tracking" } })
        }
      >
        Track Partner
      </button>
    </div>
  );
}

function DummyBookingDetails() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.state?.from === "/customer/tracking") {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/customer/tracking", { replace: true });
      }
    } else {
      navigate(-1);
    }
  };

  return (
    <div>
      <h1>Booking Details</h1>
      <button type="button" onClick={handleBack} aria-label="Back">
        Back to Active Bookings
      </button>
    </div>
  );
}

function DummyLiveTracking() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    if (location.state?.from === "/customer/tracking") {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate("/customer/tracking", { replace: true });
      }
    } else {
      navigate(-1);
    }
  };

  return (
    <div>
      <h1>Live Tracking</h1>
      <button type="button" onClick={handleBack} aria-label="Back">
        Back to Active Bookings
      </button>
    </div>
  );
}

function TestApp({ initialEntries }: { initialEntries: string[] }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <LocationSpy />
        <Routes>
          <Route path="/customer/profile" element={<DummyProfile />} />
          <Route path="/customer/tracking" element={<DummyActiveBookings />} />
          <Route path="/customer/bookings/b123" element={<DummyBookingDetails />} />
          <Route path="/customer/bookings/b123/track" element={<DummyLiveTracking />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Active Bookings Back Navigation Flow", () => {
  it("navigates Profile -> Active Bookings -> Booking Details -> Back to Active Bookings -> Back to Profile", async () => {
    sessionStorage.clear();
    const user = userEvent.setup();

    render(<TestApp initialEntries={["/customer/profile"]} />);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/profile");

    // 1. Profile -> Active Bookings
    await user.click(screen.getByRole("button", { name: "Active Booking" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/tracking");

    // 2. Active Bookings -> Booking Details
    await user.click(screen.getByRole("button", { name: "View Details" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/bookings/b123");

    // 3. Booking Details -> Back to Active Bookings
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/tracking");

    // 4. Active Bookings -> Back to Profile (must NOT go to Booking Details!)
    await user.click(screen.getByRole("button", { name: /back from active bookings/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/profile");
  });

  it("navigates Profile -> Active Bookings -> Track Partner -> Back to Active Bookings -> Back to Profile", async () => {
    sessionStorage.clear();
    const user = userEvent.setup();

    render(<TestApp initialEntries={["/customer/profile"]} />);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/profile");

    // 1. Profile -> Active Bookings
    await user.click(screen.getByRole("button", { name: "Active Booking" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/tracking");

    // 2. Active Bookings -> Live Tracking
    await user.click(screen.getByRole("button", { name: "Track Partner" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/bookings/b123/track");

    // 3. Live Tracking -> Back to Active Bookings
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/tracking");

    // 4. Active Bookings -> Back to Profile
    await user.click(screen.getByRole("button", { name: /back from active bookings/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/profile");
  });

  it("navigates directly to Active Bookings, and back button falls back to Profile", async () => {
    sessionStorage.clear();
    const user = userEvent.setup();

    render(<TestApp initialEntries={["/customer/tracking"]} />);
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/tracking");

    // Click back from Active Bookings with no prior history -> should go to Profile
    await user.click(screen.getByRole("button", { name: /back from active bookings/i }));
    expect(screen.getByTestId("current-path")).toHaveTextContent("/customer/profile");
  });
});
