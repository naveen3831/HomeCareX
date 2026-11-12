import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import {
  ServiceCategoriesStrip,
  SERVICE_CATEGORIES,
  mapParamToCategoryId,
} from "@/components/customer/catalog/ServiceCategoriesStrip";

describe("ServiceCategoriesStrip", () => {
  it("renders the Categories heading and View All link", () => {
    render(
      <MemoryRouter>
        <ServiceCategoriesStrip selectedCategory="all" onSelectCategory={vi.fn()} />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: /categories/i })).toBeInTheDocument();
    const viewAllLink = screen.getByRole("link", { name: /view all/i });
    expect(viewAllLink).toBeInTheDocument();
    expect(viewAllLink).toHaveAttribute("href", "/customer/categories");
  });

  it("renders all 9 category items in order", () => {
    render(
      <MemoryRouter>
        <ServiceCategoriesStrip selectedCategory="all" onSelectCategory={vi.fn()} />
      </MemoryRouter>,
    );

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(9);

    const labels = [
      "All Services",
      "Home Cleaning",
      "Salon & Spa",
      "Appliance Repair",
      "Electrical & Plumbing",
      "Painting & Waterproofing",
      "Pest Control",
      "Carpentry & Furniture",
      "AC Service & Repair",
    ];

    labels.forEach((label, index) => {
      expect(tabs[index]).toHaveTextContent(label);
    });
  });

  it("applies active state styling to the selected category", () => {
    const { rerender } = render(
      <MemoryRouter>
        <ServiceCategoriesStrip selectedCategory="all" onSelectCategory={vi.fn()} />
      </MemoryRouter>,
    );

    const allTab = screen.getByRole("tab", { name: /all services/i });
    expect(allTab).toHaveAttribute("aria-selected", "true");
    expect(allTab.className).toContain("bg-[#EEF2FF]");

    const cleaningTab = screen.getByRole("tab", { name: /home cleaning/i });
    expect(cleaningTab).toHaveAttribute("aria-selected", "false");
    expect(cleaningTab.className).toContain("bg-white");

    // Rerender with 'cleaning' active
    rerender(
      <MemoryRouter>
        <ServiceCategoriesStrip selectedCategory="cleaning" onSelectCategory={vi.fn()} />
      </MemoryRouter>,
    );

    expect(allTab).toHaveAttribute("aria-selected", "false");
    expect(cleaningTab).toHaveAttribute("aria-selected", "true");
    expect(cleaningTab.className).toContain("bg-[#EEF2FF]");
  });

  it("calls onSelectCategory with the category id when clicked", async () => {
    const user = userEvent.setup();
    const onSelectCategory = vi.fn();

    render(
      <MemoryRouter>
        <ServiceCategoriesStrip selectedCategory="all" onSelectCategory={onSelectCategory} />
      </MemoryRouter>,
    );

    const pestTab = screen.getByRole("tab", { name: /pest control/i });
    await user.click(pestTab);
    expect(onSelectCategory).toHaveBeenCalledWith("pest-control");

    const acTab = screen.getByRole("tab", { name: /ac service & repair/i });
    await user.click(acTab);
    expect(onSelectCategory).toHaveBeenCalledWith("ac-repair");
  });

  it("correctly maps URL params to category IDs via mapParamToCategoryId", () => {
    expect(mapParamToCategoryId(undefined)).toBe("all");
    expect(mapParamToCategoryId("")).toBe("all");
    expect(mapParamToCategoryId("all")).toBe("all");
    expect(mapParamToCategoryId("home-cleaning")).toBe("cleaning");
    expect(mapParamToCategoryId("cleaning")).toBe("cleaning");
    expect(mapParamToCategoryId("salon-spa")).toBe("salon");
    expect(mapParamToCategoryId("appliance-repair-service")).toBe("appliance");
    expect(mapParamToCategoryId("electrical-plumbing")).toBe("electrical-plumbing");
    expect(mapParamToCategoryId("painting-waterproofing")).toBe("painting");
    expect(mapParamToCategoryId("pest-control")).toBe("pest-control");
    expect(mapParamToCategoryId("carpentry-furniture-assembly")).toBe("carpentry");
    expect(mapParamToCategoryId("ac-repair")).toBe("ac-repair");
    expect(mapParamToCategoryId("ac")).toBe("ac-repair");
  });
});
