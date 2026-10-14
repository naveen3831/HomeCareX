import { useCallback, useState } from "react";
import { authApi } from "@/services/authApi";
import { normalizeApiError, type NormalizedApiError } from "@/services/bookingApi";
import type { ChangePasswordInput, ChangePasswordResult } from "@/types/auth";

export interface UseChangePasswordResult {
  changePassword: (input: ChangePasswordInput) => Promise<ChangePasswordResult>;
  loading: boolean;
  isPending: boolean;
  error: NormalizedApiError | null;
  isSuccess: boolean;
  reset: () => void;
}

/**
 * Shared hook to change password via POST /auth/change-password.
 * Handles loading, error normalization, duplicate request prevention, and success state.
 * Never stores sensitive passwords in global state or persistent storage.
 */
export function useChangePassword(): UseChangePasswordResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const reset = useCallback(() => {
    setError(null);
    setIsSuccess(false);
  }, []);

  const changePassword = useCallback(
    async (input: ChangePasswordInput): Promise<ChangePasswordResult> => {
      if (loading) {
        throw new Error("A password change request is already in progress.");
      }

      setLoading(true);
      setError(null);
      setIsSuccess(false);

      try {
        const result = await authApi.changePassword(input);
        setIsSuccess(true);
        return result;
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
    changePassword,
    loading,
    isPending: loading,
    error,
    isSuccess,
    reset,
  };
}

export default useChangePassword;
