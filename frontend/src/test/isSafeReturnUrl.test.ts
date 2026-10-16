import { describe, expect, it } from "vitest";
import { isSafeReturnUrl } from "@/utils/isSafeReturnUrl";

describe("isSafeReturnUrl", () => {
  it("allows path-only return URLs", () => {
    expect(isSafeReturnUrl("/customer/book/home-cleaning")).toBe(true);
    expect(isSafeReturnUrl("/services/home-cleaning")).toBe(true);
  });

  it("allows same-origin absolute URLs", () => {
    expect(
      isSafeReturnUrl(
        `${window.location.origin}/customer/book/home-cleaning`
      )
    ).toBe(true);
  });

  it("rejects external URLs", () => {
    expect(isSafeReturnUrl("https://evil.com")).toBe(false);
    expect(isSafeReturnUrl("http://evil.com")).toBe(false);
  });

  it("rejects protocol-relative URLs", () => {
    expect(isSafeReturnUrl("//evil.com")).toBe(false);
    expect(isSafeReturnUrl("//attacker.com/test")).toBe(false);
  });

  it("rejects backslash-based URL tricks", () => {
    expect(isSafeReturnUrl("/\\evil.com")).toBe(false);
    expect(isSafeReturnUrl("\\\\evil.com")).toBe(false);
    expect(isSafeReturnUrl("\\evil.com")).toBe(false);
    expect(isSafeReturnUrl("/customer\\test")).toBe(false);
  });

  it("rejects javascript URLs", () => {
    expect(isSafeReturnUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeReturnUrl("javascript:void(0)")).toBe(false);
  });

  it("rejects data URLs", () => {
    expect(isSafeReturnUrl("data:text/html,test")).toBe(false);
  });

  it("rejects empty values", () => {
    expect(isSafeReturnUrl("")).toBe(false);
    expect(isSafeReturnUrl("   ")).toBe(false);
  });
});

import { safeReturnUrl, destinationFor } from "@/utils/isSafeReturnUrl";

describe("safeReturnUrl", () => {
  it("allows safe relative paths", () => {
    expect(safeReturnUrl("/customer/book/home-cleaning")).toBe("/customer/book/home-cleaning");
    expect(safeReturnUrl("/admin/dashboard")).toBe("/admin/dashboard");
  });

  it("blocks null, undefined, empty strings", () => {
    expect(safeReturnUrl(null)).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
    expect(safeReturnUrl("")).toBeNull();
  });

  it("blocks security and logout paths to prevent redirect loops", () => {
    expect(safeReturnUrl("/customer/account/security")).toBeNull();
    expect(safeReturnUrl("/admin/settings/security")).toBeNull();
    expect(safeReturnUrl("/logout")).toBeNull();
    expect(safeReturnUrl("/customer/logout")).toBeNull();
  });

  it("blocks external and malicious URLs", () => {
    expect(safeReturnUrl("https://evil.com")).toBeNull();
    expect(safeReturnUrl("//evil.com")).toBeNull();
    expect(safeReturnUrl("/\\evil.com")).toBeNull();
    expect(safeReturnUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("destinationFor", () => {
  const customerUser = { role: "customer" as const, home: "/customer" };
  const partnerUser = { role: "partner" as const, home: "/partner" };
  const adminUser = { role: "admin" as const, home: "/admin" };

  it("allows returnUrl inside the user's role area", () => {
    expect(destinationFor(customerUser, "/customer/book/cleaning")).toBe("/customer/book/cleaning");
    expect(destinationFor(partnerUser, "/partner/jobs/123")).toBe("/partner/jobs/123");
    expect(destinationFor(adminUser, "/admin/customers/456")).toBe("/admin/customers/456");
  });

  it("prevents cross-role redirection and privilege escalation", () => {
    // Customer cannot be redirected to /admin or /partner
    expect(destinationFor(customerUser, "/admin/leads")).toBe("/customer");
    expect(destinationFor(customerUser, "/partner/dashboard")).toBe("/customer");

    // Partner cannot be redirected to /admin or /customer
    expect(destinationFor(partnerUser, "/admin/pricing")).toBe("/partner");
    expect(destinationFor(partnerUser, "/customer/book/cleaning")).toBe("/partner");

    // Admin cannot be redirected outside /admin
    expect(destinationFor(adminUser, "/customer/orders")).toBe("/admin");
  });

  it("falls back to user home or area when returnUrl is null or empty", () => {
    expect(destinationFor(customerUser, null)).toBe("/customer");
    expect(destinationFor(partnerUser, null)).toBe("/partner");
    expect(destinationFor(adminUser, undefined)).toBe("/admin");
  });
});