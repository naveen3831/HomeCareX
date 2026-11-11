import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import TermsPage from "@/pages/customer/Profile/TermsPage";

describe("TermsPage Scroll and Accordion Behavior", () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
  });

  it("scrolls to the very top (0, 0) upon opening the page", () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    );

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  });

  it("displays the header above 01 Introduction and does NOT automatically expand Section 1", () => {
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    );

    // Header content above Introduction is visible
    expect(screen.getAllByText("The rules for using HomeCareX.")).toHaveLength(2);
    expect(
      screen.getByText(/These Terms & Conditions govern your access to/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Last updated:/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /expand all/i })).toBeInTheDocument();

    // Section 1 header button is rendered
    const introButton = screen.getByRole("button", { name: /^introduction$/i });
    expect(introButton).toBeInTheDocument();
    expect(introButton).toHaveAttribute("aria-expanded", "false");

    // Section 1 body content is NOT automatically open
    expect(
      screen.queryByText(/HomeCareX reserves the right/i),
    ).not.toBeInTheDocument();
  });

  it("expands and collapses Section 1 on click", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TermsPage />
      </MemoryRouter>,
    );

    const introButton = screen.getByRole("button", { name: /^introduction$/i });
    expect(introButton).toHaveAttribute("aria-expanded", "false");

    // Click to open
    await user.click(introButton);
    expect(introButton).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(/HomeCareX reserves the right/i),
    ).toBeInTheDocument();

    // Click again to close
    await user.click(introButton);
    expect(introButton).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByText(/HomeCareX reserves the right/i),
    ).not.toBeInTheDocument();
  });
});
