import "@testing-library/jest-dom/vitest";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingDetailView } from "../types/bookingDetail";
import type { TrackingJoinAck } from "../types/tracking";

type Handler = (...args: unknown[]) => void;

/** A stand-in for the Socket.IO client: records emits, answers joins, and lets a test fire server events. */
const fake = vi.hoisted(() => {
  class FakeSocket {
    connected = true;
    emitted: Array<[string, unknown]> = [];
    joins = 0;
    handlers = new Map<string, Set<Handler>>();
    joinReply: (payload: unknown) => TrackingJoinAck = () => ({ ok: false });
    connect = vi.fn();
    on(event: string, fn: Handler) {
      if (!this.handlers.has(event)) this.handlers.set(event, new Set());
      this.handlers.get(event)?.add(fn);
      return this;
    }
    off(event: string, fn: Handler) {
      this.handlers.get(event)?.delete(fn);
      return this;
    }
    emit(event: string, payload: unknown) {
      this.emitted.push([event, payload]);
      return this;
    }
    timeout() {
      return {
        emit: (
          event: string,
          payload: unknown,
          cb: (err: Error | null, ack?: TrackingJoinAck) => void,
        ) => {
          this.emitted.push([event, payload]);
          this.joins += 1;
          cb(null, this.joinReply(payload));
        },
      };
    }
    fire(event: string, ...args: unknown[]) {
      this.handlers.get(event)?.forEach((fn) => fn(...args));
    }
  }
  return { socket: new FakeSocket() };
});

vi.mock("@/services/bookingSocket", () => ({
  getSocket: () => fake.socket,
}));

const getBookingDetail = vi.fn();
vi.mock("@/services/bookingApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/bookingApi")>();
  return {
    ...actual,
    bookingApi: {
      ...actual.bookingApi,
      getBookingDetail: (...a: unknown[]) => getBookingDetail(...a),
    },
  };
});

// Leaflet needs a real layout engine; the page's wiring is what matters here.
vi.mock("../pages/customer/Tracking/components/LiveMap", () => ({
  default: (props: {
    destination: { lat: number } | null;
    partner: { lat: number; lng: number } | null;
    stale: boolean;
  }) => (
    <div
      data-testid="map"
      data-partner={
        props.partner ? `${props.partner.lat},${props.partner.lng}` : ""
      }
      data-stale={String(props.stale)}
      data-destination={props.destination ? "yes" : "no"}
    />
  ),
}));
vi.mock("@/components/ChatPanel", () => ({
  default: (props: { bookingId: string; viewerRole?: string }) => (
    <div data-testid="chat">{`${props.bookingId}:${props.viewerRole}`}</div>
  ),
}));

import TrackingPage from "../pages/customer/Tracking";

const ID = "65f0c0ffee00000000a1b2c3";
const nowIso = () => new Date().toISOString();

const detail = (over: Partial<BookingDetailView> = {}): BookingDetailView =>
  ({
    _id: ID,
    customerId: "c1",
    serviceId: "s1",
    serviceName: "AC Service",
    quantity: 1,
    addOns: [],
    addressSnapshot: {
      line1: "12 MG Road",
      city: "Vijayawada",
      state: "Andhra Pradesh",
      pincode: "520001",
      location: { lat: 16.5062, lng: 80.648 },
    },
    date: "2026-10-13",
    slot: "10:00-12:00",
    status: "en_route",
    paymentStatus: "PAID",
    partnerId: "p1",
    partner: {
      name: "Ravi Kumar",
      rating: 4.6,
      ratingCount: 12,
      phone: "+919999999999",
      verified: true,
    },
    statusHistory: [],
    startOtp: null,
    service: null,
    extraCharges: [],
    extraChargesApprovedTotal: 0,
    ...over,
  }) as unknown as BookingDetailView;

