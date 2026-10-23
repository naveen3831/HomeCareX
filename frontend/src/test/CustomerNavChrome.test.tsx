import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";

vi.mock("@/components/customer/LocationPicker", () => ({ default: () => <div>Deliver to Home</div> }));
vi.mock("@/components/customer/NotificationBell", () => ({ default: () => <span data-testid="bell" /> }));
vi.mock("@/hooks/useUnreadNotifications", () => ({ useUnreadNotifications: () => 0 }));

import TopBar from "@/components/customer/TopBar";
import BottomNav from "@/components/customer/BottomNav";
import { getCustomerPageMeta, isCustomerHome } from "@/components/customer/pageTitles";

function Where() {
  const { pathname } = useLocation();
  return <output data-testid="where">{pathname}</output>;
}

const renderAt = (ui: React.ReactNode, entries: string[], index = entries.length - 1) =>
  render(
    <MemoryRouter initialEntries={entries} initialIndex={index}>
      {ui}
      <Where />
    </MemoryRouter>,
  );

describe("pageTitles", () => {
  it("returns no meta for Home (trailing slash / case tolerant)", () => {
    expect(getCustomerPageMeta("/customer")).toBeNull();
    expect(getCustomerPageMeta("/customer/")).toBeNull();
    expect(isCustomerHome("/Customer")).toBe(true);
  });

  it("names the pages and gives each a parent", () => {
    expect(getCustomerPageMeta("/customer/categories")).toMatchObject({ title: "Categories", parent: "/customer" });
    expect(getCustomerPageMeta("/customer/services/deep-clean")).toMatchObject({ title: "Service details", parent: "/customer/services" });
    expect(getCustomerPageMeta("/customer/bookings/abc/track")).toMatchObject({ title: "Track booking", parent: "/customer/bookings" });
    expect(getCustomerPageMeta("/customer/profile/edit")).toMatchObject({ title: "Edit profile", parent: "/customer/profile" });
    expect(getCustomerPageMeta("/customer/wallet")).toMatchObject({ title: "Wallet", parent: "/customer/profile" });
    expect(getCustomerPageMeta("/customer/nope")).toMatchObject({ title: "Page not found", parent: "/customer" });
  });
});

describe("TopBar back arrow", () => {
  it("goes back through in-app history", async () => {
    renderAt(<TopBar sidebarOpen onToggleSidebar={() => undefined} />, ["/customer/categories", "/customer/services"]);
    await userEvent.click(screen.getByRole("button", { name: /back from services/i }));
    expect(screen.getByTestId("where")).toHaveTextContent("/customer/categories");
  });

  it("falls back to the parent page when the page was opened directly", async () => {
    renderAt(<TopBar sidebarOpen onToggleSidebar={() => undefined} />, ["/customer/wallet"]);
    await userEvent.click(screen.getByRole("button", { name: /back from wallet/i }));
    expect(screen.getByTestId("where")).toHaveTextContent("/customer/profile");
  });
});

describe("BottomNav highlighting", () => {
  const activeTabs = () => screen.queryAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page").map((l) => l.textContent);

  it.each([
    ["/customer", "Home"],
    ["/customer/categories", "Categories"],
    ["/customer/services", "Services"],
    ["/customer/bookings", "My Bookings"],
    ["/customer/profile", "Profile"],
    ["/customer/profile/", "Profile"],
  ])("lights only %s -> %s", (path, label) => {
    renderAt(<BottomNav />, [path]);
    expect(activeTabs()).toEqual([label]);
  });

  it.each([
    "/customer/services/deep-clean",
    "/customer/book/deep-clean",
    "/customer/bookings/123",
    "/customer/bookings/123/track",
    "/customer/tracking",
    "/customer/profile/edit",
    "/customer/addresses",
    "/customer/payments",
    "/customer/wallet",
    "/customer/reviews",
    "/customer/support",
    "/customer/referrals",
    "/customer/notifications",
  ])("lights no tab on %s", (path) => {
    renderAt(<BottomNav />, [path]);
    expect(activeTabs()).toEqual([]);
  });
});
