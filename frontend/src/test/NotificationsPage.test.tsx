import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { emptyGroupCounts, type CustomerNotification, type NotificationGroup, type NotificationQuery, type NotificationsPage } from "../services/notificationApi";

const fetchNotifications = vi.fn();
const markNotificationRead = vi.fn();
const markAllNotificationsRead = vi.fn();
const deleteNotification = vi.fn();
const deleteAllNotifications = vi.fn();

vi.mock("@/services/notificationApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/notificationApi")>();
  return {
    ...actual,
    fetchNotifications: (...a: unknown[]) => fetchNotifications(...a),
    markNotificationRead: (...a: unknown[]) => markNotificationRead(...a),
    markAllNotificationsRead: (...a: unknown[]) => markAllNotificationsRead(...a),
    deleteNotification: (...a: unknown[]) => deleteNotification(...a),
    deleteAllNotifications: (...a: unknown[]) => deleteAllNotifications(...a),
  };
});

// A tiny fake socket so the tests can "push" a notification.
const socketHandlers = new Map<string, Set<() => void>>();
vi.mock("@/services/bookingSocket", () => ({
  getSocket: () => ({
    on: (event: string, fn: () => void) => void (socketHandlers.get(event) ?? socketHandlers.set(event, new Set()).get(event))!.add(fn),
    off: (event: string, fn: () => void) => void socketHandlers.get(event)?.delete(fn),
  }),
}));
const pushFromServer = () => act(() => void socketHandlers.get("notification:new")?.forEach((fn) => fn()));

import Notifications from "../pages/customer/Notifications";
import { dayBucket, describeNotification, notificationTargets, timeAgo } from "../pages/customer/Notifications/notificationModel";

const BOOKING = "65f0c0ffee00000000a1b2c3";
const TICKET = "65f0c0ffee00000000a1b2f9";

