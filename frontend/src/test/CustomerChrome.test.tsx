import "@testing-library/jest-dom/vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/components/customer/LocationPicker", () => ({ default: () => <div data-testid="location-picker">Deliver to Home</div> }));
vi.mock("@/components/customer/NotificationBell", () => ({ default: () => <span data-testid="bell" /> }));
vi.mock("@/hooks/useUnreadNotifications", () => ({ useUnreadNotifications: () => 0 }));

const fetchMyBookingReviews = vi.fn();
vi.mock("@/services/reviewsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/reviewsApi")>();
  return { ...actual, fetchMyBookingReviews: (...a: unknown[]) => fetchMyBookingReviews(...a) };
});

import TopBar from "@/components/customer/TopBar";
import YourRating from "@/pages/customer/ServiceDetails/components/YourRating";

const wrap = (ui: React.ReactNode, at: string) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[at]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

describe("TopBar on inner pages", () => {
  it("shows '← Page name' at every width, with no address picker or brand", () => {
    wrap(<TopBar sidebarOpen onToggleSidebar={() => undefined} />, "/customer/bookings");
    expect(screen.getByRole("button", { name: /back from my bookings/i })).toBeInTheDocument();
    expect(screen.getByText("My Bookings")).toBeInTheDocument();
    expect(screen.queryByTestId("location-picker")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /homecarex/i })).not.toBeInTheDocument();
  });

  it("keeps the bell on md+ only, and the sidebar button when the sidebar is collapsed", () => {
    wrap(<TopBar sidebarOpen={false} onToggleSidebar={() => undefined} />, "/customer/wallet");
    expect(screen.getByTestId("bell").parentElement?.className).toMatch(/\bhidden\b.*md:block/);
    expect(screen.getByRole("button", { name: /open sidebar/i })).toBeInTheDocument();
  });
});

describe("TopBar on Home", () => {
  it("has no back arrow (address picker + bell show instead)", () => {
    wrap(<TopBar sidebarOpen onToggleSidebar={() => undefined} />, "/customer");
    expect(screen.queryByRole("button", { name: /^back from/i })).not.toBeInTheDocument();
    expect(screen.getByTestId("location-picker")).toBeInTheDocument();
    expect(screen.getByTestId("bell")).toBeInTheDocument();
  });
});

describe("YourRating on the service page", () => {
  beforeEach(() => fetchMyBookingReviews.mockReset());
  const mine = (serviceId: string, rating: number) => ({ id: "r", bookingId: "b", serviceId, serviceName: "X", partnerId: null, partnerName: null, rating, comment: "", tags: [], status: "approved", visible: true, verified: true, createdAt: "2026-10-01T00:00:00.000Z" });

  it("shows the rating the customer gave this service", async () => {
    fetchMyBookingReviews.mockResolvedValue([mine("other", 2), mine("s1", 5)]);
    wrap(<YourRating serviceId="s1" />, "/customer/services/x");
    expect(await screen.findByRole("link", { name: /you rated this 5\/5/i })).toHaveAttribute("href", "/customer/reviews?tab=mine");
  });

  it("shows nothing when they haven't rated this service", async () => {
    fetchMyBookingReviews.mockResolvedValue([mine("other", 3)]);
    wrap(<YourRating serviceId="s1" />, "/customer/services/x");
    await vi.waitFor(() => expect(fetchMyBookingReviews).toHaveBeenCalled());
    expect(screen.queryByText(/you rated/i)).not.toBeInTheDocument();
  });
});
