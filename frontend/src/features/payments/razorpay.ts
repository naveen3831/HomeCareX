import type { CheckoutMethod } from "@/types/payment";

/** Only the parts of Razorpay Checkout this app uses, so no `any` is needed. */
export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailure {
  error?: {
    code?: string;
    description?: string;
    source?: string;
    step?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  };
}

type RazorpayMethodFlags = Partial<
  Record<
    "upi" | "card" | "netbanking" | "wallet" | "emi" | "paylater",
    boolean
  >
>;

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  handler?: (response: RazorpaySuccess) => void;
  callback_url?: string;
  redirect?: boolean;
  target?: string;

  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
    method?: string;
  };

  notes?: Record<string, string>;

  theme?: {
    color?: string;
  };

  method?: RazorpayMethodFlags;

  retry?: {
    enabled?: boolean;
    max_count?: number;
  };

  modal?: {
    ondismiss?: () => void;
    backdropclose?: boolean;
    escape?: boolean;
    handleback?: boolean;
    confirm_close?: boolean;
  };
}

export interface RazorpayInstance {
  open(): void;
  close(): void;

  on(
    event: "payment.failed",
    callback: (response: RazorpayFailure) => void
  ): void;
}

declare global {
  interface Window {
    Razorpay?: new (
      options: RazorpayOptions
    ) => RazorpayInstance;
    __handleBankOutcome?: (outcome: "S" | "F") => void;
  }
}

const SCRIPT_ID = "razorpay-checkout-js";
const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window !== "undefined" && window.Razorpay) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    const existing = document.getElementById(SCRIPT_ID);

    if (existing) {
      existing.remove();
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;

    script.onload = () => resolve(Boolean(window.Razorpay));

    script.onerror = () => {
      script.remove();
      resolve(false);
    };

    document.body.appendChild(script);
  });
}

export function razorpayMethodOptions(
  method: Exclude<CheckoutMethod, "cod">
): RazorpayMethodFlags {
  return {
    upi: false,
    card: false,
    netbanking: false,
    wallet: false,
    emi: false,
    paylater: false,
    [method]: true,
  };
}

export function forceCloseRazorpayModal(): void {
  document
    .querySelectorAll(
      ".razorpay-container, iframe[src*='razorpay'], .razorpay-backdrop"
    )
    .forEach((el) => el.remove());

  document.body.style.overflow = "";
}

export const isMobileOrEmulation = (): boolean => {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      ua,
    );
  const isNarrowScreen = window.innerWidth <= 1024;
  const isTouch = (navigator.maxTouchPoints || 0) > 0;
  const isEmbedded = window.self !== window.top;
  const hasSimulator =
    typeof document !== "undefined" &&
    Boolean(
      document.querySelector(
        ".simulator, [class*='simulator'], [id*='simulator'], [data-simulator], [class*='device-frame'], [class*='phone-frame']",
      ),
    );
  return isMobileUA || isNarrowScreen || isTouch || isEmbedded || hasSimulator;
};

let latestCallbackUrl = "";
let latestPaymentId = "";

export function getLatestCallbackUrl(): string {
  return latestCallbackUrl;
}

export function getLatestPaymentId(): string {
  return latestPaymentId;
}

let activePopup: Window | null = null;

export function getActivePopup(): Window | null {
  return activePopup;
}

export function closeActivePopup(): void {
  if (activePopup && !activePopup.closed) {
    try {
      activePopup.close();
    } catch {
      // ignore
    }
  }
  activePopup = null;
}

function createFakePopup(): Window {
  const fake = {
    closed: false,
    name: "rzp_mock_popup",
    opener: window,
    parent: window,
    top: window,
    location: {
      href: "about:blank",
      replace: () => {},
      assign: () => {},
      reload: () => {},
    },
    document: {
      write: () => {},
      writeln: () => {},
      open: () => fake.document,
      close: () => {},
      createElement: (tag: string) => document.createElement(tag),
      body: {
        appendChild: () => {},
      },
    },
    close: () => {
      (fake as { closed: boolean }).closed = true;
    },
    focus: () => {},
    blur: () => {},
    postMessage: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
  } as unknown as Window;
  return fake;
}

