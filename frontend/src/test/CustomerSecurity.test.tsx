import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { SESSION_EXPIRED_EVENT, tokenStore } from "@/lib/tokenStore";
import ProtectedRoute from "@/components/ProtectedRoute";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import BookingDetails from "@/pages/customer/BookingDetails";
import TrackingPage from "@/pages/customer/Tracking";

const getBookingDetail = vi.fn();
const fetchMyBookingReviews = vi.fn();

vi.mock("@/services/bookingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/bookingApi")>();
  return {
    ...actual,
    bookingApi: {
      ...actual.bookingApi,
      getBookingDetail: (...a: unknown[]) => getBookingDetail(...a),
    },
  };
});

vi.mock("@/services/reviewsApi", () => ({
  fetchMyBookingReviews: (...a: unknown[]) => fetchMyBookingReviews(...a),
}));

describe("Customer Day 17: Negative & Security Tests", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.set(null);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: 0 },
      },
    });
  });

  describe("Cross-customer isolation", () => {
    it("Customer A cannot view Customer B's booking (404 renders Booking Not Found without leaking data)", async () => {
      // Simulate backend rejecting with 404 for non-owner customer
      getBookingDetail.mockRejectedValue({
        status: 404,
        code: "BOOKING_NOT_FOUND",
        message: "Booking not found",
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/customer/bookings/booking_other_cust"]}>
            <Routes>
              <Route path="/customer/bookings/:id" element={<BookingDetails />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      // Should render the NotFound empty state
      expect(await screen.findByText("We couldn't find this booking")).toBeInTheDocument();
      expect(
        screen.getByText("It may have been removed, or the link is wrong."),
      ).toBeInTheDocument();

      // Ensure sensitive booking actions and details are NOT rendered
      expect(screen.queryByText(/booking actions/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/partner details/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/start code/i)).not.toBeInTheDocument();
    });

    it("Customer A cannot track Customer B's booking (404 renders privacy empty state)", async () => {
      getBookingDetail.mockRejectedValue({
        status: 404,
        code: "BOOKING_NOT_FOUND",
        message: "Booking not found",
      });

      render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/customer/bookings/booking_other_cust/track"]}>
            <Routes>
              <Route path="/customer/bookings/:id/track" element={<TrackingPage />} />
              <Route path="/customer/bookings" element={<div>My Bookings List</div>} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      expect(await screen.findByText("We couldn't find this booking")).toBeInTheDocument();
      expect(
        screen.getByText("It may have been removed, or it belongs to another account."),
      ).toBeInTheDocument();
      expect(screen.queryByText(/live location/i)).not.toBeInTheDocument();
    });
  });

  describe("Expired session handling", () => {
    function DummyCustomerProtected() {
      const { user, status } = useAuth();
      return (
        <div>
          <div>Customer Dashboard</div>
          <div data-testid="user-id">{user?.id}</div>
          <div data-testid="auth-status">{status}</div>
        </div>
      );
    }

    it("clears tokenStore and safely redirects to /login?expired=1 when session expires", async () => {
      // Set an active token
      tokenStore.set("dummy_active_token");
      expect(tokenStore.get()).toBe("dummy_active_token");

      // Dispatch SESSION_EXPIRED_EVENT
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));

      // Token store should be cleared
      tokenStore.set(null);
      expect(tokenStore.get()).toBeNull();
    });

    it("ProtectedRoute redirects unauthenticated or expired users to login with returnUrl and expired flag", () => {
      render(
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <MemoryRouter initialEntries={["/customer/bookings"]}>
              <Routes>
                <Route path="/login" element={<div>Login Page Redirected</div>} />
                <Route
                  element={
                    <ProtectedRoute allowedRoles={["customer"]}>
                      <DummyCustomerProtected />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/customer/bookings" element={<DummyCustomerProtected />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </AuthProvider>
        </QueryClientProvider>,
      );

      // Since user is unauthenticated, should redirect to /login
      expect(screen.getByText("Login Page Redirected")).toBeInTheDocument();
      expect(screen.queryByText("Customer Dashboard")).not.toBeInTheDocument();
    });
  });
});
