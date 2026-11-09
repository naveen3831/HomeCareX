import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { api } from "@/lib/api";
import {
  loadRazorpayScript,
  forceCloseRazorpayModal,
  closeActivePopup,
  getLatestCallbackUrl,
  getLatestPaymentId,
  isMobileOrEmulation,
} from "@/features/payments/razorpay";
import { paymentApi } from "@/services/paymentApi";

interface RazorpayCheckout {
  open: () => void;
  on: (
    event: string,
    handler: (response: RazorpayFailurePayload) => void | Promise<void>,
  ) => void;
}

type RazorpayConstructor = new (
  options: Record<string, unknown>,
) => RazorpayCheckout;

interface WalletCache {
  balance: number;
}

interface RazorpaySuccessPayload {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayFailurePayload {
  error: {
    code: string;
    description: string;
    source: string;
    step: string;
    reason: string;
  };
}

interface AddMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userEmail?: string;
  userName?: string;
}

type ModalStep = "input" | "mock_bank" | "success" | "failed" | "max_retries" | "cancelled";

interface PaymentResultData {
  amount: number;
  newBalance?: number;
  paymentId?: string;
  reason?: string;
}

const PRESET_AMOUNTS = [100, 200, 500, 1000];
const MIN_AMOUNT = 10;
const MAX_AMOUNT = 50000;
const MAX_FAILED_ATTEMPTS = 4; // 1 initial attempt + 3 retries

