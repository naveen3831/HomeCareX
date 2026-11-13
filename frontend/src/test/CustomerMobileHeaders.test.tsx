import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import TopBar from "@/components/customer/TopBar";
import { useUIStore } from "@/store/useUIStore";

vi.mock("@/components/customer/LocationPicker", () => ({
  default: () => <div data-testid="location-picker">Location</div>,
}));
vi.mock("@/components/customer/NotificationBell", () => ({
  default: () => <div data-testid="notification-bell">Bell</div>,
}));
vi.mock("@/hooks/useUnreadNotifications", () => ({
  useUnreadNotifications: () => 0,
}));

function renderTopBar(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <TopBar sidebarOpen={false} onToggleSidebar={() => undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Standardized Customer Dashboard Mobile Headers", () => {
  it("renders identical button styling and left alignment for Profile", () => {
    renderTopBar("/customer/profile");
    const button = screen.getByRole("button", { name: /back from profile/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass(
      "inline-flex",
      "min-h-[44px]",
      "items-center",
      "gap-1",
      "text-[15px]",
      "font-semibold",
      "text-ink",
    );
    expect(button).toHaveTextContent("Profile");
  });

  it("renders identical button styling and left alignment for My Bookings", () => {
    renderTopBar("/customer/bookings");
    const button = screen.getByRole("button", { name: /back from my bookings/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass(
      "inline-flex",
      "min-h-[44px]",
      "items-center",
      "gap-1",
      "text-[15px]",
      "font-semibold",
      "text-ink",
    );
    expect(button).toHaveTextContent("My Bookings");
  });

  it("renders identical button styling and left alignment for Active Bookings with Live badge", () => {
    useUIStore.setState({ activeBookingsCount: 2 });

    renderTopBar("/customer/tracking");
    const button = screen.getByRole("button", { name: /back from active bookings/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass(
      "inline-flex",
      "min-h-[44px]",
      "items-center",
      "gap-1",
      "text-[15px]",
      "font-semibold",
      "text-ink",
    );
    expect(button).toHaveTextContent("Active Bookings");

    // Green live badge should be present
    expect(screen.getByText("2 Live")).toBeInTheDocument();

    useUIStore.setState({ activeBookingsCount: null });
  });

  it("renders identical button styling and left alignment for Booking Details (not centered)", () => {
    renderTopBar("/customer/bookings/b-12345");
    const button = screen.getByRole("button", { name: /back from booking details/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass(
      "inline-flex",
      "min-h-[44px]",
      "items-center",
      "gap-1",
      "text-[15px]",
      "font-semibold",
      "text-ink",
    );
    expect(button).toHaveTextContent("Booking Details");
  });

  it("ensures mobile top bar is not hidden on bookings or booking details", () => {
    const { container: bookingsContainer } = renderTopBar("/customer/bookings");
    const headerBookings = bookingsContainer.querySelector("header.customer-topbar");
    expect(headerBookings).not.toHaveClass("hidden");

    const { container: detailsContainer } = renderTopBar("/customer/bookings/b-12345");
    const headerDetails = detailsContainer.querySelector("header.customer-topbar");
    expect(headerDetails).not.toHaveClass("hidden");
  });
});
