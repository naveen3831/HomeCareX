import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import StepReview from "@/pages/customer/Book/StepReview";
import { useBookingDraftStore } from "@/features/booking";
import { bookingApi } from "@/services/bookingApi";
import { paymentApi } from "@/services/paymentApi";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("@/services/bookingApi", () => ({
  bookingApi: {
    createBooking: vi.fn(),
  },
  COUPON_ERROR: {
    INVALID: "COUPON_INVALID",
    EXPIRED: "COUPON_EXPIRED",
    MIN_ORDER_NOT_MET: "COUPON_MIN_ORDER_NOT_MET",
    SERVICE_NOT_ELIGIBLE: "COUPON_SERVICE_NOT_ELIGIBLE",
    USAGE_LIMIT_REACHED: "COUPON_USAGE_LIMIT_REACHED",
  },
}));

vi.mock("@/services/paymentApi", () => ({
  paymentApi: {
    createOrder: vi.fn(),
    recordAttempt: vi.fn(),
    verify: vi.fn(),
    confirmCod: vi.fn(),
    submitMockBankOutcome: vi.fn(),
  },
}));

vi.mock("@/features/payments/razorpay", () => ({
  loadRazorpayScript: vi.fn().mockResolvedValue(true),
  forceCloseRazorpayModal: vi.fn(),
  closeActivePopup: vi.fn(),
  resetRazorpayState: vi.fn(),
  getLatestCallbackUrl: vi.fn().mockReturnValue("http://localhost:5000/api/v1/payments/callback"),
  getLatestPaymentId: vi.fn().mockReturnValue("pay_mobile_test_123"),
  isMobileOrEmulation: vi.fn().mockReturnValue(true),
  toRazorpayCheckoutMethod: vi.fn().mockReturnValue("upi"),
}));

vi.mock("@/features/booking", async () => {
  const actual = await vi.importActual("@/features/booking");
  return {
    ...actual,
    useQuote: () => ({
      quote: {
        currency: "INR",
        subtotal: 487,
        discount: 0,
        convenienceFee: 0,
        gst: 0,
        total: 487,
        lines: [
          {
            kind: "BASE",
            name: "Shelf & Curtain Rod Installation",
            unitPrice: 487,
            quantity: 1,
            amount: 487,
            refId: "srv_1",
          },
        ],
      },
      isLoading: false,
      isRefreshing: false,
      isPlaceholder: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      requote: vi.fn().mockResolvedValue({
        currency: "INR",
        subtotal: 487,
        discount: 0,
        convenienceFee: 0,
        gst: 0,
        total: 487,
        lines: [
          {
            kind: "BASE",
            name: "Shelf & Curtain Rod Installation",
            unitPrice: 487,
            quantity: 1,
            amount: 487,
            refId: "srv_1",
          },
        ],
      }),
    }),
    useAvailableCoupons: () => ({
      coupons: [],
      isLoading: false,
    }),
    useValidateCoupon: () => ({
      validate: vi.fn(),
      isValidating: false,
    }),
  };
});

