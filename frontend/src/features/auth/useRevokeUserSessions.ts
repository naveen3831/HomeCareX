import { useCallback, useRef, useState } from "react";
import { adminCustomerApi } from "@/services/adminCustomerApi";
import { normalizeApiError, type NormalizedApiError } from "@/services/bookingApi";

export interface UseRevokeUserSessionsResult {
  revokeUserSessions: (userId: string) => Promise<void>;
  loading: boolean;
  isPending: boolean;
  error: NormalizedApiError | null;
  isSuccess: boolean;
  reset: () => void;
}

/** Admin-only: revoke all active sessions for a user via POST /auth/revoke-user-sessions/:userId. */
export function useRevokeUserSessions(): UseRevokeUserSessionsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  const revokeUserSessions = useCallback(async (userId: string) => {
    if (!userId || !userId.trim()) {
      const validationErr: NormalizedApiError = {
        status: 400,
        code: "INVALID_USER_ID",
        message: "A valid user ID is required to revoke sessions.",
      };
      setError(validationErr);
      throw validationErr;
    }
    if (inFlight.current) {
      throw new Error("A revocation request is already in progress.");
    }

    inFlight.current = true;
    setLoading(true);
    setError(null);
    setIsSuccess(false);

    try {
      await adminCustomerApi.revokeUserSessions(userId.trim());
      setIsSuccess(true);
    } catch (err: unknown) {
      const normalized = normalizeApiError(err);
      setError(normalized);
      throw normalized;
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  return { revokeUserSessions, loading, isPending: loading, error, isSuccess, reset };
}

export default useRevokeUserSessions;