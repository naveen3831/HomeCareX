import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

type Handler = () => void;
const handlers = vi.hoisted(() => new Map<string, Set<() => void>>());
vi.mock("@/hooks/useSocket", () => ({
  useSocket: () => ({
    connected: true,
    socket: {
      on: (event: string, fn: () => void) => {
        if (!handlers.has(event)) handlers.set(event, new Set());
        handlers.get(event)?.add(fn);
      },
      off: (event: string, fn: () => void) => handlers.get(event)?.delete(fn),
    },
  }),
}));

import { useTicketUpdates } from "../hooks/useTickets";

const fire = (event: string) =>
  handlers.get(event)?.forEach((fn: Handler) => fn());

describe("live ticket replies", () => {
  it("refetches ticket queries when an agent reply (ticket:message) or status change arrives", () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { unmount } = renderHook(() => useTicketUpdates(), { wrapper });

    fire("ticket:message");
    fire("ticket:updated");
    fire("connect");
    expect(invalidate).toHaveBeenCalledTimes(3);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["customer-support"] });

    unmount();
    fire("ticket:message");
    expect(invalidate).toHaveBeenCalledTimes(3); // listeners removed on unmount
  });
});
