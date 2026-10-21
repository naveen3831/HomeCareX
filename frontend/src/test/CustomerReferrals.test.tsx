import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Referrals from "@/pages/customer/Referrals";
import http from "@/lib/http";
import type { ReferralSummary } from "@/hooks/useReferral";

let online = true;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "507f1f77bcf86cd799439011" } }),
}));
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => online,
}));
vi.mock("@/lib/http", () => ({
  default: { get: vi.fn() },
}));

const getMock = vi.mocked(http.get);

const summary: ReferralSummary = {
  code: "HCXA1B2C3D4E5",
  rewardPerReferralPaise: 5000,
  stats: { invited: 3, completed: 2, rewardsPaise: 5000 },
  entries: [
    {
      id: "r1",
      status: "rewarded",
      rewardPaise: 5000,
      createdAt: "2026-10-10T10:00:00Z",
      rewardedAt: "2026-10-12T10:00:00Z",
    },
    {
      id: "r2",
      status: "completed",
      rewardPaise: 0,
      createdAt: "2026-10-11T10:00:00Z",
      rewardedAt: null,
    },
    {
      id: "r3",
      status: "invited",
      rewardPaise: 0,
      createdAt: "2026-10-12T10:00:00Z",
      rewardedAt: null,
    },
  ],
  meta: { page: 1, pages: 1, total: 3 },
};

const reply = (data: ReferralSummary) =>
  ({ data: { success: true, data } }) as never;

const clients: QueryClient[] = [];
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/customer/referrals"]}>
        <Referrals />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setClipboard(writeText: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}
function setShare(share: unknown) {
  Object.defineProperty(navigator, "share", {
    value: share,
    configurable: true,
  });
}

beforeEach(() => {
  online = true;
  getMock.mockReset();
  setShare(undefined);
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((c) => c.clear());
});

describe("customer referrals page", () => {
  it("shows a loading state before data arrives", () => {
    getMock.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.getByText("Loading your referrals…")).toBeTruthy();
  });

  it("renders the code, stats and reward status for the caller", async () => {
    getMock.mockResolvedValue(reply(summary));
    mount();
    const input = (await screen.findByLabelText(
      "Your referral code",
    )) as HTMLInputElement;
    expect(input.value).toBe("HCXA1B2C3D4E5");
    expect(input.readOnly).toBe(true);
    expect(screen.getByText("Friends invited")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Reward credited")).toBeTruthy();
    expect(screen.getByText("Reward pending")).toBeTruthy();
    expect(screen.getByText("Awaiting first booking")).toBeTruthy();
    expect(screen.getAllByText(/₹50\.00/).length).toBeGreaterThan(0);
    expect(getMock).toHaveBeenCalledWith(
      "/referrals",
      expect.objectContaining({ params: { page: 1 } }),
    );
  });

  it("shows an empty state when there are no invitations", async () => {
    getMock.mockResolvedValue(
      reply({
        ...summary,
        stats: { invited: 0, completed: 0, rewardsPaise: 0 },
        entries: [],
        meta: { page: 1, pages: 1, total: 0 },
      }),
    );
    mount();
    expect(
      await screen.findByText("Your first invitation starts here"),
    ).toBeTruthy();
  });

  it("explains when no reward amount is configured", async () => {
    getMock.mockResolvedValue(reply({ ...summary, rewardPerReferralPaise: 0 }));
    mount();
    expect(
      await screen.findByText(/Referral rewards will be announced/),
    ).toBeTruthy();
  });

  it("shows an error with a working retry button", async () => {
    getMock.mockRejectedValueOnce(new Error("Server unavailable"));
    getMock.mockResolvedValue(reply(summary));
    mount();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Server unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Your referral code")).toBeTruthy();
  });

  it("shows an offline notice instead of a blank screen", () => {
    online = false;
    mount();
    expect(screen.getByText(/You’re offline/)).toBeTruthy();
    expect(
      screen.getByText("Reconnect to load your referral code."),
    ).toBeTruthy();
    expect(getMock).not.toHaveBeenCalled();
  });

  it("copies the code to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    getMock.mockResolvedValue(reply(summary));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Copy code/ }));
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("HCXA1B2C3D4E5"),
    );
    expect(await screen.findByText("Copied to clipboard.")).toBeTruthy();
  });

  it("falls back to manual copy when the clipboard is blocked", async () => {
    setClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    getMock.mockResolvedValue(reply(summary));
    mount();
    fireEvent.click(await screen.findByRole("button", { name: /Copy code/ }));
    expect(await screen.findByText(/Select and copy your code/)).toBeTruthy();
  });

  it("uses the native share sheet with the referral link when available", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    getMock.mockResolvedValue(reply(summary));
    mount();
    fireEvent.click(
      await screen.findByRole("button", { name: /Share invite/ }),
    );
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const payload = share.mock.calls[0][0] as { url: string; text: string };
    expect(payload.url).toContain("/register?ref=HCXA1B2C3D4E5");
    expect(payload.text).toContain("HCXA1B2C3D4E5");
  });

  it("paginates referral activity", async () => {
    getMock.mockResolvedValueOnce(
      reply({ ...summary, meta: { page: 1, pages: 2, total: 12 } }),
    );
    getMock.mockResolvedValue(
      reply({ ...summary, meta: { page: 2, pages: 2, total: 12 } }),
    );
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Next" }));
    await waitFor(() =>
      expect(getMock).toHaveBeenLastCalledWith(
        "/referrals",
        expect.objectContaining({ params: { page: 2 } }),
      ),
    );
  });
});
