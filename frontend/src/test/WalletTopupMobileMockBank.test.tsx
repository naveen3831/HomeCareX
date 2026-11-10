import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AddMoneyModal } from "@/components/customer/payments/AddMoneyModal";
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
  },
}));

describe("Wallet Top-Up Mobile Responsive Mock Bank Flow", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    (api.post as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === "/wallet/topup/order") {
        return Promise.resolve({
          data: {
            data: {
              orderId: "order_wallet_test_123",
              amount: 10000,
              keyId: "rzp_test_oLoLVfdIOlgKUN",
            },
          },
        });
      }
      if (url === "/wallet/topup/verify") {
        return Promise.resolve({
          data: {
            success: true,
            data: { balance: 600 },
          },
        });
      }
      if (url === "/wallet/topup/fail") {
        return Promise.resolve({
          data: { success: true },
        });
      }
      return Promise.resolve({ data: {} });
    });

    window.Razorpay = vi.fn().mockImplementation(() => ({
      open: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
    })) as unknown as typeof window.Razorpay;
  });

  it("renders mock bank test modal with Success & Failure buttons when razorpay_mockbank_open is dispatched", async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AddMoneyModal isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    // Enter amount and click proceed to pay
    const proceedBtn = screen.getByRole("button", { name: /Proceed to Pay/i });
    fireEvent.click(proceedBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/wallet/topup/order", { amount: 500 });
    });

    // Simulate mobile Netbanking bank selection event
    window.dispatchEvent(
      new CustomEvent("razorpay_mockbank_open", {
        detail: {
          callbackUrl: "https://api.razorpay.com/v1/payments/pay_wallet_123/callback",
          paymentId: "pay_wallet_123",
        },
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText("Welcome to Razorpay Software Private Ltd Bank"),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Success$/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Failure$/i })).toBeInTheDocument();
    });
  });

  it("completes wallet top-up successfully when Success button is tapped in mobile mock bank dialog", async () => {
    (paymentApi.submitMockBankOutcome as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      status: "captured",
      paymentId: "pay_wallet_123",
      signature: "sig_wallet_test_mock",
    });

    const onSuccess = vi.fn();
    const onClose = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <AddMoneyModal isOpen={true} onClose={onClose} onSuccess={onSuccess} />
      </QueryClientProvider>,
    );

    // Proceed to pay
    const proceedBtn = screen.getByRole("button", { name: /Proceed to Pay/i });
    fireEvent.click(proceedBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/wallet/topup/order", { amount: 500 });
    });

    // Mock bank opens on mobile
    window.dispatchEvent(
      new CustomEvent("razorpay_mockbank_open", {
        detail: {
          callbackUrl: "https://api.razorpay.com/v1/payments/pay_wallet_123/callback",
          paymentId: "pay_wallet_123",
        },
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^Success$/i })).toBeInTheDocument();
    });

    // Click Success
    fireEvent.click(screen.getByRole("button", { name: /^Success$/i }));

    await waitFor(() => {
      expect(paymentApi.submitMockBankOutcome).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: "order_wallet_test_123",
          outcome: "S",
        }),
      );
      expect(api.post).toHaveBeenCalledWith("/wallet/topup/verify", {
        razorpay_order_id: "order_wallet_test_123",
        razorpay_payment_id: "pay_wallet_123",
        razorpay_signature: "sig_wallet_test_mock",
        amount: 10000,
      });
      expect(screen.getByText("Payment Successful")).toBeInTheDocument();
      expect(screen.getByText("+₹100.00")).toBeInTheDocument();
      expect(screen.getByText("₹600.00")).toBeInTheDocument();
    });

    const continueBtn = screen.getByRole("button", { name: /continue/i });
    fireEvent.click(continueBtn);

    expect(onSuccess).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("records payment failure when Failure button is tapped 4 times (1 initial + 3 retries)", async () => {
    (paymentApi.submitMockBankOutcome as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      status: "failed",
      paymentId: "pay_wallet_123",
    });

    render(
      <QueryClientProvider client={queryClient}>
        <AddMoneyModal isOpen={true} onClose={vi.fn()} />
      </QueryClientProvider>,
    );

    const proceedBtn = screen.getByRole("button", { name: /Proceed to Pay/i });
    fireEvent.click(proceedBtn);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/wallet/topup/order", { amount: 500 });
    });

    // Attempt 1 (Initial attempt fails) -> 3 retries remaining
    window.dispatchEvent(
      new CustomEvent("razorpay_mockbank_open", {
        detail: {
          callbackUrl: "https://api.razorpay.com/v1/payments/pay_wallet_123/callback",
          paymentId: "pay_wallet_123",
        },
      }),
    );
    await waitFor(() => screen.getByRole("button", { name: /^Failure$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Failure$/i }));

    await waitFor(() => {
      expect(screen.getByText(/3 retries remaining/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Retry Payment/i })).toBeInTheDocument();
    });

    // Retry 1: Click Retry Payment and fail
    fireEvent.click(screen.getByRole("button", { name: /Retry Payment/i }));
    fireEvent.click(screen.getByRole("button", { name: /Proceed to Pay/i }));

    window.dispatchEvent(
      new CustomEvent("razorpay_mockbank_open", {
        detail: {
          callbackUrl: "https://api.razorpay.com/v1/payments/pay_wallet_123/callback",
          paymentId: "pay_wallet_123",
        },
      }),
    );
    await waitFor(() => screen.getByRole("button", { name: /^Failure$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Failure$/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 retries remaining/i)).toBeInTheDocument();
    });

    // Retry 2: Click Retry Payment and fail
    fireEvent.click(screen.getByRole("button", { name: /Retry Payment/i }));
    fireEvent.click(screen.getByRole("button", { name: /Proceed to Pay/i }));

    window.dispatchEvent(
      new CustomEvent("razorpay_mockbank_open", {
        detail: {
          callbackUrl: "https://api.razorpay.com/v1/payments/pay_wallet_123/callback",
          paymentId: "pay_wallet_123",
        },
      }),
    );
    await waitFor(() => screen.getByRole("button", { name: /^Failure$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Failure$/i }));

    await waitFor(() => {
      expect(screen.getByText(/1 retry remaining/i)).toBeInTheDocument();
    });

    // Retry 3 (3rd retry fails) -> Exhausted!
    fireEvent.click(screen.getByRole("button", { name: /Retry Payment/i }));
    fireEvent.click(screen.getByRole("button", { name: /Proceed to Pay/i }));

    window.dispatchEvent(
      new CustomEvent("razorpay_mockbank_open", {
        detail: {
          callbackUrl: "https://api.razorpay.com/v1/payments/pay_wallet_123/callback",
          paymentId: "pay_wallet_123",
        },
      }),
    );
    await waitFor(() => screen.getByRole("button", { name: /^Failure$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Failure$/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/wallet/topup/fail",
        expect.objectContaining({
          orderId: "order_wallet_test_123",
          markFailed: true,
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
      expect(
        screen.queryByRole("button", { name: /Retry Payment/i }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Return to Wallet/i }),
      ).toBeInTheDocument();
    });
  });

  it("Scenario 2: starting a new wallet top-up creates a new transaction and fresh retry counter", async () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <AddMoneyModal isOpen={true} onClose={handleClose} />
      </QueryClientProvider>,
    );

    // Exhaust attempts on order 1
    (paymentApi.submitMockBankOutcome as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: false,
      status: "failed",
      paymentId: "pay_wallet_123",
    });

    fireEvent.click(screen.getByRole("button", { name: /Proceed to Pay/i }));

    // Close and reopen modal for a brand new top-up
    rerender(
      <QueryClientProvider client={queryClient}>
        <AddMoneyModal isOpen={false} onClose={handleClose} />
      </QueryClientProvider>,
    );

    (api.post as unknown as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (url === "/wallet/topup/order") {
        return Promise.resolve({
          data: {
            data: {
              orderId: "order_new_fresh_999",
              amount: 50000,
              keyId: "rzp_test_oLoLVfdIOlgKUN",
            },
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    rerender(
      <QueryClientProvider client={queryClient}>
        <AddMoneyModal isOpen={true} onClose={handleClose} />
      </QueryClientProvider>,
    );

    // Enter amount and proceed
    fireEvent.click(screen.getByRole("button", { name: /Proceed to Pay/i }));

    await waitFor(() => {
      // Must NOT include retryOrderId from the old transaction
      expect(api.post).toHaveBeenLastCalledWith("/wallet/topup/order", { amount: 500 });
    });
  });
});
