import type { ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingPage, BookingTab } from "@/types/bookingList";
import type { BookingListItem } from "@/pages/customer/Bookings/bookingModel";

const state = vi.hoisted(() => ({ online: true, list: vi.fn() }));
vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => state.online,
}));
vi.mock("@/services/bookingApi", () => ({
  bookingApi: { listBookings: state.list },
}));

import { useBookings } from "@/hooks/useBookings";

const booking = {
  _id: "65f0c0ffee00000000a1b2c3",
  status: "confirmed",
} as BookingListItem;
const page = (items: BookingListItem[]): BookingPage => ({
  items,
  meta: {
    page: 1,
    limit: 10,
    total: items.length,
    totalPages: items.length ? 1 : 0,
  },
});
const clients: QueryClient[] = [];
const wrapper = () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  clients.push(client);
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
};
const params = (tab: BookingTab = "upcoming") => ({ tab, page: 1, limit: 10 });
const flush = async () => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
};

beforeEach(() => {
  state.online = true;
  state.list.mockReset().mockResolvedValue(page([booking]));
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach((client) => client.clear());
  vi.useRealTimers();
});

describe("booking tab refresh", () => {
  it("sends the tab together with a selected raw status", async () => {
    renderHook(
      () => useBookings({ ...params(), status: "confirmed,created" }),
      { wrapper: wrapper() },
    );
    await flush();
    expect(state.list).toHaveBeenCalled();
    expect(state.list.mock.calls[0][0]).toMatchObject({
      tab: "upcoming",
      status: "confirmed,created",
    });
  });

  it("refreshes Upcoming so elapsed bookings and its count leave the page", async () => {
    state.list
      .mockResolvedValueOnce(page([booking]))
      .mockResolvedValue(page([]));
    const { result } = renderHook(() => useBookings(params()), {
      wrapper: wrapper(),
    });
    await flush();
    expect(result.current.data?.meta.total).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await flush();
    expect(result.current.data?.meta.total).toBe(0);
    expect(result.current.data?.items).toEqual([]);
  });

  it("refreshes Overdue and stops requests while offline", async () => {
    const { result, rerender } = renderHook(
      () => useBookings(params("overdue")),
      { wrapper: wrapper() },
    );
    await flush();
    expect(result.current.data).toBeDefined();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(state.list).toHaveBeenCalledTimes(2);
    state.online = false;
    rerender();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(state.list).toHaveBeenCalledTimes(2);
  });

  it("does not keep completed cards as placeholder data when switching to Upcoming", async () => {
    state.list
      .mockResolvedValueOnce(page([{ ...booking, status: "completed" }]))
      .mockImplementation(() => new Promise(() => undefined));
    const { result, rerender } = renderHook(
      ({ tab }) => useBookings(params(tab)),
      {
        wrapper: wrapper(),
        initialProps: { tab: "completed" as BookingTab },
      },
    );
    await flush();
    expect(result.current.data?.items[0].status).toBe("completed");
    rerender({ tab: "upcoming" });
    expect(result.current.data).toBeUndefined();
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it("keeps pagination placeholder data inside the same tab", async () => {
    state.list
      .mockResolvedValueOnce(page([booking]))
      .mockImplementation(() => new Promise(() => undefined));
    const { result, rerender } = renderHook(
      ({ number }) => useBookings({ ...params(), page: number }),
      {
        wrapper: wrapper(),
        initialProps: { number: 1 },
      },
    );
    await flush();
    expect(result.current.data).toBeDefined();
    rerender({ number: 2 });
    expect(result.current.data?.items).toEqual([booking]);
    expect(result.current.isPlaceholderData).toBe(true);
  });
});
