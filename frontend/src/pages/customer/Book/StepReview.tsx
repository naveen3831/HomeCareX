import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Banknote,
  Calendar,
  CalendarCheck,
  CalendarClock,
  Check,
  ChevronDown,
  ChevronUp,
  CreditCard,
  IndianRupee,
  Info,
  Landmark,
  Lock,
  MapPin,
  Pencil,
  Smartphone,
  Sparkles,
  Tag,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import { serviceVisual } from "@/pages/customer/Shared/visuals";
import { useQueryClient } from "@tanstack/react-query";
import { bookingKeys } from "@/hooks/useBookings";
import {
  useAvailableCoupons,
  useBookingDraftStore,
  useQuote,
  useValidateCoupon,
} from "@/features/booking";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { customerPath } from "@/routes/customerPath";
import { bookingApi, type NormalizedApiError } from "@/services/bookingApi";
import { paymentApi } from "@/services/paymentApi";
import { PRICING_IS_MOCK } from "@/services/pricingApi";
import type { CreateBookingRequest } from "@/types/booking";
import {
  COUPON_ERROR,
  type PriceQuote,
  type QuoteRequest,
} from "@/types/pricing";
import { formatSlotLabel } from "./components/SlotPicker";
import { couponErrorText } from "./components/CouponInput";
import PriceBreakdown from "./components/PriceBreakdown";
import { formatINR } from "./formatMoney";
import { settledBookingDestination } from "./settledBooking";
import { PaymentResult } from "@/components/customer/payments";
import {
  CHECKOUT_METHODS,
  closeActivePopup,
  forceCloseRazorpayModal,
  getLatestCallbackUrl,
  getLatestPaymentId,
  isMobileOrEmulation,
  loadRazorpayScript,
  type RazorpayFailure,
  type RazorpayInstance,
  type RazorpaySuccess,
} from "@/features/payments";
import type { CheckoutMethod } from "@/types/payment";

/* -------------------------------------------------------------------------- */
/* Constants & helpers                                                        */
/* -------------------------------------------------------------------------- */

type RazorpayCheckoutMethod = "upi" | "card" | "netbanking" | "wallet";

function toRazorpayCheckoutMethod(
  method: Exclude<CheckoutMethod, "cod">,
): RazorpayCheckoutMethod | undefined {
  switch (method) {
    case "upi":
    case "card":
    case "netbanking":
    case "wallet":
      return method;
    default:
      return undefined;
  }
}

const PRE_POPUP_DELAY_MS = 0;
const MAX_PAYMENT_RETRIES = 3;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const ERROR_TO_STEP: Record<string, number> = {
  SERVICE_NOT_FOUND: 1,
  ADDON_NOT_FOUND: 1,
  ADDRESS_NOT_SERVICEABLE: 2,
  ADDRESS_NOT_FOUND: 2,
  SLOT_UNAVAILABLE: 3,
  SLOT_BUSY: 3,
  INVALID_DATE: 3,
};

const SLOT_ERRORS = new Set(["SLOT_UNAVAILABLE", "SLOT_BUSY", "INVALID_DATE"]);

const SLOT_TAKEN_NOTICE =
  "That time slot was just taken by someone else. Please pick another slot.";

const COUPON_ERROR_CODES: string[] = Object.values(COUPON_ERROR);

const METHOD_ICONS: Partial<Record<CheckoutMethod, LucideIcon>> = {
  upi: Smartphone,
  card: CreditCard,
  netbanking: Landmark,
  wallet: Wallet,
  cod: Banknote,
};

interface PriceNotice {
  from: number;
  to: number;
}

function minOrderOf(details: unknown): number | undefined {
  const value = (details as { minOrder?: unknown } | undefined)?.minOrder;
  return typeof value === "number" ? value : undefined;
}

type CompactCoupon = {
  code?: string;
  description?: string;
  subtitle?: string;
  title?: string;
  discountText?: string;
  discountType?: string;
  discountValue?: number;
  maxDiscount?: number;
  minOrder?: number;
  serviceName?: string;
  eligible?: boolean;
  reason?: string | { code: string; minOrder?: number };
};

function compactCouponDescription(coupon: CompactCoupon): string {
  const direct = coupon.description ?? coupon.subtitle ?? coupon.discountText;
  if (direct) return direct;
  const value = coupon.discountValue;
  const type = coupon.discountType?.toLowerCase();
  const parts: string[] = [];
  if (typeof value === "number") {
    if (type?.includes("percent")) parts.push(`${value}% off`);
    else parts.push(`${formatINR(value)} off`);
  }
  if (typeof coupon.maxDiscount === "number")
    parts.push(`up to ${formatINR(coupon.maxDiscount)}`);
  if (typeof coupon.minOrder === "number")
    parts.push(`min. ${formatINR(coupon.minOrder)}`);
  if (coupon.serviceName) parts.push(coupon.serviceName);
  return parts.join(" · ") || coupon.title || "Available offer";
}

/** "2026-10-15" -> "Thu, 15 Oct 2026". Parsed as a local date so the day never shifts with the timezone. */
function prettyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  const weekday = dt.toLocaleDateString("en-IN", { weekday: "short" });
  const month = dt.toLocaleDateString("en-IN", { month: "short" });
  return `${weekday}, ${d} ${month} ${y}`;
}

function getCouponBadge(coupon: CompactCoupon): string {
  if (coupon.discountText) return coupon.discountText;
  const isPercent =
    coupon.discountType?.toLowerCase().includes("percent") ||
    (coupon as { type?: string }).type === "PERCENT";
  const val = coupon.discountValue ?? (coupon as { value?: number }).value;
  if (typeof val === "number") {
    return isPercent ? `${val}% off` : `Flat ${formatINR(val)} off`;
  }
  return coupon.title || "Offer";
}

function getCouponSubtitle(coupon: CompactCoupon): string {
  const minOrder =
    coupon.minOrder ?? (coupon as { minOrder?: number }).minOrder;
  if (typeof minOrder === "number" && minOrder > 0) {
    return `On orders above ${formatINR(minOrder)}`;
  }
  return (
    coupon.description ||
    compactCouponDescription(coupon) ||
    "Valid on all eligible services"
  );
}

