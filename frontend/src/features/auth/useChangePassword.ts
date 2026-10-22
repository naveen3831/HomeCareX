import { useCallback, useRef, useState } from "react";
import { authApi } from "@/services/authApi";
import { normalizeApiError, type NormalizedApiError } from "@/services/bookingApi";
import type { ChangePasswordInput, ChangePasswordResult } from "@/types/auth";

export interface UseChangePasswordResult {
  changePassword: (input: ChangePasswordInput) => Promise<ChangePasswordResult>;
  loading: boolean;
  error: NormalizedApiError | null;
  reset: () => void;
}

export function useChangePassword(): UseChangePasswordResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const inFlight = useRef(false);

  const reset = useCallback(() => setError(null), []);

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    if (inFlight.current) {
      throw new Error("A password change is already in progress.");
    }
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      return await authApi.changePassword(input);
    } catch (err: unknown) {
      const normalized = normalizeApiError(err);
      setError(normalized);
      throw normalized;
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  return { changePassword, loading, error, reset };
}

export default useChangePassword;