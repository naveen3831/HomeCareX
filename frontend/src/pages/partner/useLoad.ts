import { useCallback, useEffect, useRef, useState } from "react";
import { classifyApiError, type ClassifiedApiError } from "@/lib/apiError";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export type LoadStatus = "loading" | "ready" | "error" | "offline";

export interface LoadResult<T> {
  status: LoadStatus;
  data: T | null;
  error: ClassifiedApiError | null;
  reload: () => void;
  setData: (next: T) => void;
}

/**
 * Loads one resource and exposes loading / ready / error / offline states so a page never renders blank.
 * Retries by itself when the browser comes back online after a failed load.
 */
export function useLoad<T>(load: () => Promise<T>): LoadResult<T> {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ClassifiedApiError | null>(null);
  const online = useOnlineStatus();
  const loadRef = useRef(load);
  loadRef.current = load;
  const alive = useRef(true);

  const run = useCallback(() => {
    setStatus("loading");
    setError(null);
    loadRef
      .current()
      .then((value) => {
        if (!alive.current) return;
        setData(value);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!alive.current) return;
        const classified = classifyApiError(err);
        setError(classified);
        setStatus(classified.kind === "offline" ? "offline" : "error");
      });
  }, []);

  useEffect(() => {
    alive.current = true;
    run();
    return () => {
      alive.current = false;
    };
  }, [run]);

  useEffect(() => {
    if (
      online &&
      (status === "offline" ||
        (status === "error" && error?.kind === "network"))
    )
      run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  return { status, data, error, reload: run, setData };
}
