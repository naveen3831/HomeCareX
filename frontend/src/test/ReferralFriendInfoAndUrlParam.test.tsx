import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ReferralSummary } from "@/hooks/useReferral";
import Referrals from "../pages/customer/Referrals";
import { RegisterPage } from "../pages/public/Register";
import { MemoryRouter } from "react-router-dom";

const mockReferralState = vi.hoisted(() => ({
  data: undefined as ReferralSummary | undefined,
  isError: false,
  isFetching: false,
  refetch: vi.fn(),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => true,
}));

vi.mock("@/hooks/useReferral", () => ({
  useReferral: () => ({
    data: mockReferralState.data,
    isError: mockReferralState.isError,
    isFetching: mockReferralState.isFetching,
    refetch: mockReferralState.refetch,
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    isAuthenticated: false,
    register: vi.fn(),
  }),
}));

describe("Referrals with Friend Details and Registration URL auto-fill", () => {
  it("displays friend's name, email contact and status in referral activity", () => {
    mockReferralState.data = {
      code: "HCXF087D2A9C1",
      rewardPerReferralPaise: 5000,
      stats: { invited: 2, completed: 0, rewardsPaise: 0 },
      entries: [
        {
          id: "ref-entry-1",
          status: "invited",
          rewardPaise: 0,
          createdAt: "2026-11-11T07:02:01.489Z",
          rewardedAt: null,
          referee: {
            id: "user-testr",
            name: "testr",
            email: "referal@gmail.com",
            phone: "9638529630",
          },
          friendName: "testr",
          friendEmail: "referal@gmail.com",
        },
        {
          id: "ref-entry-2",
          status: "invited",
          rewardPaise: 0,
          createdAt: "2026-10-16T10:33:25.921Z",
          rewardedAt: null,
          referee: {
            id: "user-referal",
            name: "referal",
            email: "referal123@gmail.com",
          },
          friendName: "referal",
          friendEmail: "referal123@gmail.com",
        },
      ],
      meta: { page: 1, pages: 1, total: 2 },
    };

    render(
      <MemoryRouter>
        <Referrals />
      </MemoryRouter>
    );

    // Header and stats
    expect(screen.getByText("Friends invited")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();

    // Friend 1: testr
    expect(screen.getByText("testr")).toBeInTheDocument();
    expect(screen.getByText("referal@gmail.com")).toBeInTheDocument();

    // Friend 2: referal
    expect(screen.getByText("referal")).toBeInTheDocument();
    expect(screen.getByText("referal123@gmail.com")).toBeInTheDocument();

    // Both awaiting first booking
    const badges = screen.getAllByText("Awaiting first booking");
    expect(badges).toHaveLength(2);
  });

  it("auto-populates referral code from ?ref= query parameter in RegisterPage", () => {
    render(
      <MemoryRouter initialEntries={["/register?ref=HCXF087D2A9C1"]}>
        <RegisterPage />
      </MemoryRouter>
    );

    const input = screen.getByLabelText(/Referral Code/i) as HTMLInputElement;
    expect(input.value).toBe("HCXF087D2A9C1");
    expect(screen.getByText(/Applied from invite link/i)).toBeInTheDocument();
  });

  it("renders the Referral Welcome Bonus card for a new customer registered through referral", () => {
    mockReferralState.data = {
      code: "HCXTESTR",
      rewardPerReferralPaise: 5000,
      referredBy: {
        code: "HCXF087D2A9C1",
        referrerName: "Test Customer",
        status: "invited",
        rewardPaise: 5000,
        rewardedAt: null,
      },
      stats: { invited: 0, completed: 0, rewardsPaise: 0 },
      entries: [],
      meta: { page: 1, pages: 1, total: 0 },
    };

    render(
      <MemoryRouter>
        <Referrals />
      </MemoryRouter>
    );

    // Welcome bonus card presence and details
    expect(screen.getByText("REFERRAL WELCOME REWARD")).toBeInTheDocument();
    expect(screen.getByText("Earn ₹50.00 on your first booking")).toBeInTheDocument();
    expect(screen.getByText(/Test Customer/)).toBeInTheDocument();
    expect(screen.getByText("HCXF087D2A9C1")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Book a Service/i })).toBeInTheDocument();
  });
});
