import { describe, expect, it } from "vitest";
import type { BookingHistoryEntry } from "@/types/booking";
import type { TrackingLocation } from "@/types/tracking";
import {
  STALE_AFTER_MS,
  buildTrackingSteps,
  distanceKm,
  etaMinutes,
  formatAgo,
  formatDistance,
  locationFreshness,
  statusHeadline,
  toPoint,
  trackPath,
} from "../pages/customer/Tracking/trackingModel";

const NOW = Date.parse("2026-10-13T10:10:00.000Z");
const loc = (over: Partial<TrackingLocation> = {}): TrackingLocation => ({
  sharing: true,
  lat: 16.5,
  lng: 80.6,
  accuracy: 10,
  heading: null,
  updatedAt: new Date(NOW - 30_000).toISOString(),
  ...over,
});

describe("locationFreshness", () => {
  it("is live while sharing and recent", () => {
    expect(locationFreshness(loc(), NOW)).toBe("live");
  });
  it("is last_known once the partner stops sharing", () => {
    expect(locationFreshness(loc({ sharing: false }), NOW)).toBe("last_known");
  });
  it("is last_known when the fix is older than the stale limit", () => {
    const old = new Date(NOW - STALE_AFTER_MS - 1_000).toISOString();
    expect(locationFreshness(loc({ updatedAt: old }), NOW)).toBe("last_known");
  });
  it("is none without coordinates or without any location", () => {
    expect(locationFreshness(loc({ lat: null, lng: null }), NOW)).toBe("none");
    expect(locationFreshness(null, NOW)).toBe("none");
  });
});

describe("toPoint", () => {
  it("needs both coordinates", () => {
    expect(toPoint(loc())).toEqual({ lat: 16.5, lng: 80.6 });
    expect(toPoint(loc({ lng: null }))).toBeNull();
  });
});

describe("distance and ETA", () => {
  it("measures straight-line km", () => {
    expect(distanceKm({ lat: 16.5, lng: 80.6 }, { lat: 16.5, lng: 80.6 })).toBe(
      0,
    );
    const km = distanceKm(
      { lat: 16.5, lng: 80.6 },
      { lat: 16.5225, lng: 80.6 },
    );
    expect(km).toBeGreaterThan(2.4);
    expect(km).toBeLessThan(2.6);
  });
  it("never reports less than a minute", () => {
    expect(etaMinutes(0)).toBe(1);
    expect(etaMinutes(2.5)).toBe(6);
  });
  it("formats distance", () => {
    expect(formatDistance(0.42)).toBe("420 m");
    expect(formatDistance(3.26)).toBe("3.3 km");
  });
});

describe("formatAgo", () => {
  it("reads naturally", () => {
    expect(formatAgo(new Date(NOW - 20_000).toISOString(), NOW)).toBe(
      "just now",
    );
    expect(formatAgo(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe(
      "5 min ago",
    );
    expect(formatAgo(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe(
      "3 h ago",
    );
    expect(formatAgo(null, NOW)).toBe("");
  });
});

describe("buildTrackingSteps", () => {
  const history: BookingHistoryEntry[] = [
    {
      from: null,
      to: "confirmed",
      at: "2026-10-13T08:00:00.000Z",
      actorRole: "system",
    },
    {
      from: "confirmed",
      to: "assigned",
      at: "2026-10-13T08:05:00.000Z",
      actorRole: "system",
    },
  ] as BookingHistoryEntry[];

  it("has the six steps from the issue, in order", () => {
    expect(buildTrackingSteps("confirmed").map((s) => s.label)).toEqual([
      "Confirmed",
      "Assigned",
      "En Route",
      "Arrived",
      "In Progress",
      "Completed",
    ]);
  });
  it("marks earlier steps done, the current one current, later ones upcoming", () => {
    const steps = buildTrackingSteps("en_route", history);
    expect(steps.map((s) => s.state)).toEqual([
      "done",
      "done",
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(steps[1].at).toBe("2026-10-13T08:05:00.000Z");
  });
  it("treats searching_for_partner as the Confirmed step and is case-insensitive", () => {
    expect(buildTrackingSteps("SEARCHING_FOR_PARTNER")[0].state).toBe(
      "current",
    );
  });
  it("marks everything done when completed", () => {
    expect(
      buildTrackingSteps("completed").every((s) => s.state === "done"),
    ).toBe(true);
  });
  it("shows nothing as reached for an unknown status", () => {
    expect(
      buildTrackingSteps("mystery").every((s) => s.state === "upcoming"),
    ).toBe(true);
  });
});

describe("misc", () => {
  it("builds the tracking route", () => {
    expect(trackPath("abc")).toBe("/customer/bookings/abc/track");
  });
  it("has a headline for every live status", () => {
    expect(statusHeadline("en_route")).toBe("Your partner is on the way");
    expect(statusHeadline("arrived")).toBe("Your partner has arrived");
  });
});
