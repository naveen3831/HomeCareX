import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  toCustomerMessage,
  useLiveTicketMessages,
  type LiveTicketMessage,
} from "@/hooks/useLiveTicketMessages";
import type { TicketDetail } from "@/features/support/types";

const USER_ID = "507f1f77bcf86cd799439011";
const TICKET_ID = "507f1f77bcf86cd799439012";
const handlers = new Map<string, (payload: unknown) => void>();
const socket = {
  on: vi.fn((event: string, fn: (payload: unknown) => void) => {
    handlers.set(event, fn);
  }),
  off: vi.fn((event: string) => {
    handlers.delete(event);
  }),
};
let connected = true;

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: USER_ID } }),
}));
vi.mock("@/hooks/useSocket", () => ({
  useSocket: () => ({ socket, connected }),
}));

const detail: TicketDetail = {
  ticket: {
    id: TICKET_ID,
    createdBy: USER_ID,
    createdByRole: "customer",
    bookingId: null,
    category: "booking",
    subject: "AC not cooling",
    priority: "normal",
    status: "open",
    assignedTo: null,
    lastMessageAt: "2026-10-16T05:00:00.000Z",
    createdAt: "2026-10-16T05:00:00.000Z",
    updatedAt: "2026-10-16T05:00:00.000Z",
  },
  messages: [],
  nextBefore: null,
};
const live = (
  overrides: Partial<LiveTicketMessage> = {},
): LiveTicketMessage => ({
  id: "507f1f77bcf86cd799439099",
  ticketId: TICKET_ID,
  sender: { id: "agent1", name: "Asha", role: "admin" },
  body: "We are sending a technician.",
  attachments: [],
  internal: false,
  createdAt: "2026-10-16T05:10:00.000Z",
  ...overrides,
});

let client: QueryClient;
const key = ["customer-support", USER_ID, "ticket", TICKET_ID];
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const emit = (payload: unknown) =>
  act(() => handlers.get("ticket:message")?.(payload));
const messages = () => client.getQueryData<TicketDetail>(key)?.messages ?? [];

describe("useLiveTicketMessages", () => {
  beforeEach(() => {
    handlers.clear();
    connected = true;
    client = new QueryClient();
    client.setQueryData(key, detail);
  });
  afterEach(() => vi.clearAllMocks());

  it("appends an agent reply for this ticket to the cached thread", () => {
    renderHook(() => useLiveTicketMessages(TICKET_ID), { wrapper });
    emit(live());
    expect(messages()).toHaveLength(1);
    expect(messages()[0]).toMatchObject({
      senderRole: "admin",
      body: "We are sending a technician.",
    });
  });

  it("ignores duplicates, other tickets, internal notes and malformed payloads", () => {
    renderHook(() => useLiveTicketMessages(TICKET_ID), { wrapper });
    emit(live());
    emit(live());
    emit(
      live({
        id: "507f1f77bcf86cd799439098",
        ticketId: "507f1f77bcf86cd799439fff",
      }),
    );
    emit(live({ id: "507f1f77bcf86cd799439097", internal: true }));
    emit({ nonsense: true });
    emit(null);
    expect(messages()).toHaveLength(1);
  });

  it("reports live only while the socket is connected", () => {
    connected = false;
    const { result } = renderHook(() => useLiveTicketMessages(TICKET_ID), {
      wrapper,
    });
    expect(result.current.live).toBe(false);
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useLiveTicketMessages(TICKET_ID), {
      wrapper,
    });
    unmount();
    expect(handlers.has("ticket:message")).toBe(false);
  });

  it("maps the live shape to the customer message shape", () => {
    expect(toCustomerMessage(live())).toMatchObject({
      senderId: "agent1",
      senderRole: "admin",
      readAt: null,
    });
  });
});
