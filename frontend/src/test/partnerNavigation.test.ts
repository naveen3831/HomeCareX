import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import http from "@/lib/http";
import { sendBookingMessage, normalizeMessage } from "@/services/partner/chatApi";
import { mapJobToNavigation } from "@/services/partner/partnerLocationApi";
import {
  buildGoogleMapsNavigationUrl,
  estimateEtaMinutes,
  formatDistance,
  formatEta,
  haversineKm,
} from "@/pages/partner/Navigation/navigationUtils";
import { validatePhotos, MAX_PHOTOS } from "@/pages/partner/Navigation/components/ChatPanel";
import {
  LOCATION_THROTTLE_MS,
  usePartnerLocation,
} from "@/pages/partner/LocationSharing/usePartnerLocation";
import type { ApiJob } from "@/pages/partner/JobDetails/jobDetails.types";

describe("navigationUtils", () => {
  it("computes haversine distance (Charminar -> Hitec City ~ 14 km)", () => {
    const km = haversineKm({ lat: 17.3616, lng: 78.4747 }, { lat: 17.4435, lng: 78.3772 });
    expect(km).toBeGreaterThan(12);
    expect(km).toBeLessThan(15);
  });

  it("formats distance and ETA", () => {
    expect(formatDistance(0.85)).toBe("850 m");
    expect(formatDistance(3.24)).toBe("3.2 km");
    expect(formatDistance(42.4)).toBe("42 km");
    expect(formatEta(5)).toBe("5 min");
    expect(formatEta(65)).toBe("1 hr 5 min");
    expect(formatEta(120)).toBe("2 hr");
    expect(estimateEtaMinutes(0)).toBe(1);
  });

  it("builds a Google Maps deep link without origin", () => {
    const url = new URL(buildGoogleMapsNavigationUrl({ lat: 17.4, lng: 78.5 })!);
    expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("destination")).toBe("17.4,78.5");
    expect(url.searchParams.get("dir_action")).toBe("navigate");
    expect(url.searchParams.has("origin")).toBe(false);
  });

  it("falls back to the address, and to null when nothing is known", () => {
    const url = new URL(buildGoogleMapsNavigationUrl(null, "12 MG Road, Hyderabad")!);
    expect(url.searchParams.get("destination")).toBe("12 MG Road, Hyderabad");
    expect(buildGoogleMapsNavigationUrl(null, "  ")).toBeNull();
    expect(buildGoogleMapsNavigationUrl({ lat: 999, lng: 0 })).toBeNull();
  });
});

describe("mapJobToNavigation", () => {
  const base = {
    id: "65f0000000000000000abc12",
    status: "en_route",
    customer: { name: "Asha", phone: null },
    location: {
      line1: "12 MG Road",
      area: "Banjara Hills",
      city: "Hyderabad",
      pincode: "500034",
      coordinates: { lat: 17.41, lng: 78.44 },
    },
  } as unknown as ApiJob;

  it("maps the real ApiJob shape", () => {
    const nav = mapJobToNavigation(base);
    expect(nav.customerName).toBe("Asha");
    expect(nav.customerAddress).toBe("12 MG Road, Banjara Hills, Hyderabad, 500034");
    expect(nav.customerLocation).toEqual({ lat: 17.41, lng: 78.44 });
    expect(nav.statusLabel).toBe("On the way");
    expect(nav.jobCode).toBe("#0ABC12"); // last 6 chars of the id, upper-cased
  });

  it("returns null location when coordinates are missing", () => {
    const nav = mapJobToNavigation({ ...base, location: { ...base.location, coordinates: null } });
    expect(nav.customerLocation).toBeNull();
  });
});

describe("chat photos", () => {
  const img = (name: string, size = 1000, type = "image/jpeg") =>
    new File([new Uint8Array(size)], name, { type });

  it("accepts photos, rejects non-images, svg, oversize, and caps the count", () => {
    const ok = validatePhotos([], [img("a.jpg")]);
    expect(ok.files).toHaveLength(1);

    expect(validatePhotos([], [img("a.pdf", 10, "application/pdf")]).problems).toHaveLength(1);
    expect(validatePhotos([], [img("a.svg", 10, "image/svg+xml")]).files).toHaveLength(0);
    expect(validatePhotos([], [img("big.jpg", 6 * 1024 * 1024)]).files).toHaveLength(0);

    const many = Array.from({ length: MAX_PHOTOS + 2 }, (_, i) => img(`p${i}.jpg`));
    const capped = validatePhotos([], many);
    expect(capped.files).toHaveLength(MAX_PHOTOS);
    expect(capped.problems).toHaveLength(1);
  });

  it("REGRESSION: sends photos as real multipart FormData, not JSON", async () => {
    let seen: any;
    http.defaults.adapter = async (config: any) => {
      seen = config;
      return { data: { data: { _id: "m1", text: "hi" } }, status: 200, statusText: "OK", headers: {}, config } as any;
    };
    const saved = await sendBookingMessage("b1", "hi", [img("a.jpg")]);

    expect(seen.data).toBeInstanceOf(FormData);
    expect((seen.data as FormData).getAll("attachments")).toHaveLength(1);
    expect(saved._id).toBe("m1");
  });

  it("normalizes id/body/string attachments", () => {
    const m = normalizeMessage({ id: "9", body: "yo", attachments: ["https://x/y.jpg"] });
    expect(m).toMatchObject({ _id: "9", text: "yo", attachments: [{ url: "https://x/y.jpg" }] });
  });
});

describe("usePartnerLocation throttle", () => {
  let onPos: (p: GeolocationPosition) => void;
  const clearWatch = vi.fn();

  const fix = (lat: number): GeolocationPosition =>
    ({ coords: { latitude: lat, longitude: 78, accuracy: 10 }, timestamp: Date.now() }) as GeolocationPosition;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: (success: typeof onPos) => {
          onPos = success;
          return 7;
        },
        clearWatch,
      },
    });
  });
  afterEach(() => vi.useRealTimers());

  it("applies the first fix immediately, then at most one per 10 s, and cleans up", async () => {
    const patch = vi.spyOn(http, "patch").mockResolvedValue({ data: {} });
    const { result, unmount } = renderHook(() => usePartnerLocation({ jobId: "j1", enabled: true, share: true }));

    await act(async () => onPos(fix(17.1))); // awaits the PATCH round-trip
    expect(result.current.position?.lat).toBe(17.1);
    expect(patch).toHaveBeenCalledTimes(1);

    // Burst of fixes inside the window: ignored.
    act(() => {
      vi.advanceTimersByTime(3000);
      onPos(fix(17.2));
      vi.advanceTimersByTime(3000);
      onPos(fix(17.3));
    });
    expect(result.current.position?.lat).toBe(17.1);
    expect(patch).toHaveBeenCalledTimes(1);

    // After the window: applied and uploaded.
    await act(async () => {
      vi.advanceTimersByTime(LOCATION_THROTTLE_MS);
      onPos(fix(17.4));
    });
    expect(result.current.position?.lat).toBe(17.4);
    expect(patch).toHaveBeenCalledTimes(2);

    unmount();
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it("does not upload when sharing is off", () => {
    const patch = vi.spyOn(http, "patch").mockResolvedValue({ data: {} });
    patch.mockClear();
    const { result } = renderHook(() => usePartnerLocation({ jobId: "j1", enabled: true, share: false }));
    act(() => onPos(fix(17.1)));
    expect(result.current.position?.lat).toBe(17.1);
    expect(patch).not.toHaveBeenCalled();
  });
});
