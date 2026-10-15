import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { MyReview, PendingReview } from "../services/reviewsApi";

const fetchPendingReviews = vi.fn();
const fetchMyBookingReviews = vi.fn();
const createBookingReview = vi.fn();

vi.mock("@/services/reviewsApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/reviewsApi")>();
  return {
    ...actual,
    fetchPendingReviews: (...a: unknown[]) => fetchPendingReviews(...a),
    fetchMyBookingReviews: (...a: unknown[]) => fetchMyBookingReviews(...a),
    createBookingReview: (...a: unknown[]) => createBookingReview(...a),
  };
});

import Reviews from "../pages/customer/Reviews";

const B1 = "65f0c0ffee00000000a1b2c3";
const B2 = "65f0c0ffee00000000a1b2c4";

const pendingItem = (over: Partial<PendingReview> = {}): PendingReview => ({
  bookingId: B1,
  serviceId: "65f0c0ffee00000000a1b2d1",
  serviceName: "AC Service",
  partnerId: "65f0c0ffee00000000a1b2e1",
  partnerName: "Ramesh Kumar",
  completedOn: "2026-10-12T10:00:00.000Z",
  ...over,
});

const myReview = (over: Partial<MyReview> = {}): MyReview => ({
  id: "r1",
  bookingId: B2,
  serviceId: "65f0c0ffee00000000a1b2d2",
  serviceName: "Deep Cleaning",
  partnerId: "65f0c0ffee00000000a1b2e2",
  partnerName: "Anita Rao",
  rating: 5,
  comment: "Spotless work, arrived on time.",
  tags: ["Professional", "On time"],
  status: "pending",
  visible: false,
  verified: true,
  createdAt: "2026-10-11T09:00:00.000Z",
  ...over,
});

function renderPage(entry = "/customer/reviews") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Reviews />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const setOnline = (value: boolean) => Object.defineProperty(window.navigator, "onLine", { value, configurable: true });

beforeEach(() => {
  setOnline(true);
  fetchPendingReviews.mockResolvedValue([pendingItem()]);
  fetchMyBookingReviews.mockResolvedValue([myReview()]);
  createBookingReview.mockResolvedValue(myReview({ id: "new", bookingId: B1, serviceName: "AC Service" }));
});
afterEach(() => vi.clearAllMocks());

describe("Customer reviews page", () => {
  it("lists completed bookings that still need a review, with tab counts", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "AC Service" })).toBeInTheDocument();
    expect(screen.getByText("Ramesh Kumar")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /pending/i })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByRole("tab", { name: "My reviews, 1 written" })).toBeInTheDocument();
  });

  it("My reviews shows rating, tags, comment and the validation status", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("tab", { name: /my reviews/i }));
    const card = await screen.findByRole("article", { name: /your review of deep cleaning/i });
    expect(within(card).getByText("Pending validation")).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: "5 out of 5 stars" })).toBeInTheDocument();
    expect(within(card).getByText("Professional")).toBeInTheDocument();
    expect(within(card).getByText("Spotless work, arrived on time.")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: /view booking/i })).toHaveAttribute("href", `/customer/bookings/${B2}`);
  });

  it("opens the form with the booking's service and partner, and offers the four tags", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /write a review/i }));
    const form = screen.getByRole("form", { name: /review ac service/i });
    expect(within(form).getByText("Ramesh Kumar")).toBeInTheDocument();
    for (const tag of ["Professional", "On time", "Good quality", "Clean work"]) {
      expect(within(form).getByRole("button", { name: tag })).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("will not submit without a rating", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /write a review/i }));
    await user.click(screen.getByRole("button", { name: /submit review/i }));
    expect(await screen.findByText("Please choose a star rating.")).toBeInTheDocument();
    expect(createBookingReview).not.toHaveBeenCalled();
  });

  it("submits rating, tags and comment, then confirms", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /write a review/i }));
    await user.click(screen.getByRole("radio", { name: /4 stars/i }));
    await user.click(screen.getByRole("button", { name: "On time" }));
    await user.click(screen.getByRole("button", { name: "Clean work" }));
    await user.type(screen.getByLabelText(/tell us more/i), "  Great job  ");
    // The list refetches after saving: the booking is no longer pending.
    fetchPendingReviews.mockResolvedValue([]);
    await user.click(screen.getByRole("button", { name: /submit review/i }));

    await waitFor(() => expect(createBookingReview).toHaveBeenCalledTimes(1));
    expect(createBookingReview).toHaveBeenCalledWith(B1, { rating: 4, tags: ["On time", "Clean work"], comment: "Great job" });
    expect(await screen.findByRole("status")).toHaveTextContent(/thanks.*ac service/i);
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
  });

  it("the rating can be set from the keyboard", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: /write a review/i }));
    await user.click(screen.getByRole("radio", { name: /3 stars/i }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: /4 stars/i })).toHaveAttribute("aria-checked", "true");
  });

  it("explains a duplicate review (409) and closes the form", async () => {
    const user = userEvent.setup();
    createBookingReview.mockRejectedValue({ status: 409, code: "CONFLICT", message: "You have already reviewed this booking" });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /write a review/i }));
    await user.click(screen.getByRole("radio", { name: /5 stars/i }));
    await user.click(screen.getByRole("button", { name: /submit review/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You have already reviewed this booking");
    expect(screen.queryByRole("form", { name: /review ac service/i })).not.toBeInTheDocument();
  });

  it("keeps the form open and shows the message when the server is unreachable", async () => {
    const user = userEvent.setup();
    createBookingReview.mockRejectedValue({ status: 0, code: "NETWORK_ERROR", message: "Unable to reach the server. Please check your connection and try again." });
    renderPage();
    await user.click(await screen.findByRole("button", { name: /write a review/i }));
    await user.click(screen.getByRole("radio", { name: /2 stars/i }));
    await user.click(screen.getByRole("button", { name: /submit review/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to reach the server/i);
    expect(screen.getByRole("form", { name: /review ac service/i })).toBeInTheDocument();
  });

  it("opens the right form from a ?booking= link", async () => {
    fetchPendingReviews.mockResolvedValue([pendingItem({ bookingId: B2, serviceName: "Deep Cleaning" }), pendingItem()]);
    renderPage(`/customer/reviews?booking=${B1}`);
    expect(await screen.findByRole("form", { name: /review ac service/i })).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: /review deep cleaning/i })).not.toBeInTheDocument();
  });

  it("says so when the linked booking can't be reviewed", async () => {
    renderPage(`/customer/reviews?booking=${B2}`);
    expect(await screen.findByText(/already reviewed or isn't completed yet/i)).toBeInTheDocument();
  });

  it("shows empty states for both tabs", async () => {
    const user = userEvent.setup();
    fetchPendingReviews.mockResolvedValue([]);
    fetchMyBookingReviews.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /my reviews/i }));
    expect(await screen.findByText("No reviews yet")).toBeInTheDocument();
  });

  it("shows an error with a retry when loading fails", async () => {
    const user = userEvent.setup();
    fetchPendingReviews.mockRejectedValueOnce({ status: 400, code: "VALIDATION_ERROR", message: "Server exploded" });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Server exploded");
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByRole("heading", { name: "AC Service" })).toBeInTheDocument();
  });

  it("shows an offline message instead of a blank page", async () => {
    setOnline(false);
    renderPage();
    expect(await screen.findByText("You're offline")).toBeInTheDocument();
  });
});
