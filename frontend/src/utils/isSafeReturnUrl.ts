/**
 * Checks whether a returnUrl is safe to use for client-side navigation.
 *
 * Allowed:
 * - Same-origin absolute URLs
 * - Path-only URLs such as /customer/book/home-cleaning
 *
 * Rejected:
 * - External URLs
 * - Protocol-relative URLs such as //evil.com
 * - javascript:, data:, etc.
 * - URLs containing username/password credentials
 */
export const isSafeReturnUrl = (returnUrl: string): boolean => {
  if (typeof returnUrl !== "string") {
    return false;
  }

  const value = returnUrl.trim();

  if (!value) {
    return false;
  }

  // Reject backslashes anywhere in the path (e.g. /\evil.com, \evil.com, /\\)
  if (value.includes("\\") || value.includes("\r") || value.includes("\n") || value.includes("\0")) {
    return false;
  }

  // Reject protocol-relative URLs.
  if (value.startsWith("//")) {
    return false;
  }

  // Check scheme-based URLs (javascript:, data:, https:, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      const url = new URL(value);
      const isHttpProtocol = url.protocol === "http:" || url.protocol === "https:";
      const isSameOrigin = url.origin === window.location.origin;
      const hasCredentials = url.username.length > 0 || url.password.length > 0;

      return isHttpProtocol && isSameOrigin && !hasCredentials;
    } catch {
      return false;
    }
  }

  // Path-only return URLs are allowed.
  if (value.startsWith("/")) {
    return true;
  }

  return false;
};

import { ADMIN_ROLES, type UserRole } from "@/types/auth";

/**
 * Validates that a returnUrl is safe:
 * - Must pass isSafeReturnUrl (same-origin / path-only, no backslashes, no scheme attacks)
 * - Excludes security and logout paths to avoid redirect loops
 */
export function safeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (/\/security|\/logout/i.test(raw)) return null;
  return isSafeReturnUrl(raw) ? raw : null;
}

/**
 * Enforces role isolation: A returnUrl is only honoured when it belongs to the role's own area.
 * Prevents privilege escalation and cross-area redirection.
 */
export function destinationFor(
  user: { role: UserRole; home?: string },
  returnUrl: string | null | undefined
): string {
  const area = ADMIN_ROLES.includes(user.role) ? "/admin" : `/${user.role}`;
  if (returnUrl && (returnUrl === area || returnUrl.startsWith(`${area}/`))) {
    return returnUrl;
  }
  return user.home || area;
}

export default isSafeReturnUrl;