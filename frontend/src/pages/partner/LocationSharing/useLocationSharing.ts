import { useCallback, useEffect, useRef, useState } from 'react';
import { getErrorMessage, getHttpStatus } from '../JobDetails/jobDetails.api';
import { fetchLocation, sendLocation, stopLocation, type Fix } from './locationSharing.api';

/** The browser reports positions far more often than the customer needs them. */
export const SEND_INTERVAL_MS = 10_000;

export type LoadState = 'loading' | 'ready' | 'notfound' | 'error';
export type GeoProblem = 'denied' | 'unavailable' | 'unsupported';

export interface Coords {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export function useLocationSharing(jobId: string) {
  const [load, setLoad] = useState<LoadState>('loading');
  const [loadMessage, setLoadMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [sharing, setSharing] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [geoProblem, setGeoProblem] = useState<GeoProblem | null>(null);
  const [sendProblem, setSendProblem] = useState<string | null>(null);
  /** The server refused updates because the job is no longer active. */
  const [ended, setEnded] = useState(false);

  const watchId = useRef<number | null>(null);
  const timer = useRef<number | null>(null);
  const latest = useRef<Fix | null>(null);
  const dirty = useRef(false);
  const flight = useRef<Promise<void> | null>(null);

  const haltWatcher = useCallback(() => {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  /** Sends the newest unsent fix. Never overlaps itself and never runs offline. */
  const flush = useCallback((): Promise<void> => {
    const fix = latest.current;
    if (!fix || !dirty.current || flight.current || !navigator.onLine) return Promise.resolve();
    dirty.current = false;
    const run = (async () => {
      try {
        const saved = await sendLocation(jobId, fix);
        setLastUpdated(saved.updatedAt);
        setSendProblem(null);
      } catch (err) {
        const status = getHttpStatus(err);
        if (status === 409) {
          haltWatcher();
          setSharing(false);
          setEnded(true);
        } else if (status === 403 || status === 404) {
          haltWatcher();
          setSharing(false);
          setLoad('notfound');
        } else {
          dirty.current = true; // try again on the next tick (covers 429 and network blips)
          if (status !== 429) setSendProblem(getErrorMessage(err, 'Could not send your location. Retrying…'));
        }
      } finally {
        flight.current = null;
      }
    })();
    flight.current = run;
    return run;
  }, [jobId, haltWatcher]);

  const begin = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoProblem('unsupported');
      return;
    }
    if (watchId.current !== null) return;
    setGeoProblem(null);
    setEnded(false);
    setSharing(true);

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: Fix = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
        const heading = pos.coords.heading;
        if (typeof heading === 'number' && Number.isFinite(heading) && heading >= 0) fix.heading = heading;
        const isFirst = latest.current === null;
        latest.current = fix;
        dirty.current = true;
        setGeoProblem(null);
        setCoords({ lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy ?? null });
        if (isFirst) void flush(); // show "last updated" straight away, then every SEND_INTERVAL_MS
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          haltWatcher();
          setSharing(false);
          setGeoProblem('denied');
        } else {
          setGeoProblem('unavailable');
        }
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    timer.current = window.setInterval(() => void flush(), SEND_INTERVAL_MS);
  }, [flush, haltWatcher]);

  useEffect(() => {
    let cancelled = false;
    setLoad('loading');
    fetchLocation(jobId)
      .then((s) => {
        if (cancelled) return;
        setLastUpdated(s.updatedAt);
        if (s.lat !== null && s.lng !== null) setCoords({ lat: s.lat, lng: s.lng, accuracy: s.accuracy });
        setLoad('ready');
        if (s.sharing) begin(); // sharing was already on (page reload): pick the watcher back up
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = getHttpStatus(err);
        if (status === 403 || status === 404) {
          setLoad('notfound'); // another partner's job looks the same as a missing one
        } else {
          setLoadMessage(getErrorMessage(err, 'Could not load location sharing.'));
          setLoad('error');
        }
      });
    return () => {
      cancelled = true;
      haltWatcher();
      latest.current = null;
      dirty.current = false;
    };
  }, [jobId, reloadKey, begin, haltWatcher]);

  const stop = useCallback(async () => {
    setStopping(true);
    haltWatcher();
    await flight.current; // an in-flight update must not land after the stop and switch sharing back on
    try {
      const saved = await stopLocation(jobId);
      setSharing(false);
      setSendProblem(null);
      if (saved.updatedAt) setLastUpdated(saved.updatedAt);
      latest.current = null;
    } catch (err) {
      setSendProblem(getErrorMessage(err, 'Could not stop sharing. Please try again.'));
      begin(); // the server still thinks we are sharing, so keep going rather than lie in the UI
    } finally {
      setStopping(false);
    }
  }, [jobId, haltWatcher, begin]);

  return {
    load,
    loadMessage,
    sharing,
    stopping,
    coords,
    lastUpdated,
    geoProblem,
    sendProblem,
    ended,
    start: begin,
    stop,
    reload: () => setReloadKey((k) => k + 1),
  };
}