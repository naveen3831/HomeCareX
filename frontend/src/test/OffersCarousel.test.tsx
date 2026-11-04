import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import OffersCarousel, { type Offer } from "@/pages/customer/Dashboard/sections/OffersCarousel";

describe("OffersCarousel - Refer & Earn Redesign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the redesigned referral card with 3D gift, sparkles, code, and copy button", () => {
    const offers: Offer[] = [
      {
        id: "referral-reward",
        title: "Refer a friend, earn ₹50",
        description: "Both of you get wallet credit on their first booking.",
        code: "HCXF087D2A9C1",
        accent: "brand",
        isReferral: true,
      },
    ];

    const { container } = render(<OffersCarousel offers={offers} />);

    // Check title and description
    expect(screen.getByText("Refer a friend, earn ₹50")).toBeInTheDocument();
    expect(
      screen.getByText("Both of you get wallet credit on their first booking.")
    ).toBeInTheDocument();

    // Check referral code in dashed container
    expect(screen.getByText("HCXF087D2A9C1")).toBeInTheDocument();

    // Check Copy button
    const copyButton = screen.getByRole("button", { name: /copy/i });
    expect(copyButton).toBeInTheDocument();

    // Check 3D images rendered (gift-green and sparkles-lavender)
    const images = Array.from(container.querySelectorAll("img"));
    const srcList = images.map((img) => img.getAttribute("src"));
    expect(srcList.some((s) => s?.includes("gift-green.png"))).toBe(true);
    expect(srcList.some((s) => s?.includes("sparkles-lavender.png"))).toBe(true);
  });

  it("copies code to clipboard and updates button state to 'Copied'", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });

    const offers: Offer[] = [
      {
        id: "referral-reward",
        title: "Refer a friend, earn ₹50",
        description: "Both of you get wallet credit on their first booking.",
        code: "HCXF087D2A9C1",
        accent: "brand",
        isReferral: true,
      },
    ];

    render(<OffersCarousel offers={offers} />);

    const copyButton = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyButton);

    expect(writeTextMock).toHaveBeenCalledWith("HCXF087D2A9C1");
    await waitFor(() => {
      expect(screen.getByText("Copied")).toBeInTheDocument();
    });
  });

  it("handles 3 offers on web view with equal height and no empty gap", () => {
    const offers: Offer[] = [
      {
        id: "c1",
        title: "Flat ₹100 off",
        description: "On orders above ₹499. Valid on all eligible services.",
        code: "SAVE100",
        accent: "brand",
        isReferral: false,
      },
      {
        id: "c2",
        title: "10% off",
        description: "10% off up to ₹300.",
        code: "WELCOME10",
        accent: "accent",
        isReferral: false,
      },
      {
        id: "referral-reward",
        title: "Refer a friend, earn ₹50",
        description: "Both of you get wallet credit on their first booking.",
        code: "HCXF087D2A9C1",
        accent: "brand",
        isReferral: true,
      },
    ];

    const { container } = render(<OffersCarousel offers={offers} />);

    // Container should use 3-column desktop grid with auto-rows-fr and items-stretch to keep cards even
    const carouselContainer = container.firstElementChild as HTMLElement;
    expect(carouselContainer.className).toContain("lg:grid-cols-3");
    expect(carouselContainer.className).toContain("md:items-stretch");
    expect(carouselContainer.className).toContain("md:auto-rows-fr");

    // Preserves mobile responsive horizontal scroll classes
    expect(carouselContainer.className).toContain("overflow-x-auto");
    expect(carouselContainer.className).toContain("snap-x");

    // All 3 cards should have equal height styling
    const cards = container.querySelectorAll(".dashboard-offer");
    expect(cards.length).toBe(3);
    cards.forEach((card) => {
      expect(card.className).toContain("md:h-full");
    });

    // 3rd card should span 2 columns on md (tablet) and 1 column on lg (desktop) to eliminate empty gaps
    expect(cards[2].className).toContain("md:col-span-2");
    expect(cards[2].className).toContain("lg:col-span-1");
  });
  it("handles 5 offers (4 coupons + 1 referral banner) on web view with complete data and full-width span", () => {
    const offers: Offer[] = [
      { id: "c1", title: "Flat ₹50 off", description: "On orders above ₹199.", code: "HOMECARE50", accent: "brand" },
      { id: "c2", title: "Flat ₹200 off", description: "On orders above ₹999.", code: "FLAT200", accent: "accent" },
      { id: "c3", title: "Flat ₹100 off", description: "On orders above ₹499.", code: "SAVE100", accent: "brand" },
      { id: "c4", title: "10% off", description: "10% off up to ₹300.", code: "WELCOME10", accent: "accent" },
      {
        id: "referral-reward",
        title: "Refer a friend, earn ₹50",
        description: "Both of you get wallet credit on their first booking.",
        code: "HCXF087D2A9C1",
        accent: "brand",
        isReferral: true,
      },
    ];

    const { container } = render(<OffersCarousel offers={offers} />);
    const carouselContainer = container.firstElementChild as HTMLElement;
    expect(carouselContainer.className).toContain("lg:grid-cols-4");

    const cards = container.querySelectorAll(".dashboard-offer");
    expect(cards.length).toBe(5);

    // Referral card (5th card) spans across the full row on web view
    expect(cards[4].className).toContain("md:col-span-2");
    expect(cards[4].className).toContain("lg:col-span-4");

    // All elements in referral card are present and complete
    expect(screen.getByText("Refer a friend, earn ₹50")).toBeInTheDocument();
    expect(screen.getByText("Both of you get wallet credit on their first booking.")).toBeInTheDocument();
    expect(screen.getByText("HCXF087D2A9C1")).toBeInTheDocument();

    const copyButtons = screen.getAllByRole("button", { name: /copy/i });
    expect(copyButtons.length).toBe(5);
    // Button has shrink-0 and whitespace-nowrap to prevent text clipping
    expect(copyButtons[4].className).toContain("shrink-0");
    expect(copyButtons[4].className).toContain("whitespace-nowrap");
  });
});