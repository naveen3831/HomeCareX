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

describe("TopBar on phones", () => {
  it("shows a borderless 'Home' back link on inner pages, and hides the address from phones", () => {
    wrap(<TopBar sidebarOpen onToggleSidebar={() => undefined} />, "/customer/bookings");
    const back = screen.getByRole("link", { name: /back to home/i });
    expect(back).toHaveAttribute("href", "/customer");
    expect(back.className).toMatch(/md:hidden/); // phones only
    expect(back.className).not.toMatch(/\bborder\b/); // no border
    // The address picker is still there for md+, but never shown on phones.
    expect(screen.getByTestId("location-picker").parentElement?.className).toMatch(/\bhidden\b.*md:block/);
  });

  it("has no back link on Home itself (the brand shows instead)", () => {
    wrap(<TopBar sidebarOpen onToggleSidebar={() => undefined} />, "/customer");
    expect(screen.queryByRole("link", { name: /back to home/i })).not.toBeInTheDocument();
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
