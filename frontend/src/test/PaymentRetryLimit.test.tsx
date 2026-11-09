import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AddMoneyModal } from "@/components/customer/payments/AddMoneyModal";
import BookingFailed from "@/pages/customer/BookingFailed";
import { api } from "@/lib/api";
import { paymentApi } from "@/services/paymentApi";

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
  },
}));

vi.mock("@/services/paymentApi", () => ({
  paymentApi: {
    submitMockBankOutcome: vi.fn(),
    createOrder: vi.fn(),
    recordAttempt: vi.fn(),
    verify: vi.fn(),
  },
}));

vi.mock("@/features/payments/razorpay", () => ({
  loadRazorpayScript: vi.fn().mockResolvedValue(true),
  forceCloseRazorpayModal: vi.fn(),
  closeActivePopup: vi.fn(),
  resetRazorpayState: vi.fn(),
  getLatestCallbackUrl: vi.fn().mockReturnValue("https://api.razorpay.com/callback"),
  getLatestPaymentId: vi.fn().mockReturnValue("pay_test_retry_123"),
  isMobileOrEmulation: vi.fn().mockReturnValue(true),
}));

describe("HomeCareX - Payment Retry Limit Enforcement", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  describe("Customer Wallet Top-Up / Add Money Retry Limit", () => {
    it("enforces a strict maximum of 3 failed attempts, marks payment as FAILED, and removes Retry Payment", async () => {
      let openCallCount = 0;
      class MockRazorpay {
        constructor() {
          openCallCount++;
        }
        open() {}
        on(event: string, handler: (payload: any) => void) {
          if (event === "payment.failed") {
            // Trigger failure on next tick
            setTimeout(() => {
              handler({
                error: {
                  code: "BAD_REQUEST_ERROR",
                  description: "Payment declined by issuing bank",
                  source: "gateway",
                  step: "payment_authentication",
                  reason: "payment_failed",
                },
              });
            }, 0);
          }
        }
        close() {}
      }
      (window as any).Razorpay = MockRazorpay;

      (api.post as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
        if (url === "/wallet/topup/order") {
          return Promise.resolve({
            data: {
              data: {
                orderId: "order_topup_retry_test",
                amount: 50000,
                keyId: "rzp_test_topup",
              },
            },
          });
        }
        if (url === "/wallet/topup/fail") {
          return Promise.resolve({
            data: {
              success: true,
              maxRetriesReached: true,
              attempts: 3,
            },
          });
        }
        return Promise.resolve({ data: {} });
      });

      (paymentApi.submitMockBankOutcome as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        success: false,
        reason: "declined",
      });

      render(
        <QueryClientProvider client={queryClient}>
          <AddMoneyModal isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>,
      );

      // Attempt 1: Start topup (Initial attempt)
      fireEvent.click(screen.getByRole("button", { name: /Proceed to Pay/i }));

      // Wait for mock bank dialog to appear
      await waitFor(() => screen.getByRole("button", { name: /^Failure$/i }));
      fireEvent.click(screen.getByRole("button", { name: /^Failure$/i }));

      // Attempt 1 Failure Screen (3 retries remaining)
      await waitFor(() => {
        expect(screen.getByText(/3 retries remaining/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Retry Payment/i })).toBeInTheDocument();
      });

      // Attempt 2: Click Retry Payment and fail (Retry 1 used, 2 retries remaining)
      fireEvent.click(screen.getByRole("button", { name: /Retry Payment/i }));
      fireEvent.click(screen.getByRole("button", { name: /Proceed to Pay/i }));

      await waitFor(() => screen.getByRole("button", { name: /^Failure$/i }));
      fireEvent.click(screen.getByRole("button", { name: /^Failure$/i }));

      // Attempt 2 Failure Screen (2 retries remaining)
      await waitFor(() => {
        expect(screen.getByText(/2 retries remaining/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Retry Payment/i })).toBeInTheDocument();
      });

      // Attempt 3: Click Retry Payment and fail (Retry 2 used, 1 retry remaining)
      fireEvent.click(screen.getByRole("button", { name: /Retry Payment/i }));
      fireEvent.click(screen.getByRole("button", { name: /Proceed to Pay/i }));

      await waitFor(() => screen.getByRole("button", { name: /^Failure$/i }));
      fireEvent.click(screen.getByRole("button", { name: /^Failure$/i }));

      // Attempt 3 Failure Screen (1 retry remaining)
      await waitFor(() => {
        expect(screen.getByText(/1 retry remaining/i)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Retry Payment/i })).toBeInTheDocument();
      });

      // Attempt 4: Click Retry Payment and fail (Retry 3 used -> Permanent failure)
      fireEvent.click(screen.getByRole("button", { name: /Retry Payment/i }));
      fireEvent.click(screen.getByRole("button", { name: /Proceed to Pay/i }));

      await waitFor(() => screen.getByRole("button", { name: /^Failure$/i }));
      fireEvent.click(screen.getByRole("button", { name: /^Failure$/i }));

      // Attempt 4: Maximum Payment Attempts Reached MUST be shown
      await waitFor(() => {
        expect(api.post).toHaveBeenCalledWith(
          "/wallet/topup/fail",
          expect.objectContaining({
            orderId: "order_topup_retry_test",
            markFailed: true,
            attempts: 4,
          }),
        );
        expect(
          screen.getByRole("heading", { name: /Maximum Payment Attempts Reached/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/You have reached the maximum of 3 payment retries/i),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Failed \(3 of 3 retries used\)/i),
        ).toBeInTheDocument();
        // The Retry Payment button MUST BE REMOVED
        expect(screen.queryByRole("button", { name: /Retry Payment/i })).not.toBeInTheDocument();
        // Only Return to Wallet button is available
        expect(screen.getByRole("button", { name: /Return to Wallet/i })).toBeInTheDocument();
      });
    });

    it("blocks the 4th attempt atomically and shows Maximum Payment Attempts Reached if server returns 429", async () => {
      (api.post as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
        response: {
          status: 429,
          data: {
            code: "PAYMENT_ATTEMPTS_EXCEEDED",
            message: "You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.",
          },
        },
      });

      render(
        <QueryClientProvider client={queryClient}>
          <AddMoneyModal isOpen={true} onClose={vi.fn()} />
        </QueryClientProvider>,
      );

      fireEvent.click(screen.getByRole("button", { name: /Proceed to Pay/i }));

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: /Maximum Payment Attempts Reached/i }),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/You have reached the maximum of 3 payment retries/i),
        ).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Retry Payment/i })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Return to Wallet/i })).toBeInTheDocument();
      });
    });
  });

  describe("Customer Service Booking Payments Retry Limit", () => {
    it("renders Retry Limit Exceeded, removes Retry Payment, and displays booking code on reason=max_retries", () => {
      render(
        <MemoryRouter initialEntries={["/customer/booking/failed/BK-B1299?reason=max_retries"]}>
          <Routes>
            <Route path="/customer/booking/failed/:id" element={<BookingFailed />} />
          </Routes>
        </MemoryRouter>,
      );

      // Title & Explanations
      expect(
        screen.getByRole("heading", { level: 1, name: /Retry Limit Exceeded/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/You have reached the maximum of 3 payment retries/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/No more payment attempts are allowed for this transaction/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/BK-B1299/i)).toBeInTheDocument();

      // Next Steps section
      expect(screen.getByRole("heading", { level: 2, name: /Next Steps/i })).toBeInTheDocument();
      expect(
        screen.getByText(/You have reached the maximum of 3 failed payment attempts/i),
      ).toBeInTheDocument();

      // Retry button is completely removed
      expect(screen.queryByRole("button", { name: /Retry Payment/i })).not.toBeInTheDocument();

      // Navigation buttons present
      expect(screen.getByRole("link", { name: /View My Bookings/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Return to Home/i })).toBeInTheDocument();
    });

    it("maintains retry capability on regular payment failure (attempts < 3)", () => {
      render(
        <MemoryRouter initialEntries={["/customer/booking/failed/BK-B1299?reason=failed"]}>
          <Routes>
            <Route path="/customer/booking/failed/:id" element={<BookingFailed />} />
          </Routes>
        </MemoryRouter>,
      );

      expect(screen.getByRole("heading", { level: 1, name: /Payment Failed/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Retry Payment/i })).toBeInTheDocument();
    });
  });
});
