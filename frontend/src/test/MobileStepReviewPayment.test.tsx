import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import StepReview from "../pages/customer/Book/StepReview";
import { bookingApi } from "@/services/bookingApi";
import { paymentApi } from "@/services/paymentApi";
import { useBookingDraftStore } from "@/features/booking";

vi.mock("@/services/paymentApi", () => ({
  paymentApi: {
    createOrder: vi.fn(),
    verify: vi.fn(),
    confirmCod: vi.fn(),
    recordAttempt: vi.fn(),
    submitMockBankOutcome: vi.fn(),
  },
}));

vi.mock("@/services/bookingApi", () => ({
  bookingApi: {
    create: vi.fn(),
    createBooking: vi.fn().mockResolvedValue({
      booking: { _id: "book_test_mobile_1", status: "pending_payment" },
    }),
  },
  bookingKeys: { all: ["bookings"] },
}));

const mockDraft = {
  serviceId: "srv_test_123",
  serviceName: "Full Home Sanitization",
  addressId: "addr_test_123",
  addressSnapshot: {
    line1: "123 Main St",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    contactName: "John Doe",
    contactPhone: "+919876543210",
  },
  date: "2026-11-10",
  slot: "16:00-18:00",
  quantity: 1,
  addOns: [],
  couponCode: null,
  getIdempotencyKey: vi.fn().mockReturnValue("idem_test_key_123"),
  resetIdempotency: vi.fn(),
  setCouponCode: vi.fn(),
  setStep: vi.fn(),
  setSlot: vi.fn(),
  setNotice: vi.fn(),
};

vi.mock("@/features/booking", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/booking")>();
  return {
    ...actual,
    useBookingDraftStore: vi.fn(),
    useAvailableCoupons: () => ({ data: [] }),
    useValidateCoupon: () => ({ mutateAsync: vi.fn() }),
    useQuote: () => {
      const mockQuoteData = {
        total: 1180,
        subtotal: 1000,
        discount: 0,
        convenienceFee: 0,
        gst: 180,
        lines: [
          {
            kind: "BASE" as const,
            refId: "srv_test_123",
            name: "Full Home Sanitization",
            quantity: 1,
            unitPrice: 1000,
            amount: 1000,
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

describe("Mobile StepReview Payment & Gateway Initialization", () => {
  let queryClient: QueryClient;
  let mockRazorpayInstance: {
    open: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
  };
  let capturedOptions: Record<string, unknown> = {};

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.clearAllMocks();

    mockRazorpayInstance = {
      open: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    };

    capturedOptions = {};

    window.Razorpay = vi.fn().mockImplementation(function (
      this: unknown,
      opts: Record<string, unknown>,
    ) {
      capturedOptions = opts;
      return mockRazorpayInstance;
    }) as unknown as typeof window.Razorpay;

    (useBookingDraftStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue(mockDraft);

    // Simulate mobile viewport
    window.innerWidth = 390;
    window.innerHeight = 844;
  });

  afterEach(() => {
    delete window.Razorpay;
  });

  it("preloads Razorpay SDK on mount and configures mobile redirect with callback_url", async () => {
    (bookingApi.createBooking as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      booking: { _id: "book_test_mobile_1", status: "pending_payment" },
    });

    (paymentApi.createOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      orderId: "order_test_mobile_1",
      keyId: "rzp_test_mobile_key",
      amount: 118000,
      currency: "INR",
      prefill: {
        name: "John Doe",
        email: "john@example.com",
        contact: "+919876543210",
      },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/customer/book/step-4"]}>
          <Routes>
            <Route path="/customer/book/step-4" element={<StepReview />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    // Verify button is rendered
    const payButtons = screen.getAllByRole("button", { name: /Confirm & Pay/i });
    expect(payButtons.length).toBeGreaterThan(0);

    // Tap Pay
    fireEvent.click(payButtons[0]);

    await waitFor(() => {
      expect(bookingApi.createBooking).toHaveBeenCalled();
      expect(paymentApi.createOrder).toHaveBeenCalledWith("book_test_mobile_1");
      expect(mockRazorpayInstance.open).toHaveBeenCalled();
    });

    // Check mobile integration options passed to Razorpay
    expect(capturedOptions.callback_url).toBeDefined();
    expect(capturedOptions.redirect).toBe(false);
    // On mobile, method: "upi" must NOT be forced so native intent errors are avoided
    expect((capturedOptions.prefill as Record<string, unknown>)?.method).toBeUndefined();
  });

  it("suppresses 'This browser is not supported' alert without prematurely dispatching mock bank", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    let eventDispatched = false;
    const eventHandler = () => {
      eventDispatched = true;
    };
    window.addEventListener("razorpay_mockbank_open", eventHandler);

    // Call window.alert with the exact message from Razorpay
    window.alert("This browser is not supported. Please try payment in another browser.");

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("[Razorpay Interceptor]"),
      expect.stringContaining("This browser is not supported"),
    );
    expect(eventDispatched).toBe(false);

    window.removeEventListener("razorpay_mockbank_open", eventHandler);
    consoleSpy.mockRestore();
  });

  it("prevents duplicate payment calls when button is tapped multiple times synchronously", async () => {
    (bookingApi.createBooking as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ booking: { _id: "book_test_mobile_2" } }), 100),
        ),
    );

    (paymentApi.createOrder as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      orderId: "order_test_mobile_2",
      keyId: "rzp_test_mobile_key",
      amount: 118000,
      currency: "INR",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/customer/book/step-4"]}>
          <Routes>
            <Route path="/customer/book/step-4" element={<StepReview />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const payButtons = screen.getAllByRole("button", { name: /Confirm & Pay/i });

    // Rapid double click
    fireEvent.click(payButtons[0]);
    fireEvent.click(payButtons[0]);

    await waitFor(() => {
      expect(bookingApi.createBooking).toHaveBeenCalledTimes(1);
    });
  });
});
