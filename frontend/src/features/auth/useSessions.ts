import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/services/authApi";
import { useAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/services/bookingApi";
import type { UserSession } from "@/types/auth";

export const SESSIONS_QUERY_KEY = ["auth", "sessions"] as const;

export interface UseSessionsResult {
  sessions: UserSession[];
  loading: boolean;
  isLoading: boolean;
  error: NormalizedApiError | null;
  isError: boolean;
  refetch: () => Promise<unknown>;
  revokeSession: (sessionId: string) => Promise<void>;
  revokingId: string | null;
  isRevoking: boolean;
  revokeError: NormalizedApiError | null;
}

/**
 * Shared hook to manage active login sessions via GET /auth/sessions and DELETE /auth/sessions/:id.
 * Tracks loading, error, empty state, and handles current-session revocation by logging out.
 */
export function useSessions(): UseSessionsResult {
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<NormalizedApiError | null>(null);

  const query = useQuery<UserSession[], NormalizedApiError>({
    queryKey: SESSIONS_QUERY_KEY,
    enabled: Boolean(user),
    queryFn: async () => {
      try {
        const data = await authApi.getSessions();
        return Array.isArray(data) ? data : [];
      } catch (err: unknown) {
        throw normalizeApiError(err);
      }
    },
    staleTime: 10_000,
  });

  const revokeSession = useCallback(
    async (sessionId: string) => {
      if (!sessionId || revokingId) return;

      const targetSession = query.data?.find((s) => s.id === sessionId);
      const isCurrentSession = Boolean(targetSession?.isCurrent);

      setRevokingId(sessionId);
      setRevokeError(null);

      try {
        await authApi.revokeSession(sessionId);

        // Optimistically update or refetch
        queryClient.setQueryData<UserSession[]>(SESSIONS_QUERY_KEY, (prev) =>
          prev ? prev.filter((s) => s.id !== sessionId) : [],
        );
        void queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_KEY });

        if (isCurrentSession) {
          await logout();
          navigate("/login?revoked=1", { replace: true, state: { flash: "Your session was revoked. Please log in again." } });
        }
      } catch (err: unknown) {
        const normalized = normalizeApiError(err);
        setRevokeError(normalized);
        throw normalized;
      } finally {
        setRevokingId(null);
      }
    },
    [revokingId, query.data, queryClient, logout, navigate],
  );

  return {
    sessions: query.data ?? [],
    loading: query.isLoading,
    isLoading: query.isLoading,
    error: query.error ?? null,
    isError: query.isError,
    refetch: query.refetch,
    revokeSession,
    revokingId,
    isRevoking: revokingId !== null,
    revokeError,
  };
}

export default useSessions;
