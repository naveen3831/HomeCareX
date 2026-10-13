import { describe, expect, it } from "vitest";
import {
  distanceKm,
  estimateEtaMinutes,
  formatDistance,
  formatEta,
  mapsDirectionsUrl,
} from "@/pages/partner/Navigation/geo";

describe("navigation geo helpers", () => {
  it("measures straight-line distance", () => {
    expect(
      distanceKm({ lat: 17.385, lng: 78.4867 }, { lat: 17.385, lng: 78.4867 }),
    ).toBe(0);
    // Hyderabad city centre to HITEC City is roughly 12-14 km.
    const km = distanceKm(
      { lat: 17.385, lng: 78.4867 },
      { lat: 17.4435, lng: 78.3772 },
    );
    expect(km).toBeGreaterThan(11);
    expect(km).toBeLessThan(15);
  });

  it("estimates ETA with a road factor and a 1 minute floor", () => {
    expect(estimateEtaMinutes(0)).toBe(1);
    expect(estimateEtaMinutes(10)).toBe(31); // 10 km * 1.3 / 25 km/h
  });

  it("formats distance and ETA", () => {
    expect(formatDistance(0.45)).toBe("450 m");
    expect(formatDistance(3.26)).toBe("3.3 km");
    expect(formatEta(18)).toBe("18 min");
    expect(formatEta(60)).toBe("1 h");
    expect(formatEta(95)).toBe("1 h 35 min");
  });

  it("builds a directions link from coordinates, or from the address when there are none", () => {
    expect(mapsDirectionsUrl({ lat: 17.44, lng: 78.38 }, "ignored")).toContain(
      "destination=17.44,78.38",
    );
    expect(mapsDirectionsUrl(null, "12 MG Road, Hyderabad")).toContain(
      "destination=12%20MG%20Road%2C%20Hyderabad",
    );
  });
});