const isBookingReviewPage = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.location.pathname.includes("/book") ||
    Boolean(document.querySelector("[data-testid='step-review']"))
  );
};

if (typeof window !== "undefined") {
  // Capture callback_url from Razorpay client ajax requests
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url =
        typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url;
      if (
        url &&
        typeof url === "string" &&
        url.includes("/payments/create/ajax")
      ) {
        const clone = response.clone();
        clone
          .json()
          .then((data) => {
            const cb = data?.request?.content?.callback_url;
            const pId = data?.payment_id;
            if (cb && typeof cb === "string") {
              latestCallbackUrl = cb;
            }
            if (pId && typeof pId === "string") {
              latestPaymentId = pId;
            }
            if (cb && pId && isBookingReviewPage() && isMobileOrEmulation()) {
              forceCloseRazorpayModal();
              closeActivePopup();
              window.dispatchEvent(
                new CustomEvent("razorpay_mockbank_open", {
                  detail: { callbackUrl: cb, paymentId: pId },
                }),
              );
            }
          })
          .catch(() => {});
      }
    } catch {
      // ignore
    }
    return response;
  };

  // Intercept window.open on mobile only for the StepReview booking mock bank flow
  const originalOpen = window.open;
  window.open = function (url?: string | URL, target?: string, features?: string) {
    const isMobile = isMobileOrEmulation();
    const urlStr = url ? String(url).trim() : "";
    const isRazorpayActive = Boolean(
      document.querySelector(".razorpay-container, iframe[src*='razorpay'], .razorpay-backdrop"),
    );

    const isBookingReview = isBookingReviewPage() || target === "wallet_frame";

    const isPaymentBankUrl =
      !urlStr ||
      urlStr === "about:blank" ||
      urlStr.startsWith("about:blank") ||
      urlStr.startsWith("javascript:") ||
      urlStr.includes("razorpay") ||
      urlStr.includes("mocksharp") ||
      urlStr.includes("gateway");

    // Only intercept and dispatch mockbank for the booking review page
    if (isBookingReview && (isPaymentBankUrl || (isMobile && isRazorpayActive))) {
      window.dispatchEvent(
        new CustomEvent("razorpay_mockbank_open", {
          detail: {
            callbackUrl: latestCallbackUrl,
            paymentId: latestPaymentId,
          },
        }),
      );
      closeActivePopup();
      forceCloseRazorpayModal();
      return isMobile ? createFakePopup() : null;
    }

    // Standard flow (e.g. Wallet top-up): allow window.open normally
    const opened = originalOpen.call(window, url, target, features);
    if (opened) {
      activePopup = opened;
    }
    return opened;
  };

  // Intercept form submission only for booking flow
  const originalSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () {
    const isMobile = isMobileOrEmulation();
    const action = this.getAttribute("action") || this.action || "";
    const target = this.getAttribute("target") || this.target || "";
    const isRazorpayActive = Boolean(
      document.querySelector(".razorpay-container, iframe[src*='razorpay']"),
    );

    const isBookingReview = isBookingReviewPage();

    const isPaymentForm =
      action.includes("mocksharp") ||
      action.includes("gateway") ||
      action.includes("razorpay") ||
      action.includes("payments") ||
      (isMobile && isRazorpayActive) ||
      (isMobile && target === "_blank" && (!action || action === "about:blank"));

    if (isBookingReview && isPaymentForm) {
      const callbackInput = this.querySelector(
        'input[name="callback_url"]',
      ) as HTMLInputElement | null;
      const paymentInput = this.querySelector(
        'input[name="payment_id"]',
      ) as HTMLInputElement | null;
      if (callbackInput?.value) {
        latestCallbackUrl = callbackInput.value;
      }
      if (paymentInput?.value) {
        latestPaymentId = paymentInput.value.startsWith("pay_")
          ? paymentInput.value
          : `pay_${paymentInput.value}`;
      }
      window.dispatchEvent(
        new CustomEvent("razorpay_mockbank_open", {
          detail: { callbackUrl: latestCallbackUrl, paymentId: latestPaymentId },
        }),
      );
      closeActivePopup();
      if (isMobile) {
        forceCloseRazorpayModal();
      }
      return;
    }
    return originalSubmit.call(this);
  };

  if (typeof HTMLFormElement.prototype.requestSubmit === "function") {
    const originalRequestSubmit = HTMLFormElement.prototype.requestSubmit;
    HTMLFormElement.prototype.requestSubmit = function (submitter) {
      const isMobile = isMobileOrEmulation();
      const action = this.getAttribute("action") || this.action || "";
      const target = this.getAttribute("target") || this.target || "";
      const isRazorpayActive = Boolean(
        document.querySelector(".razorpay-container, iframe[src*='razorpay']"),
      );

      const isBookingReview = isBookingReviewPage();

      const isPaymentForm =
        action.includes("mocksharp") ||
        action.includes("gateway") ||
        action.includes("razorpay") ||
        action.includes("payments") ||
        (isMobile && isRazorpayActive) ||
        (isMobile && target === "_blank" && (!action || action === "about:blank"));

      if (isBookingReview && isPaymentForm) {
        const callbackInput = this.querySelector(
          'input[name="callback_url"]',
        ) as HTMLInputElement | null;
        const paymentInput = this.querySelector(
          'input[name="payment_id"]',
        ) as HTMLInputElement | null;
        if (callbackInput?.value) {
          latestCallbackUrl = callbackInput.value;
        }
        if (paymentInput?.value) {
          latestPaymentId = paymentInput.value.startsWith("pay_")
            ? paymentInput.value
            : `pay_${paymentInput.value}`;
        }
        window.dispatchEvent(
          new CustomEvent("razorpay_mockbank_open", {
            detail: { callbackUrl: latestCallbackUrl, paymentId: latestPaymentId },
          }),
        );
        closeActivePopup();
        if (isMobile) {
          forceCloseRazorpayModal();
        }
        return;
      }
      return originalRequestSubmit.call(this, submitter);
    };
  }

  // Intercept anchor clicks with target="_blank" only for booking flow
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isBookingReviewPage() && isMobileOrEmulation()) {
      const target = this.getAttribute("target") || this.target || "";
      const href = this.getAttribute("href") || this.href || "";
      const isRazorpayActive = Boolean(
        document.querySelector(".razorpay-container, iframe[src*='razorpay']"),
      );
      if (
        (isRazorpayActive && (target === "_blank" || !href || href === "about:blank")) ||
        (target === "_blank" && (!href || href === "about:blank" || href.includes("razorpay") || href.includes("mocksharp") || href.includes("gateway")))
      ) {
        window.dispatchEvent(
          new CustomEvent("razorpay_mockbank_open", {
            detail: { callbackUrl: latestCallbackUrl, paymentId: latestPaymentId },
          }),
        );
        closeActivePopup();
        forceCloseRazorpayModal();
        return;
      }
    }
    return originalAnchorClick.call(this);
  };

  // Window message listener for Razorpay redirect and payment submit events
  window.addEventListener("message", (event) => {
    try {
      if (
        typeof event.origin === "string" &&
        !event.origin.includes("razorpay.com")
      ) {
        return;
      }
      const data =
        typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (!data) return;

      const isRedirectOrSubmit =
        data.event === "redirect" ||
        data.topic === "redirect" ||
        data.event === "redirect_to_page" ||
        data.event === "payment:submit" ||
        data.event === "payment.submit";

      if (isRedirectOrSubmit && isBookingReviewPage() && isMobileOrEmulation()) {
        forceCloseRazorpayModal();
        closeActivePopup();
        window.dispatchEvent(
          new CustomEvent("razorpay_mockbank_open", {
            detail: {
              callbackUrl: latestCallbackUrl,
              paymentId: latestPaymentId,
            },
          }),
        );
      }
    } catch {
      // ignore
    }
  });
}
