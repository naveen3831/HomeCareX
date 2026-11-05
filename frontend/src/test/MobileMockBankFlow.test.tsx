import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StepReview from "../pages/customer/Book/StepReview";
import { paymentApi } from "@/services/paymentApi";
import { useBookingDraftStore } from "@/features/booking";

vi.mock("@/services/paymentApi", () => ({
  paymentApi: {
    createOrder: vi.fn(),
    verify: vi.fn(),
    recordAttempt: vi.fn(),
    submitMockBankOutcome: vi.fn(),
  },
}));

vi.mock("@/services/bookingApi", () => ({
  bookingApi: {
    create: vi.fn(),
    createBooking: vi.fn().mockResolvedValue({
      booking: { _id: "book_test_123", status: "pending_payment" },
    }),
  },
}));

vi.mock("@/features/booking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/booking")>();
  return {
    ...actual,
    useBookingDraftStore: vi.fn(),
    useAvailableCoupons: () => ({ data: [] }),
    useValidateCoupon: () => ({ mutateAsync: vi.fn() }),
    useQuote: () => {
      const mockQuoteData = {
        total: 899,
        subtotal: 899,
        discount: 0,
        convenienceFee: 29,
        gst: 161,
        lines: [
          {
            kind: "BASE" as const,
            refId: "srv_test_1",
            name: "Sofa & Carpet Shampooing",
            quantity: 1,
            unitPrice: 899,
            amount: 899,
          },
        ],
      };
      return {
        quote: mockQuoteData,
        quoteReady: true,
        requote: vi.fn().mockResolvedValue(mockQuoteData),
      };
    },
  };
});

describe("Mobile Razorpay Mock Bank Flow", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    (useBookingDraftStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((selector) => {
      const state = {
        serviceId: "srv_test_1",
        serviceSlug: "sofa-carpet-shampooing",
        serviceName: "Sofa & Carpet Shampooing",
        basePrice: 899,
        quantity: 1,
        addOns: [],
        addressId: "addr_1",
        addressSnapshot: {
          line1: "123 Main St",
          city: "Hyderabad",
          state: "Telangana",
          pincode: "500081",
          contactName: "Test Customer",
          contactPhone: "9876543210",
        },
        date: "2026-11-06",
        slot: "10:00 - 12:00 PM",
        couponCode: null,
        notes: "",
        bookingId: "book_test_123",
        getIdempotencyKey: vi.fn().mockReturnValue("idem_key_123"),
        resetIdempotency: vi.fn(),
        setStep: vi.fn(),
      };
      return typeof selector === "function" ? selector(state) : state;
    });

    window.Razorpay = vi.fn().mockImplementation(() => ({
      open: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    })) as unknown as typeof window.Razorpay;
  });

  it("renders mock bank test modal when razorpay_mockbank_open event is dispatched", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/customer/book/sofa-carpet-shampooing?step=4"]}>
          <Routes>
            <Route path="/customer/book/:slug" element={<StepReview />} />
            <Route path="/customer/booking/success/:id" element={<div>Booking Confirmed Page</div>} />
            <Route path="/customer/booking/failed/:id" element={<div>Booking Failed Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Dispatch mock bank open event
    window.dispatchEvent(
      new CustomEvent("razorpay_mockbank_open", {
        detail: {
          callbackUrl: "https://api.razorpay.com/v1/payments/pay_123/callback/abc/rzp_test_123",
          paymentId: "pay_123",
        },
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Welcome to Razorpay Software Private Ltd Bank"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("This is just a demo bank page."),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Success$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Failure$/i })).toBeInTheDocument();
    });
  });

  it("submits failure outcome and does not confirm booking when Failure button is tapped", async () => {
    (paymentApi.submitMockBankOutcome as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      status: "failed",
      paymentId: "pay_123",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/customer/book/sofa-carpet-shampooing?step=4"]}>
          <Routes>
            <Route path="/customer/book/:slug" element={<StepReview />} />
            <Route path="/customer/booking/success/:id" element={<div>Booking Confirmed Page</div>} />
            <Route path="/customer/booking/failed/:id" element={<div>Booking Failed Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    window.dispatchEvent(
      new CustomEvent("razorpay_mockbank_open", {
        detail: {
          callbackUrl: "https://api.razorpay.com/v1/payments/pay_123/callback/abc/rzp_test_123",
          paymentId: "pay_123",
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Failure/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Failure/i }));

    await waitFor(() => {
      expect(paymentApi.submitMockBankOutcome).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: "F",
        }),
      );
      expect(screen.getByText("Booking Failed Page")).toBeInTheDocument();
    });
  });

  it("submits success outcome, verifies payment, and navigates to Booking Confirmed when Success button is tapped", async () => {
    (paymentApi.submitMockBankOutcome as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      status: "captured",
      paymentId: "pay_123",
      signature: "sig_abc_123",
    });

    (paymentApi.verify as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      _id: "book_test_123",
      status: "confirmed",
      paymentStatus: "PAID",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/customer/book/sofa-carpet-shampooing?step=4"]}>
          <Routes>
            <Route path="/customer/book/:slug" element={<StepReview />} />
            <Route path="/customer/booking/success/:id" element={<div>Booking Confirmed Page</div>} />
            <Route path="/customer/booking/failed/:id" element={<div>Booking Failed Page</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    window.dispatchEvent(
      new CustomEvent("razorpay_mockbank_open", {
        detail: {
          callbackUrl: "https://api.razorpay.com/v1/payments/pay_123/callback/abc/rzp_test_123",
          paymentId: "pay_123",
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Success/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Success/i }));

    await waitFor(
      () => {
        expect(paymentApi.submitMockBankOutcome).toHaveBeenCalledWith(
          expect.objectContaining({
            outcome: "S",
          }),
        );
        expect(screen.getByText("Booking Confirmed Page")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it("dispatches razorpay_mockbank_open event on window.open during wallet selection", () => {
    let eventFired = false;
    const handler = () => {
      eventFired = true;
    };
    window.addEventListener("razorpay_mockbank_open", handler);

    // Call window.open with a wallet target and blank url
    window.open("", "wallet_frame", "width=600,height=600");

    expect(eventFired).toBe(true);
    window.removeEventListener("razorpay_mockbank_open", handler);
  });

  it("opens mock bank modal directly when netbanking is chosen on mobile", async () => {
    (paymentApi.createOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      orderId: "order_test_nb_123",
      amount: 89900,
      currency: "INR",
      keyId: "rzp_test_oLoLVfdIOlgKUN",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/customer/book/sofa-carpet-shampooing?step=4"]}>
          <Routes>
            <Route path="/customer/book/:slug" element={<StepReview />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Select Netbanking
    const netbankingRadio = screen.getByText("Net Banking");
    fireEvent.click(netbankingRadio);

    // Click Confirm & Pay (choose the visible one)
    const payBtns = screen.getAllByRole("button", { name: /Confirm & Pay/i });
    fireEvent.click(payBtns[0]);

    await waitFor(
      () => {
        expect(
          screen.getByText("Welcome to Razorpay Software Private Ltd Bank"),
        ).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Success$/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^Failure$/i })).toBeInTheDocument();
      },
      { timeout: 4000 },
    );
  });
});
