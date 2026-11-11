import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import Services from "@/pages/customer/Services";
import type { CatalogCategory, CatalogService } from "@/types/catalog";

const MOCK_CATEGORIES: CatalogCategory[] = [
  {
    id: "cat-1",
    name: "Home Cleaning",
    slug: "home-cleaning",
    description: "Cleaning services",
    icon: "sparkles",
    sortOrder: 1,
    serviceCount: 2,
    fromPrice: 599,
    popular: true,
  },
  {
    id: "cat-2",
    name: "Appliance Repair",
    slug: "appliance-repair-service",
    description: "Repair appliances",
    icon: "tool",
    sortOrder: 2,
    serviceCount: 2,
    fromPrice: 349,
    popular: false,
  },
  {
    id: "cat-3",
    name: "Carpentry & Furniture",
    slug: "carpentry-furniture-assembly",
    description: "Carpentry services",
    icon: "hammer",
    sortOrder: 3,
    serviceCount: 2,
    fromPrice: 299,
    popular: false,
  },
];

const MOCK_SERVICES: CatalogService[] = [
  {
    id: "s-1",
    slug: "deep-home-cleaning",
    name: "Deep Home Cleaning",
    description: "Top-to-bottom cleaning",
    icon: "sparkles",
    category: { id: "cat-1", name: "Home Cleaning", slug: "home-cleaning" },
    basePrice: 1499,
    durationMinutes: 180,
    rating: 4.8,
    ratingCount: 2140,
    availability: "tomorrow",
  },
  {
    id: "s-2",
    slug: "ac-service-gas-refill",
    name: "AC Service & Gas Refill",
    description: "Jet-wash service",
    icon: "wind",
    category: { id: "cat-2", name: "Appliance Repair", slug: "appliance-repair-service" },
    basePrice: 599,
    durationMinutes: 60,
    rating: 4.6,
    ratingCount: 3210,
    availability: "today",
  },
  {
    id: "s-3",
    slug: "shelf-curtain-rod-installation",
    name: "Shelf & Curtain Rod Installation",
    description: "Drill and fix shelves",
    icon: "hammer",
    category: { id: "cat-3", name: "Carpentry & Furniture", slug: "carpentry-furniture-assembly" },
    basePrice: 349,
    durationMinutes: 45,
    rating: 4.5,
    ratingCount: 330,
    availability: "today",
  },
];

vi.mock("@/hooks/useServices", () => ({
  useServices: (params: { category?: string; q?: string }) => {
    let items = [...MOCK_SERVICES];
    if (params.category) {
      const c = params.category.toLowerCase();
      if (c === "ac-repair" || c === "ac") {
        items = items.filter((s) => s.name.toLowerCase().includes("ac"));
      } else if (c.includes("clean")) {
        items = items.filter((s) => s.category.slug.includes("clean"));
      } else if (c.includes("carpent") || c.includes("furniture")) {
        items = items.filter((s) => s.category.slug.includes("carpent"));
      } else if (c.includes("appliance")) {
        items = items.filter((s) => s.category.slug.includes("appliance"));
      }
    }
    if (params.q) {
      const q = params.q.toLowerCase();
      items = items.filter((s) => s.name.toLowerCase().includes(q));
    }
    return {
      data: {
        items,
        meta: { page: 1, limit: 12, total: items.length, totalPages: 1 },
      },
      isPending: false,
      isError: false,
      error: null,
      isPlaceholderData: false,
      refetch: vi.fn(),
    };
  },
}));

vi.mock("@/hooks/useCategories", () => ({
  useCategories: () => ({
    data: MOCK_CATEGORIES,
    isPending: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

function renderWithClient(initialRoute = "/customer/services") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/customer/services" element={<Services />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>,
  );
}

describe("Customer Services Categories Integration", () => {
  it("renders the interactive category strip and all services on initial load", async () => {
    renderWithClient();

    // Check Categories section header
    expect(screen.getByRole("heading", { name: /^categories$/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all/i })).toHaveAttribute("href", "/customer/categories");

    // All Services tab is selected by default
    const allTab = screen.getByRole("tab", { name: /all services/i });
    expect(allTab).toHaveAttribute("aria-selected", "true");

    // All services are rendered in the grid
    expect(screen.getByText("Deep Home Cleaning")).toBeInTheDocument();
    expect(screen.getByText("AC Service & Gas Refill")).toBeInTheDocument();
    expect(screen.getByText("Shelf & Curtain Rod Installation")).toBeInTheDocument();
  });

  it("filters services when clicking a specific category card", async () => {
    const user = userEvent.setup();
    renderWithClient();

    const carpentryTab = screen.getByRole("tab", { name: /carpentry & furniture/i });
    await user.click(carpentryTab);

    // Carpentry tab becomes active
    await waitFor(() => {
      expect(carpentryTab).toHaveAttribute("aria-selected", "true");
    });

    // Only carpentry service is displayed
    expect(screen.getByText("Shelf & Curtain Rod Installation")).toBeInTheDocument();
    expect(screen.queryByText("Deep Home Cleaning")).not.toBeInTheDocument();
    expect(screen.queryByText("AC Service & Gas Refill")).not.toBeInTheDocument();
  });

  it("filters AC services specifically when clicking AC Service & Repair", async () => {
    const user = userEvent.setup();
    renderWithClient();

    const acTab = screen.getByRole("tab", { name: /ac service & repair/i });
    await user.click(acTab);

    await waitFor(() => {
      expect(acTab).toHaveAttribute("aria-selected", "true");
    });

    expect(screen.getByText("AC Service & Gas Refill")).toBeInTheDocument();
    expect(screen.queryByText("Deep Home Cleaning")).not.toBeInTheDocument();
    expect(screen.queryByText("Shelf & Curtain Rod Installation")).not.toBeInTheDocument();
  });

  it("shows clean EmptyState with 'Reset Filters' button when no services match, and resets on click", async () => {
    const user = userEvent.setup();
    renderWithClient("/customer/services?category=painting");

    // Painting category has no services in mock
    await waitFor(() => {
      expect(screen.getByText("No services match your search")).toBeInTheDocument();
    });

    const resetBtn = screen.getByRole("button", { name: /reset filters/i });
    expect(resetBtn).toBeInTheDocument();

    await user.click(resetBtn);

    // After reset, all services should return
    await waitFor(() => {
      expect(screen.getByText("Deep Home Cleaning")).toBeInTheDocument();
    });
  });
});
