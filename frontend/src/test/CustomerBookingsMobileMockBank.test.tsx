import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import MyBookingsPage from "@/pages/customer/Bookings";
import { paymentApi } from "@/services/paymentApi";
import { useBookings } from "@/hooks/useBookings";

vi.mock("@/services/paymentApi", () => ({
  paymentApi: {
    createOrder: vi.fn(),
    verify: vi.fn(),
    recordAttempt: vi.fn(),
    submitMockBankOutcome: vi.fn(),
  },
}));

vi.mock("@/hooks/useBookings", () => ({
  useBookings: vi.fn(),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: vi.fn(() => true),
}));

describe("Customer Bookings Mobile Mock Bank Flow", () => {
  let queryClient: QueryClient;

  const mockBooking = {
    _id: "booking_12345",
    id: "booking_12345",
    bookingNumber: "BK-02707",
    status: "confirmed",
    paymentStatus: "PENDING",
    holdExpiresAt: null,
    date: "2026-11-09",
    slot: "18:00 - 20:00",
    serviceName: "Microwave Oven Repair",
    priceSnapshot: {
      total: 422,
      subtotal: 350,
      lines: [{ kind: "BASE", name: "Microwave Oven Repair" }],
    },
    paymentDetails: {
      status: "PENDING",
      method: "ONLINE",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (useBookings as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: {
        items: [mockBooking],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      },
      isError: false,
      error: null,
      refetch: vi.fn(),
      isPlaceholderData: false,
    });

    (paymentApi.createOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      orderId: "order_bk_12345",
      amount: 42200,
      currency: "INR",
      keyId: "rzp_test_mock",
      prefill: { name: "Test User", email: "test@homecarex.com" },
    });

    (paymentApi.verify as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      verified: true,
    });

    (paymentApi.submitMockBankOutcome as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      paymentId: "pay_test_outcome_123",
      signature: "sig_valid_test",
    });

    (paymentApi.recordAttempt as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({});

    window.Razorpay = vi.fn().mockImplementation(() => ({
      open: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    })) as unknown as typeof window.Razorpay;
  });

  it("renders Demo Bank Mock Dialog on mobile when Pay now is clicked and razorpay_mockbank_open event fires", async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MyBookingsPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    // Verify booking card renders with Pay now button
    expect(screen.getByText("Microwave Oven Repair")).toBeInTheDocument();
    const payBtn = screen.getByRole("button", { name: /Pay now/i });
    expect(payBtn).toBeInTheDocument();

    // Click Pay now
    await act(async () => {
      fireEvent.click(payBtn);
    });

    expect(paymentApi.createOrder).toHaveBeenCalledWith("booking_12345");

    // Simulate mobile test bank transition: razorpay_mockbank_open
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("razorpay_mockbank_open", {
          detail: {
            callbackUrl: "http://localhost:3000/api/v1/payments/callback",
            paymentId: "pay_test_mb_123",
          },
        }),
      );
    });

    // Check that Demo Bank modal is displayed
    expect(
      screen.getByText("Welcome to Razorpay Software Private Ltd Bank"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Success/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Failure/i })).toBeInTheDocument();
  });

  it("completes payment successfully when Success button is tapped in mobile mock bank dialog", async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MyBookingsPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    const payBtn = screen.getByRole("button", { name: /Pay now/i });
    await act(async () => {
      fireEvent.click(payBtn);
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("razorpay_mockbank_open", {
          detail: {
            callbackUrl: "http://localhost:3000/api/v1/payments/callback",
            paymentId: "pay_test_mb_123",
          },
        }),
      );
    });

    const successBtn = screen.getByRole("button", { name: /Success/i });
    await act(async () => {
      fireEvent.click(successBtn);
    });

    expect(paymentApi.submitMockBankOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order_bk_12345",
        bookingId: "booking_12345",
        outcome: "S",
      }),
    );

    await waitFor(() => {
      expect(paymentApi.verify).toHaveBeenCalledWith(
        "booking_12345",
        expect.objectContaining({
          razorpay_order_id: "order_bk_12345",
          razorpay_payment_id: "pay_test_outcome_123",
          razorpay_signature: "sig_valid_test",
        }),
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText("Payment received. Your booking is now paid."),
      ).toBeInTheDocument();
    });
  });

  it("marks payment as failed when Failure button is tapped in mobile mock bank dialog", async () => {
    render(
      <MemoryRouter>
        <QueryClientProvider client={queryClient}>
          <MyBookingsPage />
        </QueryClientProvider>
      </MemoryRouter>,
    );

    const payBtn = screen.getByRole("button", { name: /Pay now/i });
    await act(async () => {
      fireEvent.click(payBtn);
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("razorpay_mockbank_open", {
          detail: {
            callbackUrl: "http://localhost:3000/api/v1/payments/callback",
            paymentId: "pay_test_mb_123",
          },
        }),
      );
    });

    const failureBtn = screen.getByRole("button", { name: /Failure/i });
    await act(async () => {
      fireEvent.click(failureBtn);
    });

    expect(paymentApi.submitMockBankOutcome).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order_bk_12345",
        bookingId: "booking_12345",
        outcome: "F",
      }),
    );

    await waitFor(() => {
      expect(paymentApi.recordAttempt).toHaveBeenCalledWith(
        "booking_12345",
        "FAILED",
        "order_bk_12345",
        "Payment declined on test bank page",
      );
    });
  });
});