const snapshot = (
  over: Record<string, unknown> = {},
  location: Record<string, unknown> = {},
) =>
  ({
    ok: true,
    snapshot: {
      bookingId: ID,
      status: "en_route",
      partnerAssigned: true,
      location: {
        sharing: true,
        lat: 16.5287, // about 2.5 km from the address
        lng: 80.648,
        accuracy: 8,
        heading: null,
        updatedAt: nowIso(),
        ...location,
      },
      ...over,
    },
  }) as TrackingJoinAck;

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/customer/bookings/${ID}/track`]}>
        <Routes>
          <Route
            path="/customer/bookings/:id/track"
            element={<TrackingPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fake.socket.connected = true;
  fake.socket.emitted = [];
  fake.socket.joins = 0;
  fake.socket.handlers.clear();
  fake.socket.joinReply = () => snapshot();
  getBookingDetail.mockReset();
  getBookingDetail.mockResolvedValue(detail());
});

describe("Tracking page", () => {
  it("joins the tracking room and shows the partner, ETA, map and timeline", async () => {
    renderPage();
    expect(
      await screen.findByText("Your partner is on the way"),
    ).toBeInTheDocument();
    expect(fake.socket.emitted[0]).toEqual([
      "tracking:join",
      { bookingId: ID },
    ]);

    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
    expect(screen.getByText(/Partner ID: PX/)).toBeInTheDocument();
    expect(screen.getByText(/About 6 min away/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Call Ravi Kumar" }),
    ).toHaveAttribute("href", "tel:+919999999999");
    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-partner",
      "16.5287,80.648",
    );
    expect(screen.getByTestId("map")).toHaveAttribute("data-stale", "false");

    const steps = within(
      screen.getByRole("list", { name: "Booking progress" }),
    ).getAllByRole("listitem");
    expect(
      steps.map((li) =>
        li.textContent?.replace(/\s+/g, " ").replace(/ — .*/, ""),
      ),
    ).toEqual([
      expect.stringContaining("Confirmed"),
      expect.stringContaining("Assigned"),
      expect.stringContaining("En Route"),
      expect.stringContaining("Arrived"),
      expect.stringContaining("In Progress"),
      expect.stringContaining("Completed"),
    ]);
    expect(steps[2]).toHaveAttribute("aria-current", "step");
  });

  it("shows 'Live location unavailable' and the latest status when no location exists", async () => {
    fake.socket.joinReply = () =>
      snapshot({}, { sharing: false, lat: null, lng: null, updatedAt: null });
    renderPage();
    expect(
      await screen.findByText("Live location unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/Latest status: En Route/).length,
    ).toBeGreaterThan(0);
    // the address is still on the map
    expect(screen.getByTestId("map")).toHaveAttribute("data-partner", "");
    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-destination",
      "yes",
    );
  });

  it("shows 'Live location unavailable' with the last known location and status once sharing has stopped", async () => {
    fake.socket.joinReply = () => snapshot({}, { sharing: false });
    renderPage();
    expect(
      await screen.findByText("Live location unavailable"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Showing the last known location\./),
    ).toBeInTheDocument();
    expect(screen.getByText(/Latest status: En Route/)).toBeInTheDocument();
    expect(screen.getByTestId("map")).toHaveAttribute("data-stale", "true");
    // the side card is no longer green "live"; it says the position is the last known one
    expect(screen.getByText("Last known location")).toBeInTheDocument();
  });

  it("falls back to 'Live location unavailable' when a sharing partner's fix goes stale", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    fake.socket.joinReply = () =>
      snapshot({}, { sharing: true, updatedAt: tenMinutesAgo });
    renderPage();
    expect(
      await screen.findByText("Live location unavailable"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("map")).toHaveAttribute("data-stale", "true");
  });

  it("switches to the fallback when a tracking:location event says sharing stopped", async () => {
    renderPage();
    await screen.findByText("Your partner is on the way");
    expect(
      screen.queryByText("Live location unavailable"),
    ).not.toBeInTheDocument();
    act(() =>
      fake.socket.fire("tracking:location", {
        bookingId: ID,
        sharing: false,
        lat: 16.5287,
        lng: 80.648,
        accuracy: 8,
        heading: null,
        updatedAt: nowIso(),
      }),
    );
    expect(
      await screen.findByText("Live location unavailable"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("map")).toHaveAttribute("data-stale", "true");
  });

  it("refuses to show tracking when the server denies the join", async () => {
    fake.socket.joinReply = () => ({ ok: false, code: "RESOURCE_FORBIDDEN" });
    renderPage();
    expect(
      await screen.findByText(
        "Live tracking isn't available for this booking.",
      ),
    ).toBeInTheDocument();
  });

  it("moves the timeline and headline when a status event arrives", async () => {
    renderPage();
    await screen.findByText("Your partner is on the way");
    act(() =>
      fake.socket.fire("tracking:status", {
        bookingId: ID,
        status: "arrived",
        at: nowIso(),
      }),
    );
    expect(
      await screen.findByText("Your partner has arrived"),
    ).toBeInTheDocument();
    const steps = within(
      screen.getByRole("list", { name: "Booking progress" }),
    ).getAllByRole("listitem");
    expect(steps[3]).toHaveAttribute("aria-current", "step");
  });

  it("moves the partner marker on a location event and ignores other bookings", async () => {
    renderPage();
    await screen.findByText("Your partner is on the way");
    act(() =>
      fake.socket.fire("tracking:location", {
        bookingId: "someone-elses",
        sharing: true,
        lat: 1,
        lng: 1,
        accuracy: null,
        heading: null,
        updatedAt: nowIso(),
      }),
    );
    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-partner",
      "16.5287,80.648",
    );
    act(() =>
      fake.socket.fire("tracking:location", {
        bookingId: ID,
        sharing: true,
        lat: 16.5101,
        lng: 80.648,
        accuracy: 5,
        heading: 90,
        updatedAt: nowIso(),
      }),
    );
    expect(screen.getByTestId("map")).toHaveAttribute(
      "data-partner",
      "16.5101,80.648",
    );
  });

  it("re-joins and refreshes from the snapshot after a reconnect", async () => {
    renderPage();
    await screen.findByText("Your partner is on the way");
    expect(fake.socket.joins).toBe(1);

    fake.socket.connected = false;
    act(() => fake.socket.fire("disconnect"));
    expect(
      await screen.findByText(/Reconnecting to live updates/),
    ).toBeInTheDocument();
    // the last data stays on screen while reconnecting
    expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();

    fake.socket.joinReply = () =>
      snapshot({ status: "arrived" }, { lat: 16.5062, lng: 80.648 });
    fake.socket.connected = true;
    act(() => fake.socket.fire("connect"));
    expect(fake.socket.joins).toBe(2);
    expect(
      await screen.findByText("Your partner has arrived"),
    ).toBeInTheDocument();
    expect(screen.getByText("Live updates are on.")).toBeInTheDocument();
  });

  it("opens the customer's chat beside the timeline and focuses it from the Chat button", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Your partner is on the way");
    expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Chat" }));
    expect(screen.getByTestId("chat")).toHaveTextContent(`${ID}:customer`);
    await waitFor(() =>
      expect(
        screen.getByRole("region", { name: "Chat with Partner" }),
      ).toHaveFocus(),
    );
  });

  it("explains that tracking starts after assignment and shows no map", async () => {
    getBookingDetail.mockResolvedValue(
      detail({
        status: "searching_for_partner",
        partnerId: undefined,
        partner: null,
      }),
    );
    fake.socket.joinReply = () =>
      snapshot(
        { status: "searching_for_partner", partnerAssigned: false },
        { sharing: false, lat: null, lng: null, updatedAt: null },
      );
    renderPage();
    expect(
      await screen.findByText(
        /Live tracking starts once a partner is assigned/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("map")).not.toBeInTheDocument();
    expect(screen.queryByTestId("chat")).not.toBeInTheDocument();
  });

  it("shows a not-found state for a booking that is not the customer's", async () => {
    getBookingDetail.mockRejectedValue({ status: 404, message: "Not found" });
    renderPage();
    expect(
      await screen.findByText("We couldn't find this booking"),
    ).toBeInTheDocument();
  });

  it("shows an error state with retry when the booking cannot load", async () => {
    getBookingDetail.mockRejectedValue({ status: 400, message: "Bad request" });
    renderPage();
    expect(
      await screen.findByText("Could not load this booking"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Try again" }),
    ).toBeInTheDocument();
  });
});
