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

export function isRazorpayHealthy(): boolean {
  if (typeof window === "undefined" || !window.Razorpay) return false;
  const container = document.querySelector(".razorpay-container");
  if (container) {
    const iframe = container.querySelector("iframe");
    if (iframe && !iframe.contentWindow) {
      return false;
    }
  }
  return true;
}

export function loadRazorpayScript(forceReload = false): Promise<boolean> {
  if (!forceReload && isRazorpayHealthy()) {
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
    script.async = true;

    script.onload = () => resolve(Boolean(window.Razorpay));

    script.onerror = () => {
      try {
        script.remove();
      } catch {
        // ignore
      }
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
  if (typeof document === "undefined") return;

  // Hide rather than remove so Razorpay's in-memory checkout iframe retains its contentWindow
  document
    .querySelectorAll<HTMLElement>(".razorpay-container")
    .forEach((el) => {
      el.style.display = "none";
      el.style.removeProperty("z-index");
      el.style.removeProperty("pointer-events");
    });

  document
    .querySelectorAll<HTMLElement>(".razorpay-backdrop")
    .forEach((el) => {
      el.style.display = "none";
      el.style.removeProperty("display");
    });

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
        ".simulator, [class*='simulator'], [id*='simulator'], [data-simulator], [class*='device-frame'], [class*='phone-frame'], [class*='mobile'], [id*='mobile'], [data-device], [data-mobile], [class*='iphone'], [id*='iphone']",
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

export function resetRazorpayState(): void {
  latestCallbackUrl = "";
  latestPaymentId = "";
  closeActivePopup();
  forceCloseRazorpayModal();
  if (typeof window !== "undefined") {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (
          key &&
          (key.startsWith("rzp") || key.includes("razorpay")) &&
          !key.startsWith("booking_payment_attempts")
        ) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // ignore
    }
  }
}

function createFakePopup(): Window {
  let locHref = "about:blank";

  const dispatchMockBankFromUrl = (val: string) => {
    if (!val || val.startsWith("about:") || !isPaymentFlow()) return;
    try {
      const parsed = new URL(val, window.location.origin);
      const pId =
        parsed.searchParams.get("payment_id") ||
        val.match(/pay_[a-zA-Z0-9]+/)?.[0];
      const cb = parsed.searchParams.get("callback_url");
      if (pId) latestPaymentId = pId;
      if (cb) latestCallbackUrl = cb;
    } catch {
      // ignore
    }
    setTimeout(() => {
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
    }, 250);
  };

  const locObj = {
    get href() {
      return locHref;
    },
    set href(val: string) {
      locHref = val;
      dispatchMockBankFromUrl(val);
    },
    replace: (val: string) => {
      locHref = val;
      dispatchMockBankFromUrl(val);
    },
    assign: (val: string) => {
      locHref = val;
      dispatchMockBankFromUrl(val);
    },
    reload: () => {},
    toString: () => locHref,
  };

  const fake = {
    closed: false,
    name: "rzp_mock_popup",
    opener: window,
    parent: window,
    top: window,
    get location() {
      return locObj;
    },
    set location(val: unknown) {
      const str =
        typeof val === "string" ? val : (val as { href?: string })?.href || "";
      locObj.href = str;
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

export const isPaymentFlow = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.location.pathname.includes("/book") ||
    window.location.pathname.includes("/wallet") ||
    Boolean(document.querySelector("[data-testid='step-review']")) ||
    Boolean(document.querySelector("#add-money-title")) ||
    Boolean(document.querySelector(".razorpay-container, iframe[src*='razorpay']"))
  );
};

export const isBookingReviewPage = isPaymentFlow;

if (typeof window !== "undefined") {
  // Intercept window.alert to prevent blocking "This browser is not supported" alerts in mobile view
  const originalAlert = window.alert;
  window.alert = function (message?: unknown) {
    const msgStr = typeof message === "string" ? message : String(message ?? "");
    if (
      msgStr.includes("This browser is not supported") ||
      msgStr.includes("another browser")
    ) {
      console.warn("[Razorpay Interceptor] Suppressed unsupported browser alert:", msgStr);
      window.dispatchEvent(new CustomEvent("razorpay_unsupported_browser"));
      return;
    }
    return originalAlert.call(window, message);
  };

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
            const isBankMethod =
              data?.request?.content?.method === "netbanking" ||
              Boolean(data?.request?.content?.bank);
            if (cb && pId && isBankMethod && isPaymentFlow() && isMobileOrEmulation()) {
              setTimeout(() => {
                forceCloseRazorpayModal();
                closeActivePopup();
                window.dispatchEvent(
                  new CustomEvent("razorpay_mockbank_open", {
                    detail: { callbackUrl: cb, paymentId: pId },
                  }),
                );
              }, 400);
            }
          })
          .catch(() => {});
      }
    } catch {
      // ignore
    }
    return response;
  };

  // Intercept window.open for test mode mock bank / wallet flow
  const originalOpen = window.open;
  window.open = function (url?: string | URL, target?: string, features?: string) {
    const isMobile = isMobileOrEmulation();
    const urlStr = url ? String(url).trim() : "";
    const isRazorpayActive = Boolean(
      document.querySelector(".razorpay-container, iframe[src*='razorpay'], .razorpay-backdrop"),
    );

    const isBankRedirect =
      urlStr.includes("mocksharp") ||
      urlStr.includes("gateway") ||
      target === "wallet_frame" ||
      (urlStr.includes("razorpay") && (urlStr.includes("bank") || urlStr.includes("auth")));

    // Intercept mockbank only when Razorpay triggers an external test bank redirect/popup on mobile
    if ((isRazorpayActive || isPaymentFlow() || target === "wallet_frame") && isBankRedirect && isMobile) {
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
      return createFakePopup();
    }

    if (isRazorpayActive && isMobile && (urlStr === "about:blank" || !urlStr)) {
      const fake = createFakePopup();
      activePopup = fake;
      return fake;
    }

    // Standard flow: allow window.open normally
    const opened = originalOpen.call(window, url, target, features);
    if (opened) {
      activePopup = opened;
    } else if (
      (isRazorpayActive || isPaymentFlow() || target === "wallet_frame") &&
      isBankRedirect
    ) {
      // If popup was blocked by browser on desktop, fallback to in-app mock bank modal
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
      return createFakePopup();
    }
    return opened;
  };

  // Intercept form submission only for bank gateway redirect
  const originalSubmit = HTMLFormElement.prototype.submit;
  HTMLFormElement.prototype.submit = function () {
    const isMobile = isMobileOrEmulation();
    const action = this.getAttribute("action") || this.action || "";
    const isRazorpayActive = Boolean(
      document.querySelector(".razorpay-container, iframe[src*='razorpay']"),
    );

    const isBankGatewayForm =
      action.includes("mocksharp") ||
      action.includes("gateway") ||
      action.includes("bank") ||
      (action.includes("razorpay") && (action.includes("auth") || action.includes("mock") || action.includes("submit") || action.includes("create")));

    if (isRazorpayActive && isBankGatewayForm && isMobile) {
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
      forceCloseRazorpayModal();
      return;
    }
    return originalSubmit.call(this);
  };

  if (typeof HTMLFormElement.prototype.requestSubmit === "function") {
    const originalRequestSubmit = HTMLFormElement.prototype.requestSubmit;
    HTMLFormElement.prototype.requestSubmit = function (submitter) {
      const isMobile = isMobileOrEmulation();
      const action = this.getAttribute("action") || this.action || "";
      const isRazorpayActive = Boolean(
        document.querySelector(".razorpay-container, iframe[src*='razorpay']"),
      );

      const isBankGatewayForm =
        action.includes("mocksharp") ||
        action.includes("gateway") ||
        action.includes("bank") ||
        (action.includes("razorpay") && (action.includes("auth") || action.includes("mock") || action.includes("submit") || action.includes("create")));

      if (isRazorpayActive && isBankGatewayForm && isMobile) {
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
        forceCloseRazorpayModal();
        return;
      }
      return originalRequestSubmit.call(this, submitter);
    };
  }

  // Intercept anchor clicks with target="_blank" only for payment flow
  const originalAnchorClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (isPaymentFlow()) {
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

      const dataStr = typeof data === "object" ? JSON.stringify(data) : String(data);

      const pId = data?.payment_id || data?.paymentId || data?.data?.payment_id;
      const cb = data?.callback_url || data?.callbackUrl || data?.data?.callback_url;
      if (pId && typeof pId === "string") {
        latestPaymentId = pId;
      }
      if (cb && typeof cb === "string") {
        latestCallbackUrl = cb;
      }

      const isBankRedirectMessage =
        data?.event === "redirect" ||
        data?.topic === "redirect" ||
        data?.event === "payment.submit" ||
        dataStr.includes("mocksharp") ||
        dataStr.includes("open_bank_page") ||
        dataStr.includes("payment_authentication") ||
        (dataStr.includes("netbanking") && (dataStr.includes("mock") || dataStr.includes("gateway") || dataStr.includes("redirect") || dataStr.includes("submit"))) ||
        (dataStr.includes("wallet") && (dataStr.includes("mock") || dataStr.includes("gateway") || dataStr.includes("redirect") || dataStr.includes("submit")));

      if (isBankRedirectMessage && isPaymentFlow() && isMobileOrEmulation()) {
        const url = data?.data?.url || data?.url || "";
        if (url && typeof url === "string") {
          try {
            const parsed = new URL(url, window.location.origin);
            const pIdFromUrl =
              parsed.searchParams.get("payment_id") ||
              url.match(/pay_[a-zA-Z0-9]+/)?.[0];
            const cbFromUrl = parsed.searchParams.get("callback_url");
            if (pIdFromUrl) latestPaymentId = pIdFromUrl;
            if (cbFromUrl) latestCallbackUrl = cbFromUrl;
          } catch {
            // ignore
          }
        }

        setTimeout(() => {
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
        }, 300);
      }
    } catch {
      // ignore
    }
  });
}