const note = (over: Partial<CustomerNotification> & { id: string }): CustomerNotification => ({
  userId: "u1",
  type: "booking.assigned",
  group: "booking",
  payload: { bookingId: BOOKING },
  readAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

let rows: CustomerNotification[] = [];

/** Behaves like the server: filters rows, and counts unread per group across everything. */
const serve = (q: NotificationQuery = {}): NotificationsPage => {
  const groups = emptyGroupCounts();
  for (const r of rows) {
    groups[r.group].total += 1;
    if (!r.readAt) groups[r.group].unread += 1;
  }
  const items = rows.filter((r) => (!q.group || r.group === q.group) && (!q.unreadOnly || !r.readAt));
  return { items, unread: rows.filter((r) => !r.readAt).length, groups };
};

function renderPage(entry = "/customer/notifications") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Notifications />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const setOnline = (value: boolean) => Object.defineProperty(window.navigator, "onLine", { value, configurable: true });

beforeEach(() => {
  setOnline(true);
  socketHandlers.clear();
  rows = [
    note({ id: "n1", type: "booking.completed" }),
    note({ id: "n2", type: "ticket.reply", group: "support", payload: { ticketId: TICKET } }),
    note({ id: "n3", type: "payment.succeeded", group: "payment", payload: { bookingId: BOOKING }, readAt: new Date().toISOString() }),
  ];
  fetchNotifications.mockImplementation(async (q: NotificationQuery) => serve(q));
  markNotificationRead.mockImplementation(async (id: string) => {
    const row = rows.find((r) => r.id === id)!;
    row.readAt = new Date().toISOString();
    return row;
  });
  deleteNotification.mockImplementation(async (id: string) => {
    rows = rows.filter((r) => r.id !== id);
  });
  deleteAllNotifications.mockImplementation(async () => {
    const n = rows.length;
    rows = [];
    return n;
  });
  markAllNotificationsRead.mockImplementation(async () => {
    rows.forEach((r) => (r.readAt ??= new Date().toISOString()));
    return 2;
  });
});
afterEach(() => vi.clearAllMocks());

describe("Customer notifications page", () => {
  it("lists notifications with the unread total and a badge per group", async () => {
    renderPage();
    expect(await screen.findByText("Service completed")).toBeInTheDocument();
    expect(screen.getByText("Support replied")).toBeInTheDocument();
    expect(screen.getByText("Payment successful")).toBeInTheDocument();
    expect(screen.getByText("2 unread")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^booking, 1 unread$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^support, 1 unread$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /^payment$/i })).toBeInTheDocument();
  });

  it("has a tab for each group", async () => {
    renderPage();
    await screen.findByText("Service completed");
    const names = screen.getAllByRole("tab").map((t) => (t.getAttribute("aria-label") ?? t.textContent ?? "").replace(/, \d+ unread/, ""));
    expect(names).toEqual(["All", "Booking", "Payment", "Partner", "Offers", "Support", "System"]);
  });

  it("filters by group on the server and keeps it in the URL", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Service completed");
    await user.click(screen.getByRole("tab", { name: /support/i }));
    await waitFor(() => expect(fetchNotifications).toHaveBeenLastCalledWith(expect.objectContaining({ group: "support" satisfies NotificationGroup }), expect.anything()));
    expect(await screen.findByText("Support replied")).toBeInTheDocument();
    expect(screen.queryByText("Service completed")).not.toBeInTheDocument();
  });

  it("opens a group from the URL", async () => {
    renderPage("/customer/notifications?group=payment");
    expect(await screen.findByText("Payment successful")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /payment/i })).toHaveAttribute("aria-selected", "true");
  });

  it("has no 'Unread only' filter any more", async () => {
    renderPage();
    await screen.findByText("Service completed");
    expect(screen.queryByRole("checkbox", { name: /unread only/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/unread only/i)).not.toBeInTheDocument();
  });

  it("deletes one notification with its Delete button and removes it from the list", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Support replied");
    await user.click(screen.getByRole("button", { name: /delete notification: support replied/i }));
    await waitFor(() => expect(deleteNotification).toHaveBeenCalledWith("n2"));
    await waitFor(() => expect(screen.queryByText("Support replied")).not.toBeInTheDocument());
    expect(screen.getByText("Service completed")).toBeInTheDocument();
    expect(screen.getByText("1 unread")).toBeInTheDocument();
  });

  // jsdom has no PointerEvent, so mouse events carry the coordinates under the pointer event names the component listens to.
  const pointer = (el: Element, type: string, x: number, y = 0) =>
    act(() => void el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 })));
  const rowOf = (title: string) => screen.getByText(title).closest("li")!.firstElementChild!.nextElementSibling!;

  it("swiping a notification left far enough deletes it", async () => {
    renderPage();
    await screen.findByText("Support replied");
    const row = rowOf("Support replied");
    pointer(row, "pointerdown", 300);
    pointer(row, "pointermove", 220);
    pointer(row, "pointermove", 120);
    pointer(row, "pointerup", 120);
    await waitFor(() => expect(deleteNotification).toHaveBeenCalledWith("n2"));
    await waitFor(() => expect(screen.queryByText("Support replied")).not.toBeInTheDocument());
  });

  it("a short swipe, a swipe right, or a vertical scroll deletes nothing", async () => {
    renderPage();
    await screen.findByText("Support replied");
    const row = rowOf("Support replied");
    pointer(row, "pointerdown", 300);
    pointer(row, "pointermove", 270);
    pointer(row, "pointerup", 270);
    pointer(row, "pointerdown", 100);
    pointer(row, "pointermove", 300);
    pointer(row, "pointerup", 300);
    pointer(row, "pointerdown", 200, 400);
    pointer(row, "pointermove", 190, 250);
    pointer(row, "pointerup", 190, 250);
    await new Promise((r) => setTimeout(r, 300));
    expect(deleteNotification).not.toHaveBeenCalled();
    expect(screen.getByText("Support replied")).toBeInTheDocument();
  });

  it("the trash button next to 'Mark all as read' asks first, then deletes every notification", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Service completed");
    await user.click(screen.getByRole("button", { name: /delete all notifications/i }));
    expect(deleteAllNotifications).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /no, keep them/i }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /delete all notifications/i }));
    await user.click(screen.getByRole("button", { name: /yes, delete all/i }));
    await waitFor(() => expect(deleteAllNotifications).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete all notifications/i })).toBeDisabled();
  });

  it("marks one notification as read", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Support replied");
    await user.click(screen.getByRole("button", { name: /mark as read: support replied/i }));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith("n2"));
    expect(await screen.findByText("1 unread")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /mark as read: support replied/i })).not.toBeInTheDocument();
  });

  it("marks everything as read, then disables the button", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Service completed");
    await user.click(screen.getByRole("button", { name: /mark all as read/i }));
    await waitFor(() => expect(markAllNotificationsRead).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("You're all caught up")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /mark all as read/i })).toBeDisabled();
  });

  it("links to the booking, the ticket and the review form", async () => {
    renderPage();
    await screen.findByText("Service completed");
    const completed = screen.getByText("Service completed").closest("li")!;
    expect(within(completed).getByRole("link", { name: "Rate service" })).toHaveAttribute("href", `/customer/reviews?booking=${BOOKING}`);
    expect(within(completed).getByRole("link", { name: "Open booking" })).toHaveAttribute("href", `/customer/bookings/${BOOKING}`);
    const reply = screen.getByText("Support replied").closest("li")!;
    expect(within(reply).getByRole("link", { name: "Open ticket" })).toHaveAttribute("href", `/customer/support/tickets?ticket=${TICKET}`);
  });

  it("opening a booking from a notification marks it read", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Service completed");
    const completed = screen.getByText("Service completed").closest("li")!;
    await user.click(within(completed).getByRole("link", { name: "Open booking" }));
    await waitFor(() => expect(markNotificationRead).toHaveBeenCalledWith("n1"));
  });

  it("refreshes when the server pushes a new notification", async () => {
    renderPage();
    await screen.findByText("Service completed");
    const calls = fetchNotifications.mock.calls.length;
    rows = [note({ id: "n9", type: "offer.new", group: "offers", payload: {} }), ...rows];
    pushFromServer();
    expect(await screen.findByText("New offer")).toBeInTheDocument();
    expect(fetchNotifications.mock.calls.length).toBeGreaterThan(calls);
  });

  it("shows an empty state", async () => {
    rows = [];
    renderPage();
    expect(await screen.findByText("No notifications yet")).toBeInTheDocument();
  });

  it("shows an empty state for a group with nothing in it", async () => {
    renderPage("/customer/notifications?group=offers");
    expect(await screen.findByText("No offers notifications")).toBeInTheDocument();
  });

  it("shows an error with a retry when loading fails", async () => {
    const user = userEvent.setup();
    fetchNotifications.mockRejectedValueOnce({ status: 400, code: "VALIDATION_ERROR", message: "Server exploded" });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Server exploded");
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("Service completed")).toBeInTheDocument();
  });

  it("shows an offline message instead of a blank page", async () => {
    setOnline(false);
    renderPage();
    expect(await screen.findByText("You're offline")).toBeInTheDocument();
  });

  it("tells the customer when marking as read fails", async () => {
    const user = userEvent.setup();
    markNotificationRead.mockRejectedValueOnce({ status: 404, code: "NOT_FOUND", message: "Notification not found" });
    renderPage();
    await screen.findByText("Support replied");
    await user.click(screen.getByRole("button", { name: /mark as read: support replied/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Notification not found");
  });
});

describe("notification helpers", () => {
  it("writes readable text for known and unknown types", () => {
    expect(describeNotification({ type: "booking.cancelled", payload: null }).title).toBe("Booking cancelled");
    expect(describeNotification({ type: "refund.updated", payload: { amount: 1499, status: "rejected" } }).message).toBe("Your refund of ₹1,499 is rejected.");
    expect(describeNotification({ type: "brand.new_thing", payload: {} }).title).toBe("Brand new thing");
  });

  it("prefers the server's own title and message", () => {
    expect(describeNotification({ type: "offer.new", payload: { title: "Diwali sale", message: "20% off cleaning" } })).toEqual({ title: "Diwali sale", message: "20% off cleaning" });
  });

  it("only deep-links to well-formed ids", () => {
    expect(notificationTargets({ payload: { bookingId: BOOKING, ticketId: "../../evil" } })).toEqual({ bookingId: BOOKING, ticketId: undefined });
    expect(notificationTargets({ payload: null })).toEqual({ bookingId: undefined, ticketId: undefined });
  });

  it("buckets by day and words recent times", () => {
    const now = new Date("2026-10-14T12:00:00");
    expect(dayBucket("2026-10-14T08:00:00", now)).toBe("Today");
    expect(dayBucket("2026-10-13T23:00:00", now)).toBe("Yesterday");
    expect(dayBucket("2026-10-01T10:00:00", now)).toBe("Earlier");
    expect(timeAgo("2026-10-14T11:56:00", now)).toBe("4 min ago");
    expect(timeAgo("not a date", now)).toBe("");
  });
});
