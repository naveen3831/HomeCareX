import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { authApi } from "@/services/authApi";
import { normalizeApiError, type NormalizedApiError } from "@/services/bookingApi";
import type { UserSession } from "@/types/auth";

export const SESSIONS_QUERY_KEY = ["auth", "sessions"] as const;

export function useSessions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout } = useAuth();

  const query = useQuery<UserSession[], NormalizedApiError>({
    queryKey: SESSIONS_QUERY_KEY,
    queryFn: async () => {
      try {
        return await authApi.getSessions();
      } catch (err: unknown) {
        throw normalizeApiError(err);
      }
    },
  });

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<NormalizedApiError | null>(null);
  const inFlight = useRef(false);

  const revokeSession = useCallback(
    async (sessionId: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setRevokingId(sessionId);
      setRevokeError(null);

      const current = queryClient.getQueryData<UserSession[]>(SESSIONS_QUERY_KEY);
      const wasCurrent = Boolean(current?.find((s) => s.id === sessionId)?.isCurrent);

      try {
        await authApi.revokeSession(sessionId);
      } catch (err: unknown) {
        const normalized = normalizeApiError(err);
        setRevokeError(normalized);
        inFlight.current = false;
        setRevokingId(null);
        throw normalized;
      }

      if (wasCurrent) {
        try {
          await logout();
        } catch {
          /* session already revoked server-side */
        }
        inFlight.current = false;
        setRevokingId(null);
        navigate("/login", { replace: true });
        return;
      }

      await queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });
      inFlight.current = false;
      setRevokingId(null);
    },
    [logout, navigate, queryClient],
  );

  return {
    sessions: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error ?? null,
    refetch: query.refetch,
    revokeSession,
    revokingId,
    isRevoking: revokingId !== null,
    revokeError,
  };
}

export default useSessions;