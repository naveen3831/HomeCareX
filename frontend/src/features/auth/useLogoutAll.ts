import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/services/authApi";
import { useAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/services/bookingApi";

export interface UseLogoutAllResult {
  logoutAll: () => Promise<void>;
  loading: boolean;
  isPending: boolean;
  error: NormalizedApiError | null;
  reset: () => void;
}

/**
 * Shared hook to log out from all devices via POST /auth/logout-all.
 * On confirmed server success, clears local authentication state and redirects to /login.
 * Never falsely clears state or claims success if the server request failed (unless 401).
 */
export function useLogoutAll(): UseLogoutAllResult {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const logoutAll = useCallback(async () => {
    if (loading) {
      throw new Error("A logout request is already in progress.");
    }

    setLoading(true);
    setError(null);

    try {
      await authApi.logoutAll();

      // Clear local auth session state across AuthProvider, TokenStore, and Zustand authStore
      await logout();

      navigate("/login?logout=all", {
        replace: true,
        state: { flash: "You have been logged out from all devices." },
      });
    } catch (err: unknown) {
      const normalized = normalizeApiError(err);
      setError(normalized);

      // If the session was already expired on the server (401), we can safely clear local state
      if (normalized.status === 401) {
        await logout();
        navigate("/login?expired=1", { replace: true });
        return;
      }

      throw normalized;
    } finally {
      setLoading(false);
    }
  }, [loading, logout, navigate]);

  return {
    logoutAll,
    loading,
    isPending: loading,
    error,
    reset,
  };
}

export default useLogoutAll;
