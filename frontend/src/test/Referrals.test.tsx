import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReferralSummary } from "@/hooks/useReferral";

const state = vi.hoisted(() => ({
  online: true,
  query: {} as Record<string, unknown>,
}));
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => state.online,
}));
vi.mock("@/hooks/useReferral", () => ({
  useReferral: () => state.query,
}));

import Referrals from "../pages/customer/Referrals";

const summary = (over: Partial<ReferralSummary> = {}): ReferralSummary => ({
  code: "HCXABCDEF1234",
  rewardPerReferralPaise: 5000,
  stats: { invited: 3, completed: 2, rewardsPaise: 5000 },
  entries: [
    {
      id: "1",
      status: "rewarded",
      rewardPaise: 5000,
      createdAt: "2026-10-01T10:00:00.000Z",
      rewardedAt: "2026-10-05T10:00:00.000Z",
    },
    {
      id: "2",
      status: "completed",
      rewardPaise: 0,
      createdAt: "2026-10-02T10:00:00.000Z",
      rewardedAt: null,
    },
    {
      id: "3",
      status: "invited",
      rewardPaise: 0,
      createdAt: "2026-10-03T10:00:00.000Z",
      rewardedAt: null,
    },
  ],
  meta: { page: 1, pages: 1, total: 3 },
  ...over,
});
const ready = (data: ReferralSummary) => {
  state.query = { data, isError: false, isFetching: false, refetch: vi.fn() };
};

beforeEach(() => {
  state.online = true;
  state.query = {};
});
afterEach(() => vi.restoreAllMocks());

describe("customer referrals page", () => {
  it("shows a loading message, never a blank screen", () => {
    state.query = { data: undefined, isError: false };
    render(<Referrals />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Loading your referrals",
    );
  });

  it("shows the error with a working retry", async () => {
    const refetch = vi.fn();
    state.query = {
      data: undefined,
      isError: true,
      error: new Error("x"),
      refetch,
    };
    render(<Referrals />);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("offline: tells the customer and disables retry", () => {
    state.online = false;
    state.query = {
      data: undefined,
      isError: true,
      error: new Error("x"),
      refetch: vi.fn(),
    };
    render(<Referrals />);
    expect(screen.getByText(/You’re offline/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();
  });

  it("empty state: zero stats and an invitation prompt", () => {
    ready(
      summary({
        stats: { invited: 0, completed: 0, rewardsPaise: 0 },
        entries: [],
      }),
    );
    render(<Referrals />);
    expect(
      screen.getByText("Your first invitation starts here"),
    ).toBeInTheDocument();
    const stats = screen.getByLabelText("Referral statistics");
    expect(within(stats).getAllByText("0")).toHaveLength(2);
    expect(within(stats).getByText("₹0.00")).toBeInTheDocument();
  });

  it("shows the code, stats and each reward status", () => {
    ready(summary());
    render(<Referrals />);
    expect(screen.getByLabelText("Your referral code")).toHaveValue(
      "HCXABCDEF1234",
    );
    const stats = screen.getByLabelText("Referral statistics");
    expect(within(stats).getByText("3")).toBeInTheDocument();
    expect(within(stats).getByText("₹50.00")).toBeInTheDocument();
    expect(screen.getByText("Reward credited")).toBeInTheDocument();
    expect(screen.getByText("Reward pending")).toBeInTheDocument();
    expect(screen.getByText("Awaiting first booking")).toBeInTheDocument();
    expect(
      screen.getByText(/₹50.00 is credited to your wallet after/),
    ).toBeInTheDocument();
  });

  it("does not promise an amount when no reward is configured", () => {
    ready(summary({ rewardPerReferralPaise: 0 }));
    render(<Referrals />);
    expect(
      screen.getByText(/Referral rewards will be announced/),
    ).toBeInTheDocument();
  });

  it("copies the code to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    ready(summary());
    render(<Referrals />);
    await userEvent.click(screen.getByRole("button", { name: /Copy code/ }));
    expect(writeText).toHaveBeenCalledWith("HCXABCDEF1234");
    expect(screen.getByText("Copied to clipboard.")).toBeInTheDocument();
  });

  it("shares a sign-up link with the code, or falls back to copying it", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
    });
    ready(summary());
    render(<Referrals />);
    await userEvent.click(screen.getByRole("button", { name: /Share invite/ }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("/register?ref=HCXABCDEF1234"),
    );
  });

  it("paginates and disables paging while offline", () => {
    state.online = false;
    ready(summary({ meta: { page: 1, pages: 3, total: 25 } }));
    render(<Referrals />);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });
});
