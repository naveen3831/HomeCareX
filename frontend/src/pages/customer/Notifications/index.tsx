import { useRef, useState, type KeyboardEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { BellOff, CheckCheck, Trash2 } from "lucide-react";
import clsx from "clsx";
import { EmptyState, ErrorState, OfflineState } from "@/components/customer";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { NOTIFICATIONS_LIMIT, useDeleteAllNotifications, useDeleteNotification, useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from "@/hooks/useNotifications";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { NOTIFICATION_GROUPS, type CustomerNotification, type NotificationGroup } from "@/services/notificationApi";
import { NotificationItem } from "./components/NotificationItem";
import { NotificationsSkeleton } from "./components/NotificationsSkeleton";
import { GROUP_META, dayBucket, isNotificationGroup } from "./notificationModel";

type Tab = "all" | NotificationGroup;
const TABS: ReadonlyArray<Tab> = ["all", ...NOTIFICATION_GROUPS];
const tabLabel = (t: Tab) => (t === "all" ? "All" : GROUP_META[t].label);
const tabId = (t: Tab) => `notif-tab-${t}`;
const PANEL_ID = "notif-panel";
const BUCKETS = ["Today", "Yesterday", "Earlier"] as const;

/**
 * /customer/notifications: the customer's own notifications, filtered by group (Booking / Payment /
 * Partner / Offers / Support / System) and kept live over the socket. The group lives in the URL.
 * Swipe a notification left to delete it; the trash button next to "Mark all as read" deletes them all.
 */
export default function Notifications() {
  const [params, setParams] = useSearchParams();
  const online = useOnlineStatus();
  const rawGroup = params.get("group");
  const group: NotificationGroup | undefined = isNotificationGroup(rawGroup) ? rawGroup : undefined;
  const tab: Tab = group ?? "all";

  const { data, isError, error, refetch } = useNotifications({ group });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const remove = useDeleteNotification();
  const removeAll = useDeleteAllNotifications();
  const [confirmAll, setConfirmAll] = useState(false);
  const [actionError, setActionError] = useState("");
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});

  const update = (patch: { group?: Tab }) => {
    const p = new URLSearchParams(params);
    if (patch.group !== undefined) {
      if (patch.group === "all") p.delete("group");
      else p.set("group", patch.group);
    }
    setParams(p, { replace: true });
  };

  const onMarkRead = (id: string) => {
    setActionError("");
    if (!online) return setActionError("You're offline. Reconnect and try again.");
    markRead.mutate(id, { onError: (e) => setActionError(e.message) });
  };
  const onMarkAll = () => {
    setActionError("");
    if (!online) return setActionError("You're offline. Reconnect and try again.");
    markAll.mutate(undefined, { onError: (e) => setActionError(e.message) });
  };

  const onDelete = (n: CustomerNotification) => {
    setActionError("");
    if (!online) return setActionError("You're offline. Reconnect and try again.");
    remove.mutate(n, { onError: (e) => setActionError(e.message || "Couldn't delete that notification.") });
  };
  const onDeleteAll = () => {
    setActionError("");
    if (!online) return setActionError("You're offline. Reconnect and try again.");
    removeAll.mutate(undefined, {
      onSuccess: () => setConfirmAll(false),
      onError: (e) => setActionError(e.message || "Couldn't delete your notifications."),
    });
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    update({ group: TABS[next] });
    tabRefs.current[TABS[next]]?.focus();
  };

  const totalUnread = data?.unread ?? 0;
  const unreadIn = (t: Tab): number => (!data ? 0 : t === "all" ? data.unread : data.groups[t].unread);

  const retry = () => void refetch();
  let body;
  if (!data) {
    body = !online ? (
      <OfflineState message="Reconnect to see your notifications." onRetry={retry} />
    ) : isError ? (
      <ErrorState title="Couldn't load notifications" message={error?.message} onRetry={retry} />
    ) : (
      <NotificationsSkeleton />
    );
  } else if (data.items.length === 0) {
    const title = group ? `No ${GROUP_META[group].label.toLowerCase()} notifications` : "No notifications yet";
    body = (
      <EmptyState
        icon={BellOff}
        title={title}
        description="Booking updates, payments, offers and support replies will show up here."
      />
    );
  } else {
    const buckets = new Map<string, CustomerNotification[]>();
    for (const n of data.items) {
      const key = dayBucket(n.createdAt);
      buckets.set(key, [...(buckets.get(key) ?? []), n]);
    }
    const listTotal = group ? data.groups[group].total : Object.values(data.groups).reduce((s, g) => s + g.total, 0);
    body = (
      <div className="space-y-5">
        {isError && (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Couldn't refresh just now. Showing what we last loaded.{" "}
            <button type="button" onClick={retry} className={clsx("font-semibold underline", FOCUS_RING)}>Retry</button>
          </p>
        )}
        {BUCKETS.filter((b) => buckets.has(b)).map((b) => (
          <section key={b} aria-labelledby={`notif-bucket-${b}`}>
            <h2 id={`notif-bucket-${b}`} className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">{b}</h2>
            <ul className="divide-y divide-line">
              {buckets.get(b)!.map((n) => (
                <NotificationItem key={n.id} notification={n} onMarkRead={onMarkRead} onDelete={onDelete} marking={markRead.isPending && markRead.variables === n.id} />
              ))}
            </ul>
          </section>
        ))}
        {listTotal > NOTIFICATIONS_LIMIT && data.items.length >= NOTIFICATIONS_LIMIT && (
          <p className="text-center text-xs text-muted">Showing your latest {NOTIFICATIONS_LIMIT} notifications.</p>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5">
      {/* One row at every width: title on the left, Mark all as read + bin on the right (never wraps below the title). */}
      <header className="flex flex-nowrap items-start justify-between gap-2 sm:gap-3">
        <div className="min-w-0">
          <h1 className="sr-only">Notifications</h1>
          <p aria-live="polite" className="mt-1 text-sm text-muted">
            {data ? (totalUnread > 0 ? `${totalUnread} unread` : "You're all caught up") : "Booking updates, payments, offers and support replies."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onMarkAll}
            disabled={totalUnread === 0 || markAll.isPending}
            className={clsx("inline-flex min-h-[40px] items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-panel px-3 text-xs font-semibold text-ink transition-colors hover:bg-canvas sm:min-h-[44px] sm:gap-2 sm:px-5 sm:text-sm disabled:cursor-not-allowed disabled:opacity-50", FOCUS_RING)}
          >
            <CheckCheck aria-hidden="true" className="h-4 w-4" />
            {markAll.isPending ? "Marking…" : (<><span aria-hidden="true" className="min-[380px]:hidden">Mark all read</span><span className="hidden min-[380px]:inline">Mark all read</span></>)}
          </button>
          <button
            type="button"
            onClick={() => setConfirmAll((v) => !v)}
            disabled={!data || data.items.length === 0 || removeAll.isPending}
            aria-label="Delete all notifications"
            aria-expanded={confirmAll}
            title="Delete all notifications"
            className={clsx("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-panel text-danger sm:h-11 sm:w-11 transition-colors hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50", FOCUS_RING)}
          >
            <Trash2 aria-hidden="true" className="h-[18px] w-[18px]" />
          </button>
        </div>
      </header>

      {confirmAll && (
        <div role="alertdialog" aria-labelledby="notif-delete-all-title" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3">
          <p id="notif-delete-all-title" className="text-sm font-semibold text-danger">Delete all your notifications? This can&apos;t be undone.</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmAll(false)} disabled={removeAll.isPending} className={clsx("min-h-[40px] rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink", FOCUS_RING)}>
              No, keep them
            </button>
            <button type="button" onClick={onDeleteAll} disabled={removeAll.isPending} className={clsx("min-h-[40px] rounded-full bg-danger px-4 text-sm font-semibold text-white disabled:opacity-60", FOCUS_RING)}>
              {removeAll.isPending ? "Deleting…" : "Yes, delete all"}
            </button>
          </div>
        </div>
      )}

      {actionError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</p>}

      {/* Group tabs scroll sideways inside this strip on phones; the page itself never does. */}
      <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div role="tablist" aria-label="Notification groups" className="flex min-w-max gap-1 border-b border-line">
          {TABS.map((t, i) => {
            const selected = tab === t;
            const n = unreadIn(t);
            return (
              <button
                key={t}
                ref={(el) => { tabRefs.current[t] = el; }}
                id={tabId(t)}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={PANEL_ID}
                aria-label={n > 0 ? `${tabLabel(t)}, ${n} unread` : tabLabel(t)}
                tabIndex={selected ? 0 : -1}
                onClick={() => update({ group: t })}
                onKeyDown={(e) => onTabKey(e, i)}
                className={clsx("-mb-px flex min-h-[46px] items-center gap-1.5 border-b-2 px-3 text-sm font-medium transition-colors", selected ? "border-brand text-brand" : "border-transparent text-muted hover:text-ink", FOCUS_RING)}
              >
                {tabLabel(t)}
                {n > 0 && (
                  <span aria-hidden="true" className="min-w-[20px] rounded-full bg-brand px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-white">
                    {n > 99 ? "99+" : n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(tab)} tabIndex={-1}>
        {body}
      </div>
    </div>
  );
}