export function AddMoneyModal({
  isOpen,
  onClose,
  onSuccess,
  userEmail,
  userName,
}: AddMoneyModalProps) {
  const [amount, setAmount] = useState<string>("500");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [step, setStep] = useState<ModalStep>("input");
  const [paymentResult, setPaymentResult] = useState<PaymentResultData | null>(
    null,
  );
  const queryClient = useQueryClient();

  // Track failure count across the current payment session
  const failureCountRef = useRef(0);

  // Active order details for mock bank outcome submission
  const activeOrderRef = useRef<{
    orderId: string;
    amountInPaise: number;
  } | null>(null);

  // Mobile Demo Bank Mock State
  const [mockBankState, setMockBankState] = useState<{
    open: boolean;
    callbackUrl: string;
    paymentId: string;
    orderId: string;
  } | null>(null);
  const [isSubmittingMock, setIsSubmittingMock] = useState<"S" | "F" | null>(
    null,
  );

  useEffect(() => {
    if (isOpen) {
      setStep("input");
      setIsLoading(false);
      setErrorMsg(null);
      setPaymentResult(null);
      failureCountRef.current = 0;
      activeOrderRef.current = null;
      setMockBankState(null);
      setIsSubmittingMock(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleMockBankOpen = (e: Event) => {
      closeActivePopup();
      forceCloseRazorpayModal();
      const detail = ((e as CustomEvent).detail || {}) as {
        callbackUrl?: string;
        paymentId?: string;
      };
      setMockBankState({
        open: true,
        callbackUrl: detail.callbackUrl || getLatestCallbackUrl(),
        paymentId: detail.paymentId || getLatestPaymentId(),
        orderId: activeOrderRef.current?.orderId || "",
      });
      setStep("mock_bank");
    };

    window.addEventListener("razorpay_mockbank_open", handleMockBankOpen);
    return () => {
      window.removeEventListener("razorpay_mockbank_open", handleMockBankOpen);
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        if (step === "mock_bank") {
          setMockBankState(null);
          setStep("cancelled");
          return;
        }
        onClose();
      }
    },
    [isLoading, onClose, step],
  );

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const handleTopup = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg(null);

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount < MIN_AMOUNT) {
      setErrorMsg(`Please enter an amount of at least ₹${MIN_AMOUNT}.`);
      return;
    }
    if (numericAmount > MAX_AMOUNT) {
      setErrorMsg(
        `Maximum top-up amount is ₹${MAX_AMOUNT.toLocaleString("en-IN")}.`,
      );
      return;
    }

    if (failureCountRef.current >= MAX_FAILED_ATTEMPTS) {
      setPaymentResult({
        amount: numericAmount,
        reason:
          "You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.",
      });
      setStep("max_retries");
      return;
    }

    setIsLoading(true);

    try {
      const isLoaded = await loadRazorpayScript();
      const RazorpayConstructor = (
        window as unknown as { Razorpay?: RazorpayConstructor }
      ).Razorpay;

      if (!isLoaded || !RazorpayConstructor) {
        throw new Error(
          "Razorpay SDK failed to load. Please check your internet connection.",
        );
      }

      // 1. Create Order on Backend (track persistent attempt)
      const { data: orderRes } = await api.post("/wallet/topup/order", {
        amount: numericAmount,
        ...(activeOrderRef.current?.orderId
          ? { retryOrderId: activeOrderRef.current.orderId }
          : {}),
      });

      const { orderId, amount: amountInPaise, keyId } = orderRes.data;
      activeOrderRef.current = { orderId, amountInPaise };

      // 2. Open Razorpay Checkout modal
      const rzp = new RazorpayConstructor({
        key: keyId,
        amount: amountInPaise,
        currency: "INR",
        name: "HomeCareX",
        description: "Wallet Balance Top-Up",
        order_id: orderId,
        callback_url: `${window.location.origin}/api/v1/payments/callback`,
        redirect: false,
        prefill: {
          name: userName,
          email: userEmail,
        },
        theme: {
          color: "#201547",
        },
        handler: async (response: RazorpaySuccessPayload) => {
          setIsLoading(true);
          try {
            const { data: verifyRes } = await api.post("/wallet/topup/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              amount: amountInPaise,
            });

            const newBalance = verifyRes?.data?.balance;

            if (typeof newBalance === "number") {
              queryClient.setQueriesData<WalletCache>(
                { queryKey: ["wallet"] },
                (old) => (old ? { ...old, balance: newBalance } : old),
              );
              queryClient.setQueriesData<WalletCache>(
                { queryKey: ["customer", "wallet"] },
                (old) => (old ? { ...old, balance: newBalance } : old),
              );
            }

            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["wallet"] }),
              queryClient.invalidateQueries({
                queryKey: ["customer", "wallet"],
              }),
            ]);

            setPaymentResult({
              amount: numericAmount,
              newBalance,
              paymentId: response.razorpay_payment_id,
            });
            setIsLoading(false);
            setStep("success");
          } catch (err: unknown) {
            const error = err as { response?: { data?: { message?: string } } };
            setPaymentResult({
              amount: numericAmount,
              reason:
                error.response?.data?.message ||
                "Failed to verify transaction.",
            });
            setIsLoading(false);
            setStep("failed");
          }
        },
        modal: {
          ondismiss: () => {
            forceCloseRazorpayModal();
            closeActivePopup();
            setIsLoading(false);
            setStep((currentStep) => {
              if (currentStep === "input") {
                setPaymentResult({
                  amount: numericAmount,
                  reason:
                    "You cancelled the checkout process. No money was deducted from your account.",
                });
                return "cancelled";
              }
              return currentStep;
            });
          },
        },
      });

      // 3. Listen to gateway failure events
      rzp.on("payment.failed", async (response: RazorpayFailurePayload) => {
        forceCloseRazorpayModal();
        closeActivePopup();

        // When Razorpay fails in test mode on mobile/simulator/responsive (e.g. account validation 400 error on netbanking/wallet,
        // popup-blocked error, or gateway bank auth error): immediately transition to the in-app demo bank mock dialog
        const isTestBankFailure =
          response.error?.step === "payment_authentication" ||
          response.error?.code === "BAD_REQUEST_ERROR" ||
          response.error?.source === "gateway" ||
          Boolean(
            response.error?.description?.includes("could not be completed"),
          ) ||
          Boolean(
            response.error?.description?.includes("use another method"),
          ) ||
          isMobileOrEmulation();

        if (isTestBankFailure) {
          setIsLoading(false);
          setMockBankState({
            open: true,
            callbackUrl:
              getLatestCallbackUrl() ||
              `${window.location.origin}/api/v1/payments/callback`,
            paymentId:
              getLatestPaymentId() ||
              `pay_${Math.random().toString(36).substring(2, 16)}`,
            orderId: activeOrderRef.current?.orderId || orderId,
          });
          setStep("mock_bank");
          return;
        }

        failureCountRef.current += 1;
        const currentFailures = failureCountRef.current;
        const reason =
          response.error?.description || "Payment could not be completed.";

        if (currentFailures >= MAX_FAILED_ATTEMPTS) {
          try {
            await api.post("/wallet/topup/fail", {
              orderId,
              amount: amountInPaise,
              markFailed: true,
              attempts: currentFailures,
              reason: `Payment failed after 3 retries: ${reason}`,
            });

            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["wallet"] }),
              queryClient.invalidateQueries({
                queryKey: ["customer", "wallet"],
              }),
            ]);
          } catch (failErr) {
            console.error("Failed to record topup failure:", failErr);
          }

          setPaymentResult({
            amount: numericAmount,
            reason:
              "You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.",
          });
          setIsLoading(false);
          setStep("max_retries");
          return;
        }

        const retriesRemaining = Math.max(0, 4 - currentFailures);
        setPaymentResult({
          amount: numericAmount,
          reason: `Payment failed. You have ${retriesRemaining} ${retriesRemaining === 1 ? "retry" : "retries"} remaining.`,
        });
        setIsLoading(false);
        setStep("failed");
      });

      rzp.open();
    } catch (err: unknown) {
      const error = err as {
        response?: { status?: number; data?: { code?: string; message?: string } };
        message?: string;
      };
      if (
        error.response?.status === 429 ||
        error.response?.data?.code === "PAYMENT_ATTEMPTS_EXCEEDED" ||
        error.response?.data?.message?.includes("maximum of 3") ||
        error.response?.data?.message?.includes("maximum limit of 3")
      ) {
        failureCountRef.current = MAX_FAILED_ATTEMPTS;
        setPaymentResult({
          amount: numericAmount,
          reason:
            error.response?.data?.message ||
            "You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.",
        });
        setIsLoading(false);
        setStep("max_retries");
        return;
      }
      setErrorMsg(
        error.response?.data?.message ||
          error.message ||
          "Could not initiate top-up.",
      );
      setIsLoading(false);
    }
  };

  const handleMockBankOutcome = async (outcome: "S" | "F") => {
    closeActivePopup();
    setIsSubmittingMock(outcome);
    const orderId =
      mockBankState?.orderId ||
      activeOrderRef.current?.orderId ||
      "order_test_mock";
    const paymentId =
      mockBankState?.paymentId ||
      getLatestPaymentId() ||
      `pay_${Math.random().toString(36).substring(2, 16)}`;
    const callbackUrl =
      mockBankState?.callbackUrl || getLatestCallbackUrl() || "";
    const amountInPaise =
      activeOrderRef.current?.amountInPaise || Number(amount) * 100;
    const numericAmount = Math.round(amountInPaise / 100);

    try {
      const res = await paymentApi.submitMockBankOutcome({
        orderId,
        paymentId,
        callbackUrl,
        outcome,
      });

      setMockBankState(null);

      if (outcome === "S" && res.success) {
        setIsLoading(true);
        try {
          const { data: verifyRes } = await api.post("/wallet/topup/verify", {
            razorpay_order_id: orderId,
            razorpay_payment_id: res.paymentId || paymentId,
            razorpay_signature: res.signature,
            amount: amountInPaise,
          });

          const newBalance = verifyRes?.data?.balance;

          if (typeof newBalance === "number") {
            queryClient.setQueriesData<WalletCache>(
              { queryKey: ["wallet"] },
              (old) => (old ? { ...old, balance: newBalance } : old),
            );
            queryClient.setQueriesData<WalletCache>(
              { queryKey: ["customer", "wallet"] },
              (old) => (old ? { ...old, balance: newBalance } : old),
            );
          }

          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["wallet"] }),
            queryClient.invalidateQueries({
              queryKey: ["customer", "wallet"],
            }),
          ]);

          setPaymentResult({
            amount: numericAmount,
            newBalance,
            paymentId: res.paymentId || paymentId,
          });
          setIsLoading(false);
          setStep("success");
        } catch (err: unknown) {
          const error = err as { response?: { data?: { message?: string } } };
          setPaymentResult({
            amount: numericAmount,
            reason:
              error.response?.data?.message || "Failed to verify transaction.",
          });
          setIsLoading(false);
          setStep("failed");
        }
      } else {
        failureCountRef.current += 1;
        const currentFailures = failureCountRef.current;
        const failureReason =
          "Payment was declined on the demo bank authorization page.";

        if (currentFailures >= MAX_FAILED_ATTEMPTS) {
          try {
            await api.post("/wallet/topup/fail", {
              orderId,
              amount: amountInPaise,
              markFailed: true,
              attempts: currentFailures,
              reason: "Payment declined on demo bank page after 3 retries",
            });
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["wallet"] }),
              queryClient.invalidateQueries({
                queryKey: ["customer", "wallet"],
              }),
            ]);
          } catch (failErr) {
            console.error("Failed to record topup failure:", failErr);
          }

          setPaymentResult({
            amount: numericAmount,
            reason:
              "You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.",
          });
          setIsLoading(false);
          setStep("max_retries");
          return;
        }

        const retriesRemaining = Math.max(0, 4 - currentFailures);
        setPaymentResult({
          amount: numericAmount,
          reason: `Payment failed. You have ${retriesRemaining} ${retriesRemaining === 1 ? "retry" : "retries"} remaining: ${failureReason}`,
        });
        setIsLoading(false);
        setStep("failed");
      }
    } catch (err: unknown) {
      setMockBankState(null);
      const error = err as {
        response?: { data?: { message?: string } };
        message?: string;
      };
      setPaymentResult({
        amount: numericAmount,
        reason:
          error.response?.data?.message ||
          error.message ||
          "Failed to process bank mock response.",
      });
      setIsLoading(false);
      setStep("failed");
    } finally {
      setIsSubmittingMock(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-money-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading && step === "input") {
          onClose();
        }
      }}
    >
      {/* 1. INPUT STEP: ENTER AMOUNT */}
      {step === "input" && (
        <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h3 id="add-money-title" className="text-lg font-semibold text-ink">
              Top Up Wallet
            </h3>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className={`rounded-lg p-1 text-muted hover:bg-canvas disabled:opacity-50 ${FOCUS_RING}`}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close</span>
            </button>
          </div>

          <form onSubmit={handleTopup} className="mt-4">
            <label
              htmlFor="topup-amount"
              className="block text-xs font-semibold uppercase tracking-wider text-muted"
            >
              Enter Amount (₹)
            </label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-semibold text-ink">
                ₹
              </span>
              <input
                id="topup-amount"
                type="number"
                min={MIN_AMOUNT}
                max={MAX_AMOUNT}
                disabled={isLoading}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                className={`w-full rounded-xl border border-line py-2.5 pl-8 pr-4 text-lg font-semibold text-ink shadow-sm placeholder:text-muted disabled:bg-canvas disabled:text-muted ${FOCUS_RING}`}
                placeholder="500"
                autoFocus
              />
            </div>

            <div className="mt-3 flex gap-2">
              {PRESET_AMOUNTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    setAmount(p.toString());
                    if (errorMsg) setErrorMsg(null);
                  }}
                  className="flex-1 rounded-lg border border-line bg-canvas py-1.5 text-xs font-medium text-ink transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
                >
                  +₹{p}
                </button>
              ))}
            </div>

            {errorMsg && (
              <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-xs font-medium text-red-600">
                {errorMsg}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className={`w-1/2 rounded-xl border border-line bg-white py-2.5 text-sm font-medium text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`inline-flex w-1/2 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                {isLoading ? "Processing…" : "Proceed to Pay"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 2. DEMO BANK MOCK PAGE (Net Banking / Wallet in test mode) */}
      {step === "mock_bank" && mockBankState?.open && (
        <div className="relative w-full max-w-[440px] rounded-2xl bg-white p-6 sm:p-8 text-center shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
          <button
            type="button"
            onClick={() => {
              closeActivePopup();
              setMockBankState(null);
              forceCloseRazorpayModal();
              setIsLoading(false);
              setPaymentResult({
                amount: Number(amount) || 500,
                reason:
                  "You cancelled the bank authorization. No money was deducted from your account.",
              });
              setStep("cancelled");
            }}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="text-[#2563eb] font-black text-5xl sm:text-6xl italic leading-none mb-3 sm:mb-4 select-none">
            1
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-[#0f172a] mb-2 leading-snug">
            Welcome to Razorpay Software Private Ltd Bank
          </h2>
          <p className="text-xs sm:text-sm text-[#64748b] mb-1">
            This is just a demo bank page.
          </p>
          <p className="text-xs sm:text-sm text-[#334155] mb-5 sm:mb-6">
            You can choose whether to make this payment successful or not:
          </p>
          <div className="flex items-center justify-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => handleMockBankOutcome("S")}
              disabled={isSubmittingMock !== null}
              className="flex-1 max-w-[150px] h-11 sm:h-12 rounded-md bg-[#22c55e] hover:bg-[#16a34a] active:bg-[#15803d] text-white font-semibold text-sm sm:text-base shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingMock === "S" ? "Processing…" : "Success"}
            </button>
            <button
              type="button"
              onClick={() => handleMockBankOutcome("F")}
              disabled={isSubmittingMock !== null}
              className="flex-1 max-w-[150px] h-11 sm:h-12 rounded-md bg-[#ef4444] hover:bg-[#dc2626] active:bg-[#b91c1c] text-white font-semibold text-sm sm:text-base shadow transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingMock === "F" ? "Processing…" : "Failure"}
            </button>
          </div>
          {isSubmittingMock && (
            <div className="mt-4 text-xs sm:text-sm font-medium text-slate-600">
              {isSubmittingMock === "S"
                ? "Authorizing payment…"
                : "Declining payment…"}
            </div>
          )}
        </div>
      )}

      {/* 3. SUCCESS DIALOG */}
      {step === "success" && (
        <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl text-center animate-in zoom-in-95 duration-150">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4 shadow-xs">
            <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-ink">Payment Successful</h3>
          <p className="mt-1 text-sm text-muted">
            Money added to your wallet successfully
          </p>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-left space-y-2.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Amount Added</span>
              <span className="font-bold text-emerald-600 text-base">
                +₹
                {paymentResult?.amount.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
            {typeof paymentResult?.newBalance === "number" && (
              <div className="flex items-center justify-between text-sm border-t border-slate-200/60 pt-2">
                <span className="text-muted">Updated Balance</span>
                <span className="font-bold text-ink">
                  ₹
                  {paymentResult.newBalance.toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            )}
            {paymentResult?.paymentId && (
              <div className="flex items-center justify-between text-xs text-muted border-t border-slate-200/60 pt-2">
                <span>Transaction Reference</span>
                <span className="font-mono font-medium text-slate-700 truncate max-w-[200px]">
                  {paymentResult.paymentId}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onSuccess?.();
              onClose();
            }}
            className={`mt-6 w-full rounded-xl bg-brand py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 ${FOCUS_RING}`}
          >
            Continue
          </button>
        </div>
      )}

      {/* 4. FAILED DIALOG */}
      {step === "failed" && (
        <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl text-center animate-in zoom-in-95 duration-150">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4 shadow-xs">
            <XCircle className="h-9 w-9" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-ink">Payment Failed</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
            {paymentResult?.reason ||
              "Payment could not be completed. Please try another method."}
          </p>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-left">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Failed Amount</span>
              <span className="font-semibold text-rose-600">
                ₹
                {paymentResult?.amount.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`${failureCountRef.current < MAX_FAILED_ATTEMPTS ? "w-1/2" : "w-full"} rounded-xl border border-line bg-white py-2.5 text-sm font-medium text-ink hover:bg-canvas ${FOCUS_RING}`}
            >
              Close
            </button>
            {failureCountRef.current < MAX_FAILED_ATTEMPTS && (
              <button
                type="button"
                onClick={() => {
                  setStep("input");
                  setErrorMsg(null);
                }}
                className={`w-1/2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 ${FOCUS_RING}`}
              >
                <RotateCcw className="h-4 w-4" />
                Retry Payment
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4b. MAXIMUM PAYMENT ATTEMPTS REACHED DIALOG */}
      {step === "max_retries" && (
        <div className="w-full max-w-md rounded-2xl border border-rose-100 bg-white p-6 shadow-xl text-center animate-in zoom-in-95 duration-150">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-600 mb-4 shadow-xs">
            <XCircle className="h-9 w-9 stroke-[2.2]" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-ink">
            Maximum Payment Attempts Reached
          </h3>
          <p className="mt-2 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
            You have reached the maximum of 3 payment retries. No more payment attempts are allowed for this transaction.
          </p>

          <div className="mt-5 rounded-xl border border-rose-100 bg-rose-50/70 p-4 text-left space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Amount</span>
              <span className="font-semibold text-slate-800">
                ₹
                {paymentResult?.amount
                  ? paymentResult.amount.toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })
                  : Number(amount || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                    })}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-rose-200/50 pt-2">
              <span className="text-muted">Status</span>
              <span className="inline-flex items-center gap-1 font-semibold text-rose-600 text-xs uppercase tracking-wide">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
                Failed (3 of 3 retries used)
              </span>
            </div>
            {activeOrderRef.current?.orderId && (
              <div className="flex items-center justify-between text-xs text-muted border-t border-rose-200/50 pt-2">
                <span>Order Reference</span>
                <span className="font-mono text-slate-700 truncate max-w-[180px]">
                  {activeOrderRef.current.orderId}
                </span>
              </div>
            )}
          </div>

          <p className="mt-3.5 text-xs text-muted">
            Retry payment is disabled for this transaction. Please return to your wallet to start a fresh top-up.
          </p>

          <div className="mt-6">
            <button
              type="button"
              onClick={() => {
                activeOrderRef.current = null;
                failureCountRef.current = 0;
                onClose();
              }}
              className={`w-full rounded-xl bg-brand hover:opacity-95 py-3 text-sm font-semibold text-white shadow-sm transition-colors ${FOCUS_RING}`}
            >
              Return to Wallet
            </button>
          </div>
        </div>
      )}

      {/* 5. CANCELLED DIALOG */}
      {step === "cancelled" && (
        <div className="w-full max-w-md rounded-2xl border border-line bg-white p-6 shadow-xl text-center animate-in zoom-in-95 duration-150">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600 mb-4 shadow-xs">
            <AlertCircle className="h-9 w-9" aria-hidden="true" />
          </div>
          <h3 className="text-xl font-bold text-ink">Payment Cancelled</h3>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-sm mx-auto">
            You cancelled the payment request. No money was deducted from your
            account.
          </p>

          <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-left">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Amount</span>
              <span className="font-semibold text-slate-700">
                ₹
                {paymentResult?.amount.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className={`${failureCountRef.current < MAX_FAILED_ATTEMPTS ? "w-1/2" : "w-full"} rounded-xl border border-line bg-white py-2.5 text-sm font-medium text-ink hover:bg-canvas ${FOCUS_RING}`}
            >
              Return to Wallet
            </button>
            {failureCountRef.current < MAX_FAILED_ATTEMPTS && (
              <button
                type="button"
                onClick={() => {
                  setStep("input");
                  setErrorMsg(null);
                }}
                className={`w-1/2 inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95 ${FOCUS_RING}`}
              >
                <RotateCcw className="h-4 w-4" />
                Retry Payment
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
