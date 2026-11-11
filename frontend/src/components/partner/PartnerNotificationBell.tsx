import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";

import http from "@/lib/http";
import { useT } from "@/i18n/LanguageContext";
import { partnerApi } from "@/services/partnerApi";

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(m) || m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} hours ago`;
  return `${Math.round(m / 1440)} days ago`;
};

/**
 * Bell for the partner top bar: unread badge plus a drop-down with the latest notifications.
 * Uses the same query key as "Recent activity" on the dashboard, so both stay in sync and
 * no extra request is made for the list.
 */
export default function PartnerNotificationBell({ className = "inline-flex" }: { className?: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data = [], isPending, isError, refetch } = useQuery({
    queryKey: ["partner", "notifications"],
    queryFn: () => partnerApi.getNotifications(),
    retry: 1,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const unread = data.filter((n) => !n.read).length;

  const markAll = useMutation({
    mutationFn: () => http.patch("/partner/notifications/read-all"),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["partner", "notifications"] }),
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-label={unread > 0 ? `${t("Notifications")} (${unread} ${t("unread")})` : t("Notifications")}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex min-h-10 min-w-10 items-center justify-center rounded-full p-2 text-orange-500 hover:bg-orange-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4338ca]"
      >
        <Bell size={20} aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("Notifications")}
          className="fixed inset-x-3 top-16 z-40 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-bold text-slate-900">{t("Notifications")}</h2>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markAll.mutate()}
                disabled={markAll.isPending}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 disabled:opacity-50"
              >
                <CheckCheck size={14} aria-hidden="true" />
                {t("Mark all as read")}
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {isPending ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">{t("Loading...")}</p>
            ) : isError ? (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                <p>{t("Couldn't load notifications")}</p>
                <button type="button" onClick={() => void refetch()} className="mt-2 font-semibold text-indigo-700">
                  {t("Try again")}
                </button>
              </div>
            ) : data.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">{t("You're all caught up.")}</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {data.slice(0, 10).map((n) => (
                  <li key={n.id} className={`flex items-start gap-3 px-4 py-3 ${n.read ? "" : "bg-indigo-50/40"}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-300" : "bg-orange-500"}`} />
                    <div className="min-w-0">
                      <p className={`text-sm leading-5 ${n.read ? "text-slate-600" : "font-semibold text-slate-900"}`}>{n.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{ago(n.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}