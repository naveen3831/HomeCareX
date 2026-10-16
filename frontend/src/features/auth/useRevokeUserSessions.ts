import { useCallback, useState } from "react";
import { authApi } from "@/services/authApi";
import { normalizeApiError, type NormalizedApiError } from "@/services/bookingApi";

export interface UseRevokeUserSessionsResult {
  revokeUserSessions: (userId: string) => Promise<void>;
  loading: boolean;
  isPending: boolean;
  error: NormalizedApiError | null;
  isSuccess: boolean;
  reset: () => void;
}

/**
 * Admin-only hook to revoke all active sessions for a specified user via POST /auth/revoke-user-sessions/:userId.
 */
export function useRevokeUserSessions(): UseRevokeUserSessionsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  const revokeUserSessions = useCallback(
    async (userId: string) => {
      if (!userId || !userId.trim()) {
        const validationErr: NormalizedApiError = {
          status: 400,
          code: "INVALID_USER_ID",
          message: "A valid user ID is required to revoke sessions.",
        };
        setError(validationErr);
        throw validationErr;
      }

      if (loading) {
        throw new Error("A revocation request is already in progress.");
      }

      setLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        await authApi.revokeUserSessions(userId.trim());
        setIsSuccess(true);
      } catch (err: unknown) {
        const normalized = normalizeApiError(err);
        setError(normalized);
        throw normalized;
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  return {
    revokeUserSessions,
    loading,
    isPending: loading,
    error,
    isSuccess,
    reset,
  };
}

export default useRevokeUserSessions;