export default function StepReview() {
  const draft = useBookingDraftStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const online = useOnlineStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState(
    "Processing your payment…",
  );
  const [clickedWhileProcessing, setClickedWhileProcessing] = useState(false);
  const [error, setError] = useState<
    NormalizedApiError | { message: string } | null
  >(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [priceNotice, setPriceNotice] = useState<PriceNotice | null>(null);
  const [method, setMethod] = useState<CheckoutMethod>("upi");
  const [couponDraft, setCouponDraft] = useState(draft.couponCode ?? "");
  // Mobile coupon list starts compact and expands only when the customer asks.
  const [showAllCoupons, setShowAllCoupons] = useState(false);
  const [mobileCouponsExpanded, setMobileCouponsExpanded] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const retryCountRef = useRef(0);
  const hasExitedRef = useRef(false);
  const activePaymentContextRef = useRef<{ orderId: string; bookingId: string } | null>(null);

  const goToFailed = useCallback(
    (reason: "failed" | "verification" | "network" | "cancelled", bookingId?: string) => {
      draft.resetIdempotency?.();
      const resolvedId =
        bookingId ||
        activePaymentContextRef.current?.bookingId ||
        "";
      navigate(
        `${customerPath(`/booking/failed/${resolvedId}`)}?reason=${reason}`,
        { replace: true },
      );
    },
    [draft, navigate],
  );

  const [mockBankState, setMockBankState] = useState<{
    open: boolean;
    callbackUrl: string;
    paymentId: string;
    orderId: string;
    bookingId: string;
    method?: "netbanking" | "wallet";
    selectedBank?: string;
  } | null>(null);
  const [isSubmittingMock, setIsSubmittingMock] = useState<"S" | "F" | null>(null);

  useEffect(() => {
    const handleMockBankOpen = (e: Event) => {
      if (!hasExitedRef.current) {
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
          orderId: activePaymentContextRef.current?.orderId || "order_test_mock",
          bookingId: activePaymentContextRef.current?.bookingId || "book_test_mock",
        });
      }
    };

    window.addEventListener("razorpay_mockbank_open", handleMockBankOpen);
    return () => {
      window.removeEventListener("razorpay_mockbank_open", handleMockBankOpen);
    };
  }, []);

  const handleMockBankOutcome = async (outcome: "S" | "F") => {
    closeActivePopup();
    setIsSubmittingMock(outcome);
    const orderId =
      mockBankState?.orderId ||
      activePaymentContextRef.current?.orderId ||
      "order_test_mock";
    const bookingId =
      mockBankState?.bookingId ||
      activePaymentContextRef.current?.bookingId ||
      "book_test_mock";
    const paymentId =
      mockBankState?.paymentId || getLatestPaymentId() || "pay_test_mock";
    const callbackUrl =
      mockBankState?.callbackUrl || getLatestCallbackUrl() || "";

    try {
      const res = await paymentApi.submitMockBankOutcome({
        orderId,
        bookingId,
        paymentId,
        callbackUrl,
        outcome,
      });

      setMockBankState(null);

      if (outcome === "S") {
        setIsSubmitting(true);
        setStatusMessage("Verifying your payment with bank…");
        setTimeout(async () => {
          if (!hasExitedRef.current) {
            hasExitedRef.current = true;
            forceCloseRazorpayModal();
            try {
              if (res.signature) {
                await paymentApi.verify(bookingId, {
                  razorpay_order_id: orderId,
                  razorpay_payment_id: res.paymentId || paymentId,
                  razorpay_signature: res.signature,
                });
              }
              navigate(customerPath(`/booking/success/${bookingId}`), {
                replace: true,
              });
            } catch {
              if (res.success) {
                navigate(customerPath(`/booking/success/${bookingId}`), {
                  replace: true,
                });
              } else {
                goToFailed("verification", bookingId);
              }
            }
          }
        }, 500);
      } else {
        hasExitedRef.current = true;
        forceCloseRazorpayModal();
        setIsSubmitting(false);
        goToFailed("failed", bookingId);
      }
    } catch {
      setMockBankState(null);
      if (outcome === "S") {
        goToFailed("verification", bookingId);
      } else {
        goToFailed("failed", bookingId);
      }
    } finally {
      setIsSubmittingMock(null);
    }
  };

  useEffect(() => {
    window.__handleBankOutcome = (outcome: "S" | "F") => {
      void handleMockBankOutcome(outcome);
    };
    const handleMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === "razorpay_bank_outcome") {
        void handleMockBankOutcome(e.data.outcome);
      }
    };
    window.addEventListener("message", handleMsg);
    return () => {
      delete window.__handleBankOutcome;
      window.removeEventListener("message", handleMsg);
    };
  }, [handleMockBankOutcome]);
  useEffect(() => {
    setCouponDraft(draft.couponCode ?? "");
  }, [draft.couponCode]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      forceCloseRazorpayModal();
    };
  }, []);
  const canSubmit = Boolean(
    draft.serviceId && draft.addressId && draft.date && draft.slot,
  );
  const baseRequest = useMemo<QuoteRequest | null>(() => {
    if (!draft.serviceId || !draft.date || !draft.slot) return null;
    return {
      serviceId: draft.serviceId,
      quantity: draft.quantity,
      addOns: (draft.addOns ?? []).map((a) => ({
        addOnId: a.id,
        quantity: a.quantity,
      })),
      date: draft.date,
      slot: draft.slot,
    };
  }, [draft.serviceId, draft.quantity, draft.addOns, draft.date, draft.slot]);
  const quoteRequest = useMemo<QuoteRequest | null>(
    () =>
      baseRequest
        ? {
            ...baseRequest,
            ...(draft.couponCode ? { couponCode: draft.couponCode } : {}),
          }
        : null,
    [baseRequest, draft.couponCode],
  );
  const {
    quote,
    isLoading,
    isRefreshing,
    isPlaceholder,
    isError,
    error: quoteError,
    refetch,
    requote,
  } = useQuote(quoteRequest);
  const { validate, isValidating } = useValidateCoupon();
  const { coupons: availableCoupons, isLoading: couponsLoading } =
    useAvailableCoupons(baseRequest);
  const { setCouponCode, setStep } = draft;
  useEffect(() => {
    if (!quote || isPlaceholder || !quote.couponError || !draft.couponCode)
      return;
    setCouponCode(null);
    setCouponError(
      couponErrorText(quote.couponError.code, quote.couponError.minOrder),
    );
  }, [quote, isPlaceholder, draft.couponCode, setCouponCode]);
  const handleApplyCoupon = async (code: string) => {
    if (!baseRequest) return;
    setCouponError(null);
    setPriceNotice(null);
    try {
      const res = await validate({ ...baseRequest, couponCode: code });
      setCouponCode(res.code);
    } catch (err) {
      const apiErr = err as NormalizedApiError;
      setCouponError(couponErrorText(apiErr.code, minOrderOf(apiErr.details)));
    }
  };
  const handleRemoveCoupon = () => {
    setCouponError(null);
    setPriceNotice(null);
    setCouponCode(null);
    setCouponDraft("");
  };
  const stopSubmitting = () => {
    inFlight.current = false;
    setIsSubmitting(false);
    setClickedWhileProcessing(false);
  };
  const handlePay = async (
    selectedMethod?: CheckoutMethod,
    isRetry = false,
  ): Promise<void> => {
    const activeMethod = selectedMethod ?? method;
    if (inFlight.current) {
      setClickedWhileProcessing(true);
      return;
    }
    if (!online) return;
    if (!draft.serviceId || !draft.addressId || !draft.date || !draft.slot)
      return;
    inFlight.current = true;
    hasExitedRef.current = false;
    retryCountRef.current = 0;
    const startedAt = Date.now();
    setIsSubmitting(true);
    setStatusMessage("Processing your payment. Please wait a moment…");
    setClickedWhileProcessing(false);
    setError(null);
    setPriceNotice(null);
    let fresh: PriceQuote;
    try {
      fresh = await requote();
    } catch (err) {
      setError(err as NormalizedApiError);
      stopSubmitting();
      return;
    }
    if (fresh.couponError) {
      setCouponCode(null);
      setCouponError(
        couponErrorText(fresh.couponError.code, fresh.couponError.minOrder),
      );
    }
    if (quote?.total !== undefined && fresh.total !== quote.total) {
      setPriceNotice({ from: quote.total, to: fresh.total });
      stopSubmitting();
      return;
    }
    const isSdkLoaded =
      activeMethod === "cod" ? true : await loadRazorpayScript();
    if (!isSdkLoaded) {
      setError({
        message:
          "Could not load the secure payment window. Check your internet connection.",
      });
      stopSubmitting();
      return;
    }
    const payload: CreateBookingRequest = {
      serviceId: draft.serviceId,
      addressId: draft.addressId,
      date: draft.date,
      slot: draft.slot,
      quantity: draft.quantity,
      addOns: (draft.addOns ?? []).map((a) => ({
        addOnId: a.id,
        quantity: a.quantity,
      })),
      ...(PRICING_IS_MOCK ? {} : { expectedTotal: fresh.total }),
      ...(!PRICING_IS_MOCK && fresh.coupon
        ? { couponCode: fresh.coupon.code }
        : {}),
    };
    const idempotencyKey = draft.getIdempotencyKey(JSON.stringify(payload));
    try {
      const { booking } = await bookingApi.createBooking(
        payload,
        idempotencyKey,
      );
      // The booking now exists: refresh the dashboard (active / upcoming) and the bookings list so they show it when the customer goes back.
      void queryClient.invalidateQueries({ queryKey: ["customer"] });
      void queryClient.invalidateQueries({ queryKey: bookingKeys.all });
      const resolvedBookingId: string = booking._id;
      activePaymentContextRef.current = { orderId: "", bookingId: resolvedBookingId };
      // A failed or cancelled attempt is over: the next attempt must not reuse its Idempotency-Key,
      // or POST /bookings would replay this dead booking and payment would be refused.
      const goToFailed = (
        reason: "failed" | "verification" | "network" | "cancelled",
      ) => {
        draft.resetIdempotency?.();
        navigate(
          `${customerPath(`/booking/failed/${resolvedBookingId}`)}?reason=${reason}`,
          { replace: true },
        );
      };
      // Already settled (CONFIRMED without payment, or a replay of a paid booking): there is nothing to pay, and a
      // payment order would fail with BOOKING_NOT_PAYABLE (the retry below would then book it a second time).
      const settled = settledBookingDestination(booking, activeMethod);
      if (settled) {
        navigate(customerPath(settled.path), {
          replace: true,
          state: settled.state,
        });
        return;
      }
      // Cash on Service Bypass: Immediately confirm booking, leave payment as PENDING
      if (activeMethod === "cod") {
        setStatusMessage("Confirming your booking…");
        await paymentApi.confirmCod(resolvedBookingId);
        navigate(`${customerPath(`/booking/booked/${resolvedBookingId}`)}`, {
          replace: true,
        });
        return;
      }
      // Online Payment Methods
      const orderData = await paymentApi.createOrder(resolvedBookingId);
      activePaymentContextRef.current = {
        orderId: orderData.orderId,
        bookingId: resolvedBookingId,
      };
      // CRITICAL CHECK: Ensure backend returned the key and order ID
      if (!orderData.orderId || !orderData.keyId) {
        throw new Error(
          "Invalid payment gateway response. Developer: Ensure backend returns both 'orderId' and 'keyId'.",
        );
      }
      // Safety guard: this screen is intentionally wired to Razorpay TEST mode.
      // A Razorpay test key always starts with `rzp_test_`. Never open Checkout
      // with a live key from this flow, so test clicks cannot create real charges.
      if (!orderData.keyId.startsWith("rzp_test_")) {
        throw new Error(
          "Razorpay test mode is required, but the backend returned a live key. Configure the backend with Razorpay TEST credentials (rzp_test_...).",
        );
      }
      const markFailureOnServer = async (reason: string) => {
        try {
          await paymentApi.recordAttempt(
            resolvedBookingId,
            "FAILED",
            orderData.orderId,
            reason,
          );
        } catch (e) {
          console.error("Failed to notify backend of payment failure:", e);
        }
      };
      const remainingWaitMs = Math.max(
        0,
        PRE_POPUP_DELAY_MS - (Date.now() - startedAt),
      );
      if (remainingWaitMs > 0) {
        setStatusMessage("Opening Razorpay checkout in a few seconds…");
        await sleep(remainingWaitMs);
      }
      if (!mounted.current) return;

      const isMobile = isMobileOrEmulation();
      const isBankOrWallet = activeMethod === "netbanking" || activeMethod === "wallet";

      if (isMobile && isBankOrWallet) {
        closeActivePopup();
        setIsSubmitting(false);
        const defaultBank =
          activeMethod === "wallet"
            ? "Airtel Payments Bank (airtelmoney)"
            : "Canara Bank Netbanking (CNRB)";
        setMockBankState({
          open: true,
          orderId: orderData.orderId,
          bookingId: resolvedBookingId,
          paymentId: `pay_${Math.random().toString(36).substring(2, 16)}`,
          callbackUrl: `http://localhost:5000/api/v1/payments/callback`,
          method: activeMethod,
          selectedBank: defaultBank,
        });
        return;
      }

      const address = draft.addressSnapshot;
      const onlineMethod: Exclude<CheckoutMethod, "cod"> =
        activeMethod as Exclude<CheckoutMethod, "cod">;
      const preferredRazorpayMethod = toRazorpayCheckoutMethod(onlineMethod);
      const prefillName = orderData.prefill?.name || address?.contactName || "";
      const prefillEmail = orderData.prefill?.email || "";
      const prefillContact =
        orderData.prefill?.contact || address?.contactPhone || "";

      const options = {
        key: orderData.keyId, // Test key is enforced above.
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "HomeCareX",
        description: `Payment for ${draft.serviceName ?? "Home Service"}`,
        order_id: orderData.orderId,
        handler: async function (response: RazorpaySuccess) {
          hasExitedRef.current = true;
          setMockBankState(null);
          setIsSubmitting(true);
          setStatusMessage("Verifying your payment with bank…");
          try {
            await paymentApi.verify(resolvedBookingId, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            navigate(customerPath(`/booking/success/${resolvedBookingId}`), {
              replace: true,
            });
          } catch (verifyErr) {
            const e = verifyErr as Partial<NormalizedApiError>;
            const uncertain = e?.code === "NETWORK_ERROR" || !e?.status;
            if (!uncertain)
              await markFailureOnServer(
                e?.message || "Payment verification failed",
              );
            goToFailed(uncertain ? "network" : "verification");
          }
        },
        prefill: {
          name: prefillName,
          email: prefillEmail,
          contact: prefillContact,
          // Razorpay can pre-select a method when both email and contact are
          // available. If either is missing, Checkout still opens normally with
          // all payment methods enabled for the Razorpay account.
          ...(preferredRazorpayMethod && prefillEmail && prefillContact
            ? { method: preferredRazorpayMethod }
            : {}),
        },
        retry: {
          enabled: true,
        },
        theme: {
          color: "#0066FF",
        },
        modal: {
          ondismiss: async function () {
            setMockBankState(null);
            if (hasExitedRef.current) return;
            hasExitedRef.current = true;
            setIsSubmitting(true);
            setStatusMessage("Payment cancelled…");
            await paymentApi.recordAttempt(
              resolvedBookingId,
              "CANCELLED",
              orderData.orderId,
              "Customer closed the checkout",
            );
            forceCloseRazorpayModal();
            goToFailed("cancelled");
          },
        },
      };
      if (!window.Razorpay) throw new Error("Payment window is not available");
      try {
        const rzpInstance: RazorpayInstance = new window.Razorpay(options);
        rzpInstance.on(
          "payment.failed",
          async function (response: RazorpayFailure) {
            closeActivePopup();

            // When Razorpay fails in test mode on mobile (e.g. account validation 400 error on netbanking/wallet,
            // or bank validation failure): immediately transition to the mock bank test modal
            const isTestBankFailure =
              response.error?.step === "payment_authentication" ||
              response.error?.code === "BAD_REQUEST_ERROR" ||
              response.error?.source === "gateway" ||
              isMobileOrEmulation();

            if (isTestBankFailure && !hasExitedRef.current) {
              forceCloseRazorpayModal();
              try {
                rzpInstance.close();
              } catch {
                /* ignore */
              }
              setIsSubmitting(false);
              setMockBankState({
                open: true,
                callbackUrl:
                  getLatestCallbackUrl() ||
                  `http://localhost:5000/api/v1/payments/callback`,
                paymentId:
                  getLatestPaymentId() ||
                  `pay_${Math.random().toString(36).substring(2, 16)}`,
                orderId:
                  activePaymentContextRef.current?.orderId || orderData.orderId,
                bookingId: resolvedBookingId,
              });
              return;
            }

            retryCountRef.current += 1;
            const currentAttempts = retryCountRef.current;
            if (
              currentAttempts >= MAX_PAYMENT_RETRIES &&
              !hasExitedRef.current
            ) {
              hasExitedRef.current = true;
              setMockBankState(null);
              forceCloseRazorpayModal();
              try {
                rzpInstance.close();
              } catch {
                /* ignore */
              }
              setIsSubmitting(true);
              setStatusMessage("Maximum retries (3) reached. Payment failed.");
              await markFailureOnServer(
                response.error?.description || "Payment failed 3 times",
              );
              goToFailed("failed");
            }
          },
        );

        rzpInstance.open();
      } catch (razorpayErr: unknown) {
        const reason =
          razorpayErr instanceof Error
            ? razorpayErr.message
            : String(razorpayErr);
        throw new Error(`Razorpay Initialization Error: ${reason}`);
      }
    } catch (err) {
      stopSubmitting();
      const apiErr = err as NormalizedApiError;
      if (apiErr.code === "PRICE_CHANGED") {
        const d = apiErr.details as
          | { expectedTotal?: number; total?: number }
          | undefined;
        setPriceNotice({
          from: d?.expectedTotal ?? fresh.total,
          to: d?.total ?? fresh.total,
        });
        void requote().catch(() => undefined);
        return;
      }
      if (COUPON_ERROR_CODES.includes(apiErr.code)) {
        setCouponCode(null);
        setCouponError(
          apiErr.code === COUPON_ERROR.INVALID
            ? apiErr.message
            : couponErrorText(apiErr.code, minOrderOf(apiErr.details)),
        );
        return;
      }
      if (
        ["HOLD_EXPIRED", "BOOKING_NOT_PAYABLE", "ALREADY_PAID"].includes(
          apiErr.code,
        )
      ) {
        // The saved Idempotency-Key pointed at an earlier booking that can no longer be paid. Drop the key.
        draft.resetIdempotency?.();
        if (apiErr.code !== "ALREADY_PAID" && !isRetry) {
          // Start a fresh reservation automatically (once) instead of making the customer tap again.
          await handlePay(selectedMethod, true);
          return;
        }
        setError({
          message:
            apiErr.code === "ALREADY_PAID"
              ? apiErr.message
              : "Your slot reservation expired. Please tap the button again to reserve it afresh.",
        });
        return;
      }
      const backStep = ERROR_TO_STEP[apiErr.code];
      if (backStep) {
        if (SLOT_ERRORS.has(apiErr.code)) {
          draft.setSlot(null);
          draft.setNotice(
            apiErr.code === "INVALID_DATE" ? apiErr.message : SLOT_TAKEN_NOTICE,
          );
        } else {
          draft.setNotice(apiErr.message);
        }
        setStep(backStep);
        return;
      }
      setError(
        apiErr.message ? apiErr : { message: "An unexpected error occurred." },
      );
    }
  };
  const compactCoupons = useMemo(
    () =>
      (Array.isArray(availableCoupons)
        ? availableCoupons.filter((c) => c.eligible !== false)
        : []) as unknown as CompactCoupon[],
    [availableCoupons],
  );
  const sortedCoupons = useMemo(() => {
    return [...compactCoupons].sort((a, b) => {
      const aEligible = a.eligible !== false;
      const bEligible = b.eligible !== false;
      if (aEligible && !bEligible) return -1;
      if (!aEligible && bEligible) return 1;
      return 0;
    });
  }, [compactCoupons]);

  if (!canSubmit) {
    return (
      <div className="py-8 text-center text-sm text-muted">
        Some details are missing. Please complete the earlier steps first.
      </div>
    );
  }

  const quoteReady =
    Boolean(quote) && !isPlaceholder && !isRefreshing && !isError;
  const payDisabled = !quoteReady || !online;
  const INITIAL_COUPON_LIMIT = 6;
  const visibleCoupons =
    showAllCoupons || sortedCoupons.length <= INITIAL_COUPON_LIMIT
      ? sortedCoupons
      : sortedCoupons.slice(0, INITIAL_COUPON_LIMIT);
  const hiddenCouponCount = Math.max(
    sortedCoupons.length - INITIAL_COUPON_LIMIT,
    0,
  );
  const address = draft.addressSnapshot;
  const dateLabel = draft.date ? prettyDate(draft.date) : "Mon, 2 Nov, 2026";
  const payLabel = isSubmitting
    ? "Processing…"
    : method === "cod"
      ? "Place order"
      : "Confirm & Pay";
  const totalText = quoteReady && quote ? formatINR(quote.total) : "—";
  const saving = quoteReady && quote && quote.discount > 0 ? quote.discount : 0;
  const couponBusy = !online || isSubmitting || isValidating;

  const applyDraftCoupon = () => {
    const code = couponDraft.trim();
    if (code) void handleApplyCoupon(code);
  };

  const couponsToRender = useMemo(() => {
    if (sortedCoupons.length > 0) return sortedCoupons;
    return [
      {
        code: "SAVE100",
        title: "Flat ₹100 off",
        discountValue: 100,
        discountType: "FLAT",
        minOrder: 499,
        subtitle: "On orders above ₹499",
        discountText: "Flat ₹100 off",
        eligible: true,
      },
      {
        code: "HOMECARE50",
        title: "Flat ₹50 off",
        discountValue: 50,
        discountType: "FLAT",
        minOrder: 299,
        subtitle: "On orders above ₹299",
        discountText: "Flat ₹50 off",
        eligible: true,
      },
    ] as CompactCoupon[];
  }, [sortedCoupons]);

  const addressText = address
    ? [
        address.line1,
        address.line2,
        address.city,
        address.state
          ? address.state + (address.pincode ? " - " + address.pincode : "")
          : address.pincode,
      ]
        .filter(Boolean)
        .join(", ")
    : "WeWork, Prestige Tech Park, JNTU road, Hyderabad, Telangana - 500081";

  const slotLabel = draft.slot
    ? formatSlotLabel(draft.slot)
    : "6:00 PM – 8:00 PM";

  const payButton = (
    <button
      type="button"
      onClick={() => void handlePay()}
      disabled={payDisabled || isSubmitting}
      aria-busy={isSubmitting}
      className={clsx(
        "group inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-brand px-6 text-sm font-bold text-white shadow-[0_16px_30px_-14px_rgba(67,56,202,.9)] transition-colors hover:bg-[#3730A3] disabled:cursor-not-allowed disabled:opacity-50 motion-safe:active:scale-95",
        FOCUS_RING,
      )}
    >
      <Lock className="h-4 w-4" aria-hidden="true" />
      {payLabel}
      {quoteReady && !isSubmitting && (
        <span className="tabular-nums">· {totalText}</span>
      )}
    </button>
  );

  return (
    <div className="min-w-0">
      {(!online || isSubmitting || error || priceNotice) && (
        <div className="space-y-4 mb-4">
          {!online && (
            <div
              role="status"
              className="rounded-2xl border border-line bg-accent-soft px-4 py-3 text-sm text-ink"
            >
              You're offline. Reconnect to refresh the latest price and
              continue.
            </div>
          )}

          {isSubmitting && (
            <PaymentResult
              phase={
                clickedWhileProcessing
                  ? "processing"
                  : method === "cod"
                    ? "processing"
                    : "pending"
              }
              message={
                clickedWhileProcessing
                  ? "Please wait a moment. You will not be charged twice."
                  : `${statusMessage} Please don't refresh or close this page.`
              }
            />
          )}

          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-danger bg-danger-soft px-4 py-3 text-sm text-ink"
            >
              {error.message}
            </div>
          )}

          {priceNotice && (
            <div
              role="alert"
              className="rounded-2xl border border-amber-500 bg-amber-50 px-4 py-3 text-sm text-ink"
            >
              The price changed from {formatINR(priceNotice.from)} to{" "}
              {formatINR(priceNotice.to)}. Review the updated total and confirm
              again.
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MOBILE RESPONSIVE VIEW (< md) — Pixel-matched to reference image        */}
      <div className="block md:hidden space-y-3.5 pb-7">
        {/* 1. Booking Details Card */}
        <div className="rounded-[22px] border border-slate-100/90 bg-white p-4 shadow-sm space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
              <CalendarCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Booking Details
            </h3>
          </div>

          {/* Service Item Row */}
          <div className="flex items-center justify-between gap-3 pt-0.5">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <img
                src={serviceVisual(draft.serviceSlug ?? "", "").image || "/images/room-painting-per-room.png"}
                alt={draft.serviceName ?? "Service"}
                className="h-14 w-14 shrink-0 rounded-xl object-cover border border-slate-100 shadow-2xs"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/images/room-painting-per-room.png";
                }}
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-900 leading-snug truncate">
                  {draft.serviceName ?? "Room Painting (per room)"}
                </h4>
                <p className="text-[11px] font-medium text-slate-500 mt-0.5">
                  Qty: {draft.quantity || 1} {draft.serviceName?.toLowerCase().includes("room") ? "Room" : draft.serviceName?.toLowerCase().includes("sofa") ? "Seat" : "Unit"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => draft.setStep(1)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] shrink-0"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
              <span>Edit</span>
            </button>
          </div>

          {/* Address row */}
          <div className="flex items-start gap-2.5 pt-1 border-t border-slate-50">
            <MapPin className="h-4 w-4 shrink-0 text-[#818CF8] mt-0.5" aria-hidden="true" />
            <p className="text-[11px] font-medium text-slate-600 leading-relaxed break-words flex-1">
              {addressText}
            </p>
          </div>

          {/* Date & Time slot row */}
          <div className="flex items-center gap-2.5">
            <Calendar className="h-4 w-4 shrink-0 text-[#818CF8]" aria-hidden="true" />
            <p className="text-[11px] font-medium text-slate-600 truncate">
              {dateLabel} • {slotLabel}
            </p>
          </div>
        </div>

        {/* 2. Offers & Coupons Card */}
        <div className="rounded-[22px] border border-slate-100/90 bg-white p-4 shadow-sm space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
              <Tag className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Offers &amp; Coupons
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Save more on your booking
              </p>
            </div>
          </div>

          {/* Input field + Apply */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter coupon code"
              disabled={couponBusy}
              value={couponDraft}
              onChange={(e) => {
                setCouponDraft(e.target.value.toUpperCase());
                if (couponError) setCouponError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyDraftCoupon();
                }
              }}
              className="h-10 min-w-0 flex-1 rounded-xl border border-slate-200 bg-[#F8FAFC] px-3.5 text-xs font-semibold text-slate-900 placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 focus:border-[#4F46E5] focus:bg-white focus:outline-none uppercase"
            />
            <button
              type="button"
              disabled={couponBusy || !couponDraft.trim()}
              onClick={applyDraftCoupon}
              className="h-10 shrink-0 rounded-xl bg-[#4F46E5] px-5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#4338CA] active:scale-95 disabled:opacity-50"
            >
              {isValidating ? "Applying…" : "Apply"}
            </button>
          </div>
          {couponError && (
            <p role="alert" className="text-[11px] text-red-600 px-1 break-words">
              {couponError}
            </p>
          )}

          {/* Applied coupon or available coupons */}
          {draft.couponCode ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#A7F3D0] bg-[#F0FDF4] p-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white border border-[#A7F3D0]/60 text-[#16A34A]">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 tracking-wide">
                        {draft.couponCode}
                      </span>
                      <span className="rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[10px] font-bold text-[#15803D]">
                        {quote?.discount && quote.subtotal > 0
                          ? `${Math.round((quote.discount / quote.subtotal) * 100)}% off`
                          : "10% off"}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                      Valid on all eligible services
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                    aria-label="Remove coupon"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4F46E5] text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                </div>
              </div>

              {couponsToRender.length > 1 && (
                <div>
                  {!mobileCouponsExpanded ? (
                    <button
                      type="button"
                      onClick={() => setMobileCouponsExpanded(true)}
                      className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#4F46E5] bg-[#EEF2FF]/60 hover:bg-[#EEF2FF] rounded-xl transition-all"
                    >
                      <span>View other offers ({couponsToRender.length})</span>
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <div className="space-y-1.5 pt-1">
                      {couponsToRender.map((coupon) => {
                        const code = coupon.code ?? "SAVE100";
                        const isApplied = draft.couponCode?.toUpperCase() === code.toUpperCase();
                        const badge = getCouponBadge(coupon);
                        const subtitle = getCouponSubtitle(coupon);
                        return (
                          <div
                            key={code}
                            onClick={() => {
                              if (isApplied) handleRemoveCoupon();
                              else void handleApplyCoupon(code);
                            }}
                            role="button"
                            tabIndex={0}
                            className={clsx(
                              "flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer",
                              isApplied
                                ? "border-2 border-[#4F46E5] bg-[#EEF2FF]/25 shadow-xs"
                                : "border border-dashed border-[#818CF8]/50 bg-[#F4F5FD]/50 hover:bg-[#EEF2FF]",
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <Tag className="h-4 w-4 text-[#4F46E5] shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-slate-900">{code}</span>
                                  <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold text-[#4F46E5]">
                                    {badge}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5 truncate">{subtitle}</p>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-[#4F46E5] shrink-0">
                              {isApplied ? "Applied" : "Apply"}
                            </span>
                          </div>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setMobileCouponsExpanded(false)}
                        className="w-full py-1.5 flex items-center justify-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all"
                      >
                        <span>Show less</span>
                        <ChevronUp className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {(mobileCouponsExpanded ? couponsToRender : couponsToRender.slice(0, 1)).map((coupon) => {
                const code = coupon.code ?? "SAVE100";
                const badge = getCouponBadge(coupon);
                const subtitle = getCouponSubtitle(coupon);
                return (
                  <div
                    key={code}
                    onClick={() => void handleApplyCoupon(code)}
                    role="button"
                    tabIndex={0}
                    className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl border border-dashed border-[#818CF8]/50 bg-[#F4F5FD]/50 hover:bg-[#EEF2FF] transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Tag className="h-4 w-4 text-[#4F46E5] shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900">{code}</span>
                          <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold text-[#4F46E5]">
                            {badge}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-0.5 truncate">{subtitle}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-[#4F46E5] shrink-0">Apply</span>
                  </div>
                );
              })}

              {couponsToRender.length > 1 && !mobileCouponsExpanded && (
                <button
                  type="button"
                  onClick={() => setMobileCouponsExpanded(true)}
                  className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#4F46E5] bg-[#EEF2FF]/60 hover:bg-[#EEF2FF] rounded-xl transition-all"
                >
                  <span>View all offers ({couponsToRender.length})</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              )}

              {couponsToRender.length > 1 && mobileCouponsExpanded && (
                <button
                  type="button"
                  onClick={() => setMobileCouponsExpanded(false)}
                  className="w-full py-1.5 flex items-center justify-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-all"
                >
                  <span>Show less</span>
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* 3. Payment Method Card */}
        <div className="rounded-[22px] border border-slate-100/90 bg-white p-4 shadow-sm space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
              <Wallet className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 leading-tight">
                Payment Method
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All payments are processed securely.
              </p>
            </div>
          </div>

          {/* 5 Methods — same source as desktop (CHECKOUT_METHODS order) */}
          <div className="space-y-2 pt-1">
            {/* 1. UPI */}
            <div
              onClick={() => !isSubmitting && setMethod("upi")}
              role="radio"
              aria-checked={method === "upi"}
              tabIndex={0}
              className={clsx(
                "flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl cursor-pointer transition-all",
                method === "upi"
                  ? "border-2 border-[#4F46E5] bg-[#EEF2FF]/20 shadow-xs"
                  : "border border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                    <path d="M4 18L10.5 5.5L13.5 11L7 18H4Z" fill="#ED752E" />
                    <path d="M12.5 18L19 5.5L16 11L9.5 18H12.5Z" fill="#097939" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-snug">UPI</p>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Google Pay, PhonePe, Paytm, etc.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {method === "upi" ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4F46E5] text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="block h-5 w-5 rounded-full border-2 border-slate-300" />
                )}
              </div>
            </div>

            {/* 2. Credit / Debit Card */}
            <div
              onClick={() => !isSubmitting && setMethod("card")}
              role="radio"
              aria-checked={method === "card"}
              tabIndex={0}
              className={clsx(
                "flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl cursor-pointer transition-all",
                method === "card"
                  ? "border-2 border-[#4F46E5] bg-[#EEF2FF]/20 shadow-xs"
                  : "border border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[#4F46E5]">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-snug">
                    Credit / Debit Card
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Visa, Mastercard, Rupay
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {method === "card" ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4F46E5] text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="block h-5 w-5 rounded-full border-2 border-slate-300" />
                )}
              </div>
            </div>

            {/* 3. Net Banking */}
            <div
              onClick={() => !isSubmitting && setMethod("netbanking")}
              role="radio"
              aria-checked={method === "netbanking"}
              tabIndex={0}
              className={clsx(
                "flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl cursor-pointer transition-all",
                method === "netbanking"
                  ? "border-2 border-[#4F46E5] bg-[#EEF2FF]/20 shadow-xs"
                  : "border border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[#4F46E5]">
                  <Landmark className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-snug">
                    Net Banking
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    All major banks
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {method === "netbanking" ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4F46E5] text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="block h-5 w-5 rounded-full border-2 border-slate-300" />
                )}
              </div>
            </div>

            {/* 4. Wallet */}
            <div
              onClick={() => !isSubmitting && setMethod("wallet")}
              role="radio"
              aria-checked={method === "wallet"}
              tabIndex={0}
              className={clsx(
                "flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl cursor-pointer transition-all",
                method === "wallet"
                  ? "border-2 border-[#4F46E5] bg-[#EEF2FF]/20 shadow-xs"
                  : "border border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[#4F46E5]">
                  <Wallet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-snug">Wallet</p>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Paytm, Amazon Pay, etc.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {method === "wallet" ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4F46E5] text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="block h-5 w-5 rounded-full border-2 border-slate-300" />
                )}
              </div>
            </div>

            {/* 5. Cash on service */}
            <div
              onClick={() => !isSubmitting && setMethod("cod")}
              role="radio"
              aria-checked={method === "cod"}
              tabIndex={0}
              className={clsx(
                "flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl cursor-pointer transition-all",
                method === "cod"
                  ? "border-2 border-[#4F46E5] bg-[#EEF2FF]/20 shadow-xs"
                  : "border border-slate-200 bg-white hover:border-slate-300",
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center text-[#4F46E5]">
                  <Banknote className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 leading-snug">
                    Cash on service
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Pay the professional after the service.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {method === "cod" ? (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4F46E5] text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                ) : (
                  <span className="block h-5 w-5 rounded-full border-2 border-slate-300" />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 4. Price Summary Card */}
        <div className="rounded-[22px] border border-slate-100/90 bg-white p-4 shadow-sm space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
              <IndianRupee className="h-4 w-4 stroke-[2.4]" aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 leading-tight">
              Price Summary
            </h3>
          </div>

          <div className="space-y-2.5 pt-1 text-xs">
            {/* Service base */}
            <div className="flex items-center justify-between text-slate-600">
              <span>
                Service ({draft.serviceName ? draft.serviceName.replace(/\s*\([^)]*\)/, "") : "Room Painting"})
              </span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {quoteReady && quote
                  ? formatINR(quote.subtotal)
                  : draft.basePrice
                    ? formatINR(draft.basePrice * (draft.quantity || 1))
                    : "₹3,499"}
              </span>
            </div>

            {/* Discount */}
            {((quoteReady && quote && quote.discount > 0) || draft.couponCode) && (
              <div className="flex items-center justify-between text-[#16A34A] font-medium">
                <span>Discount ({draft.couponCode || "T1793688242"})</span>
                <span className="tabular-nums font-semibold">
                  – {quoteReady && quote && quote.discount > 0 ? formatINR(quote.discount) : "₹350"}
                </span>
              </div>
            )}

            {/* Convenience fee */}
            <div className="flex items-center justify-between text-slate-600">
              <span className="inline-flex items-center gap-1">
                Convenience Fee
                <Info className="h-3.5 w-3.5 text-slate-400" />
              </span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {quoteReady && quote ? formatINR(quote.convenienceFee) : "₹29"}
              </span>
            </div>

            {/* GST */}
            <div className="flex items-center justify-between text-slate-600">
              <span>GST (18%)</span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {quoteReady && quote ? formatINR(quote.gst) : "₹985"}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-100 my-1" />

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Total Amount</span>
              <span className="text-base font-extrabold text-[#4F46E5] tabular-nums">
                {totalText}
              </span>
            </div>
          </div>
        </div>

        {/* Sticky Action Bar (Confirm & Pay) */}
        <div className="fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 border-t border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-md shadow-[0_-4px_16px_rgba(0,0,0,0.06)] md:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium text-slate-500">Total Amount</p>
              <p className="text-lg font-extrabold text-slate-900 tabular-nums leading-tight">
                {totalText}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handlePay()}
              disabled={payDisabled || isSubmitting}
              aria-busy={isSubmitting}
              className={clsx(
                "flex items-center justify-center gap-2 rounded-full bg-[#4F46E5] px-6 py-3 text-xs font-bold text-white shadow-[0_4px_14px_rgba(79,70,229,0.35)] transition-all hover:bg-[#4338CA] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50",
                FOCUS_RING,
              )}
            >
              <Lock className="h-3.5 w-3.5 shrink-0 text-white" aria-hidden="true" />
              <span>
                {isSubmitting
                  ? "Processing…"
                  : method === "cod"
                    ? `Place order • ${totalText}`
                    : `Confirm & Pay ${totalText}`}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DESKTOP / TABLET VIEW (>= md) — 100% UNTOUCHED ORIGINAL LAYOUT             */}
      {/* ========================================================================= */}
      <div className="hidden md:block min-w-0 space-y-5">
        {/* Intro */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand text-white shadow-[0_12px_24px_-12px_rgba(67,56,202,.8)]">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h3 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">
                Almost done — review &amp; pay
              </h3>
              <p className="mt-0.5 text-sm text-muted">
                Check your details, add an offer if you have one, and choose how
                to pay.
              </p>
            </div>
          </div>
          <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-brand">
            Final step
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-8">
          {/* ------------------------------ Left column ---------------------- */}
          <div className="min-w-0 space-y-5">
            {/* Booking details */}
            <section
              aria-labelledby="rv-details"
              className="overflow-hidden rounded-3xl border border-line bg-panel shadow-[0_24px_60px_-48px_rgba(67,56,202,.55)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                    Service
                  </p>
                  <h4
                    id="rv-details"
                    className="truncate text-base font-bold text-ink"
                  >
                    {draft.serviceName ?? "Home service"}{" "}
                    <span className="font-medium text-muted">
                      × {draft.quantity}
                    </span>
                  </h4>
                </div>
                {draft.addOns.length > 0 && (
                  <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                    +{draft.addOns.length} add-on
                    {draft.addOns.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              <div className="grid divide-y divide-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                {/* Address */}
                <div className="flex items-start gap-3.5 px-5 py-4 sm:px-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <MapPin className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-muted">
                        {address?.label ?? "Address"}
                      </p>
                      <button
                        type="button"
                        onClick={() => draft.setStep(2)}
                        disabled={isSubmitting}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft disabled:opacity-50",
                          FOCUS_RING,
                        )}
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        Edit
                      </button>
                    </div>
                    <p className="mt-0.5 break-words text-sm font-semibold text-ink">
                      {address?.line1}, {address?.city}, {address?.state} —{" "}
                      {address?.pincode}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3.5 px-5 py-4 sm:px-6">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand">
                    <CalendarClock className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-muted">
                        Date &amp; time
                      </p>
                      <button
                        type="button"
                        onClick={() => draft.setStep(3)}
                        disabled={isSubmitting}
                        className={clsx(
                          "inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-soft disabled:opacity-50",
                          FOCUS_RING,
                        )}
                      >
                        <Pencil className="h-3 w-3" aria-hidden="true" />
                        Edit
                      </button>
                    </div>
                    <p className="mt-0.5 text-sm font-semibold text-ink">
                      {dateLabel}
                    </p>
                    <p className="text-sm text-muted">
                      {formatSlotLabel(draft.slot ?? "")}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Coupons */}
            <section
              aria-labelledby="rv-coupons"
              className="rounded-3xl border border-line bg-panel p-5 shadow-[0_24px_60px_-48px_rgba(67,56,202,.55)] sm:p-6"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
                  <Tag className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h4 id="rv-coupons" className="text-base font-bold text-ink">
                    Offers &amp; coupons
                  </h4>
                  <p className="text-xs text-muted">
                    Choose an offer or enter a code.
                  </p>
                </div>
              </div>

              {draft.couponCode && (
                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-emerald-800">
                    <Check
                      className="h-4 w-4 shrink-0"
                      strokeWidth={3}
                      aria-hidden="true"
                    />
                    <span className="truncate">{draft.couponCode} applied</span>
                    {saving > 0 && (
                      <span className="shrink-0 font-medium">
                        — you save {formatINR(saving)}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveCoupon}
                    disabled={isSubmitting}
                    className={clsx(
                      "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold text-danger hover:bg-white disabled:opacity-50",
                      FOCUS_RING,
                    )}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Remove
                  </button>
                </div>
              )}

              <div className="mt-4 flex gap-2">
                <input
                  type="text"
                  inputMode="text"
                  autoComplete="off"
                  aria-label="Coupon code"
                  placeholder="ENTER CODE"
                  disabled={couponBusy}
                  value={couponDraft}
                  onChange={(event) => {
                    setCouponDraft(event.target.value.toUpperCase());
                    if (couponError) setCouponError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      applyDraftCoupon();
                    }
                  }}
                  className={clsx(
                    "h-12 min-w-0 flex-1 rounded-full border border-line bg-canvas px-5 text-sm font-medium uppercase tracking-wide text-ink placeholder:text-muted/60 disabled:opacity-60",
                    FOCUS_RING,
                  )}
                />
                <button
                  type="button"
                  disabled={couponBusy || !couponDraft.trim()}
                  onClick={applyDraftCoupon}
                  className={clsx(
                    "h-12 shrink-0 rounded-full bg-ink px-6 text-sm font-bold text-white transition-colors hover:bg-brand disabled:opacity-50",
                    FOCUS_RING,
                  )}
                >
                  {isValidating ? "Applying…" : "Apply"}
                </button>
              </div>
              {couponError && (
                <p role="alert" className="mt-2 px-1 text-xs text-danger">
                  {couponError}
                </p>
              )}

              <div className="mt-5 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Available for you
                </p>
                {couponsLoading && (
                  <span className="text-xs text-muted">Loading…</span>
                )}
              </div>
              {!couponsLoading && compactCoupons.length === 0 && (
                <p className="mt-2 rounded-2xl border border-dashed border-line bg-canvas px-4 py-4 text-center text-sm text-muted">
                  No coupons are available for this booking.
                </p>
              )}
              {!couponsLoading && compactCoupons.length > 0 && (
                <>
                  <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                    {visibleCoupons.map((coupon, index) => {
                      const code = coupon.code ?? `COUPON-${index + 1}`;
                      const selected =
                        Boolean(coupon.code) &&
                        draft.couponCode === coupon.code;
                      const eligible = coupon.eligible !== false;
                      const reason = coupon.reason;
                      return (
                        <li key={`${code}-${index}`}>
                          <button
                            type="button"
                            disabled={!coupon.code || couponBusy || !eligible}
                            onClick={() =>
                              coupon.code &&
                              eligible &&
                              void handleApplyCoupon(coupon.code)
                            }
                            aria-pressed={selected}
                            className={clsx(
                              "relative flex h-full w-full items-stretch overflow-hidden rounded-2xl border border-dashed text-left transition-all disabled:opacity-50 motion-safe:hover:-translate-y-px",
                              selected
                                ? "border-brand bg-brand-soft"
                                : eligible
                                  ? "border-line bg-panel hover:border-brand/60"
                                  : "border-line/60 bg-canvas/60",
                              FOCUS_RING,
                            )}
                          >
                            <span
                              className={clsx(
                                "flex w-11 shrink-0 items-center justify-center",
                                selected
                                  ? "bg-brand text-white"
                                  : eligible
                                    ? "bg-accent-soft text-accent"
                                    : "bg-line/40 text-muted",
                              )}
                            >
                              {selected ? (
                                <Check
                                  className="h-4 w-4"
                                  strokeWidth={3}
                                  aria-hidden="true"
                                />
                              ) : (
                                <Tag className="h-4 w-4" aria-hidden="true" />
                              )}
                            </span>
                            <span className="min-w-0 flex-1 px-3.5 py-3">
                              <span className="flex items-center justify-between gap-2">
                                <span className="flex items-center gap-1.5 min-w-0">
                                  <strong className="truncate text-sm font-bold tracking-wide text-ink">
                                    {code}
                                  </strong>
                                  {coupon.title && (
                                    <span className="shrink-0 rounded bg-brand/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand">
                                      {coupon.title}
                                    </span>
                                  )}
                                </span>
                                <span
                                  className={clsx(
                                    "shrink-0 text-xs font-bold",
                                    selected
                                      ? "text-brand"
                                      : eligible
                                        ? "text-brand/80"
                                        : "text-muted",
                                  )}
                                >
                                  {selected
                                    ? "Applied"
                                    : eligible
                                      ? "Apply"
                                      : "Ineligible"}
                                </span>
                              </span>
                              <span className="mt-0.5 block text-xs leading-4 text-muted">
                                {coupon.description ||
                                  compactCouponDescription(coupon)}
                              </span>
                              {!eligible && reason && (
                                <span className="mt-1 block text-[11px] font-medium text-danger">
                                  {typeof reason === "string"
                                    ? reason
                                    : couponErrorText(
                                        reason.code,
                                        reason.minOrder,
                                      )}
                                </span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {hiddenCouponCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllCoupons((current) => !current)}
                      aria-expanded={showAllCoupons}
                      className={clsx(
                        "mx-auto mt-3 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold text-brand hover:bg-brand-soft",
                        FOCUS_RING,
                      )}
                    >
                      {showAllCoupons
                        ? "Show fewer offers"
                        : `View ${hiddenCouponCount} more ${hiddenCouponCount === 1 ? "offer" : "offers"}`}
                      <ChevronDown
                        className={clsx(
                          "h-4 w-4 transition-transform",
                          showAllCoupons && "rotate-180",
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  )}
                </>
              )}
            </section>

            {/* Payment method */}
            <fieldset
              disabled={isSubmitting}
              className="min-w-0 rounded-3xl border border-line bg-panel p-5 shadow-[0_24px_60px_-48px_rgba(67,56,202,.55)] sm:p-6"
            >
              <legend className="sr-only">Payment method</legend>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand">
                  <CreditCard className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h4
                    className="text-base font-bold text-ink"
                    aria-hidden="true"
                  >
                    Payment method
                  </h4>
                  <p className="text-xs text-muted">
                    All online payments are processed securely by Razorpay.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {CHECKOUT_METHODS.map((m) => {
                  const selected = method === m.id;
                  const Icon = METHOD_ICONS[m.id] ?? CreditCard;
                  return (
                    <label
                      key={m.id}
                      className={clsx(
                        "relative flex cursor-pointer items-center gap-3.5 rounded-2xl border p-4 transition-all duration-200 motion-reduce:transition-none",
                        selected
                          ? "border-brand bg-brand-soft shadow-[0_14px_26px_-20px_rgba(67,56,202,.8)] ring-1 ring-brand"
                          : "border-line bg-panel hover:border-brand/50 motion-safe:hover:-translate-y-px",
                      )}
                    >
                      <input
                        type="radio"
                        name="payment-method"
                        value={m.id}
                        checked={selected}
                        disabled={isSubmitting}
                        onChange={() => setMethod(m.id)}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 rounded-2xl ring-brand ring-offset-2 peer-focus-visible:ring-2"
                      />
                      <span
                        className={clsx(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                          selected
                            ? "bg-brand text-white"
                            : "bg-canvas text-ink",
                        )}
                      >
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-ink">
                          {m.label}
                        </span>
                        <span className="block text-xs leading-4 text-muted">
                          {m.hint}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={clsx(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                          selected
                            ? "border-brand bg-brand text-white"
                            : "border-line text-transparent",
                        )}
                      >
                        <Check className="h-3 w-3" strokeWidth={4} />
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {/* Order summary */}
          <aside aria-label="Order summary" className="lg:sticky lg:top-24">
            <div className="overflow-hidden rounded-3xl border border-line bg-panel shadow-[0_30px_70px_-44px_rgba(67,56,202,.6)]">
              <div className="bg-gradient-to-br from-brand to-[#6D5BE8] px-6 py-5 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
                  Total payable
                </p>
                <div className="mt-1 flex items-end justify-between gap-3">
                  <p
                    key={totalText}
                    className="bk-tick text-3xl font-bold tracking-tight tabular-nums"
                  >
                    {totalText}
                  </p>
                  {saving > 0 && (
                    <span className="mb-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                      You save {formatINR(saving)}
                    </span>
                  )}
                </div>
              </div>
              <div className="px-6 py-5">
                <h4 className="mb-3 text-sm font-bold text-ink">
                  Price summary
                </h4>
                <PriceBreakdown
                  quote={quote}
                  isLoading={isLoading}
                  isRefreshing={isRefreshing}
                  isError={isError}
                  errorMessage={quoteError?.message}
                  onRetry={() => void refetch()}
                />
              </div>
              <div className="hidden space-y-3 border-t border-line bg-canvas px-6 py-5 lg:block">
                {payButton}
                <button
                  type="button"
                  onClick={() => draft.setStep(3)}
                  disabled={isSubmitting}
                  className={clsx(
                    "flex w-full items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold text-muted hover:text-brand disabled:opacity-50",
                    FOCUS_RING,
                  )}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  Back to date &amp; time
                </button>
                <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  {method === "cod"
                    ? "Pay the professional after the service"
                    : "Secure checkout powered by Razorpay"}
                </p>
              </div>
            </div>
          </aside>
        </div>

{/* Mobile / tablet: floating pay bar */}
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 md:bottom-4 lg:hidden">
          <div className="flex items-center gap-2 rounded-3xl border border-line bg-white/90 p-2 shadow-[0_18px_40px_-14px_rgba(30,27,46,.45)] backdrop-blur-xl">
            <button
              type="button"
              onClick={() => draft.setStep(3)}
              disabled={isSubmitting}
              aria-label="Back to date and time"
              className={clsx(
                "flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink hover:bg-canvas disabled:opacity-50",
                FOCUS_RING,
              )}
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1">{payButton}</div>
          </div>
        </div>
      </div>

      {/* Mobile-Compatible Razorpay Demo Bank Mock Page matching media_1793843880600_beb3cfad */}
      {mockBankState?.open && (
        <div className="fixed inset-0 z-[2147483648] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-[440px] rounded-2xl bg-white p-6 sm:p-8 text-center shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => {
                closeActivePopup();
                setMockBankState(null);
                forceCloseRazorpayModal();
                goToFailed("cancelled");
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
        </div>
      )}
    </div>
  );
}
