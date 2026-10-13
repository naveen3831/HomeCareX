import { useCallback, useEffect, useRef, useState } from "react";
import type { LatLng } from "./geo";

/**
 * Reads the partner's position for the map only: nothing is sent to the server.
 * Used before the job is "on the way", when live sharing is not allowed yet.
 */
export function useLocalPosition() {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);

  const start = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("This browser does not support location.");
      return;
    }
    if (watchId.current !== null) return;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setError(null);
      },
      (err) =>
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission is blocked. Allow it in your browser settings to see your position."
            : "Could not get your location. Move to an open area and try again.",
        ),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }, []);

  useEffect(
    () => () => {
      if (watchId.current !== null)
        navigator.geolocation.clearWatch(watchId.current);
    },
    [],
  );

  return { coords, error, start };
}
