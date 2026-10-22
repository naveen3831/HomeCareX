import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/services/authApi";
import { normalizeApiError, type NormalizedApiError } from "@/services/bookingApi";

export interface UseLogoutAllResult {
  logoutAll: () => Promise<void>;
  loading: boolean;
  error: NormalizedApiError | null;
}

export function useLogoutAll(): UseLogoutAllResult {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const inFlight = useRef(false);

  const logoutAll = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    setError(null);
    try {
      await authApi.logoutAll();
    } catch (err: unknown) {
      const normalized = normalizeApiError(err);
      setError(normalized);
      inFlight.current = false;
      setLoading(false);
      throw normalized; // no logout, no redirect on failure
    }

    // Server sessions are gone; clear local auth even if the server-side logout call now 401s.
    try {
      await logout();
    } catch {
      /* already revoked server-side */
    }
    inFlight.current = false;
    setLoading(false);
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  return { logoutAll, loading, error };
}

export default useLogoutAll;