import { useEffect, useRef, useState } from "react";
import http from "@/lib/http";

export const LOCATION_THROTTLE_MS = 10_000;

export interface PartnerLocationPosition {
  lat: number;
  lng: number;
}

export function usePartnerLocation({
  jobId,
  enabled,
  share,
}: {
  jobId: string;
  enabled: boolean;
  share: boolean;
}) {
  const [position, setPosition] = useState<PartnerLocationPosition | null>(null);
  const lastUploadRef = useRef<number>(0);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !("geolocation" in navigator)) return;

    const onPosition = (pos: GeolocationPosition) => {
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };

      if (!share) {
        setPosition(next);
        return;
      }
      const now = Date.now();
      if (now - lastUploadRef.current < LOCATION_THROTTLE_MS) return;
      lastUploadRef.current = now;
      setPosition(next);
      void http.patch(`/partner/jobs/${jobId}/location`, {
        lat: next.lat,
        lng: next.lng,
      });
    };

    watchIdRef.current = navigator.geolocation.watchPosition(onPosition, () => {
      // Intentionally ignored in tests; the hook just tracks the latest valid fix.
    });

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, share, jobId]);

  return { position };
}