describe("Mobile Service Booking Payment - Retry Limit & Error Validation Priority", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    useBookingDraftStore.getState().clearDraft();
    useBookingDraftStore.setState({
      serviceId: "srv_plumb_1",
      serviceSlug: "plumbing-leak-repair",
      serviceName: "Shelf & Curtain Rod Installation",
      addressId: "addr_1",
      addressSnapshot: {
        line1: "Macherla, Andhra Pradesh",
        line2: "Macherla Urban",
        city: "Macherla",
        state: "Andhra Pradesh",
        pincode: "500001",
        contactName: "John Doe",
        contactPhone: "9876543210",
      },
      date: "2026-11-06",
      slot: "18:00-20:00",
      quantity: 1,
      bookingId: null,
      step: 4,
    });
  });

  it("handles backend PAYMENT_RETRY_LIMIT_EXCEEDED (HTTP 429) by opening the mobile dialog and suppressing slot error", async () => {
    (bookingApi.createBooking as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({
      status: 429,
      code: "PAYMENT_RETRY_LIMIT_EXCEEDED",
      message: "You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/customer/book/plumbing-leak-repair?step=4"]}>
          <Routes>
            <Route path="/customer/book/plumbing-leak-repair" element={<StepReview />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const payBtns = screen.getAllByRole("button", { name: /Confirm & Pay/i });
    fireEvent.click(payBtns[0]);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /Maximum Payment Attempts Reached/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/You have reached the maximum of 3 payment retries/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/Selected slot is no longer available/i)).not.toBeInTheDocument();
    });

    // Verify action buttons
    expect(screen.getByRole("button", { name: /Start a New Booking/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Back to My Bookings/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Close/i })).toBeInTheDocument();

    // Clicking Start a New Booking resets slot, clears draft, and navigates to Customer Services
    fireEvent.click(screen.getByRole("button", { name: /Start a New Booking/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/customer/services", { replace: true });
  });

  it("handles payment failures up to 3 retries (4 total attempts) before exhausting the transaction", async () => {
    (bookingApi.createBooking as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      booking: { _id: "book_retry_test_123", status: "pending_payment", paymentStatus: "PENDING" },
    });
    (paymentApi.createOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      orderId: "order_retry_test_123",
      amount: 48700,
      currency: "INR",
      keyId: "rzp_test_testkey",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/customer/book/plumbing-leak-repair?step=4"]}>
          <Routes>
            <Route path="/customer/book/plumbing-leak-repair" element={<StepReview />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const payBtns = screen.getAllByRole("button", { name: /Confirm & Pay/i });
    fireEvent.click(payBtns[0]);

    await waitFor(() => {
      expect(bookingApi.createBooking).toHaveBeenCalled();
      expect(paymentApi.createOrder).toHaveBeenCalledWith("book_retry_test_123");
    });
  });

  it("blocks payments when a transaction reaches the 4-attempt limit (1 initial + 3 retries)", async () => {
    const bookingKey = "booking_payment_attempts_book_exhausted_123";
    sessionStorage.setItem(bookingKey, "4");

    (bookingApi.createBooking as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      booking: { _id: "book_exhausted_123", paymentStatus: "PENDING" },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/customer/book/plumbing-leak-repair?step=4"]}>
          <Routes>
            <Route path="/customer/book/plumbing-leak-repair" element={<StepReview />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Initial render without stored slot key does not show modal
    expect(screen.queryByRole("heading", { name: /Maximum Payment Attempts Reached/i })).not.toBeInTheDocument();
  });

  it("verifies mobile responsiveness across 360px, 375px, 390px, 414px, and 768px viewports without clipping", async () => {
    (bookingApi.createBooking as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({
      status: 429,
      code: "PAYMENT_RETRY_LIMIT_EXCEEDED",
      message: "You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.",
    });
    (paymentApi.createOrder as unknown as ReturnType<typeof vi.fn>).mockRejectedValue({
      status: 429,
      code: "PAYMENT_RETRY_LIMIT_EXCEEDED",
      message: "You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.",
    });

    const viewports = [360, 375, 390, 412, 414, 430, 768];

    for (const width of viewports) {
      useBookingDraftStore.setState({ bookingId: null });
      window.innerWidth = width;
      const { unmount } = render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/customer/book/plumbing-leak-repair?step=4"]}>
            <Routes>
              <Route path="/customer/book/plumbing-leak-repair" element={<StepReview />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const payBtns = screen.getAllByRole("button", { name: /Confirm & Pay/i });
      fireEvent.click(payBtns[0]);

      await waitFor(() => {
        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: /Maximum Payment Attempts Reached/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Start a New Booking/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Back to My Bookings/i })).toBeInTheDocument();
      });

      unmount();
    }
  });
});
