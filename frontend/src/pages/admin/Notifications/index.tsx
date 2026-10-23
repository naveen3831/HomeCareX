import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, BellRing, CalendarPlus, CheckCheck, ChevronRight, CircleDollarSign, LifeBuoy, RefreshCw, XCircle, type LucideIcon } from 'lucide-react';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { isSos, type AdminNotification } from '@/services/adminNotificationApi';

const META: Record<string, { title: string; Icon: LucideIcon; tone: string }> = {
  'sos.alert': { title: 'SOS alert', Icon: AlertTriangle, tone: 'bg-red-100 text-red-600' },
  'booking.created': { title: 'New booking', Icon: CalendarPlus, tone: 'bg-indigo-100 text-indigo-600' },
  'booking.cancelled': { title: 'Booking cancelled', Icon: XCircle, tone: 'bg-amber-100 text-amber-600' },
  'ticket.reply': { title: 'New ticket reply', Icon: LifeBuoy, tone: 'bg-sky-100 text-sky-600' },
  'refund.updated': { title: 'Refund updated', Icon: CircleDollarSign, tone: 'bg-emerald-100 text-emerald-600' },
  'payment.failed': { title: 'Payment failed', Icon: CircleDollarSign, tone: 'bg-red-100 text-red-600' },
};
const metaOf = (type: string) =>
  META[type] ?? { title: type.replace(/[._]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), Icon: Bell, tone: 'bg-gray-100 text-gray-600' };

function ago(iso: string): string {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 1) return 'Just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

type Filter = 'all' | 'unread' | 'sos';

/** Full notifications list: live, filterable, mark one / all read. SOS rows are red and listed first. */
export const AdminNotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { items, unread, loading, error, refresh, read, readAll } = useAdminNotifications(100);
  const [filter, setFilter] = useState<Filter>('all');

  const shown = useMemo(() => {
    const list = items.filter((n) => (filter === 'unread' ? !n.readAt : filter === 'sos' ? isSos(n) : true));
    const rank = (n: AdminNotification) => Number(isSos(n) && !n.readAt);
    return [...list].sort((a, b) => rank(b) - rank(a));
  }, [items, filter]);

  const open = (n: AdminNotification) => {
    void read(n.id);
    const p = n.payload ?? {};
    if (typeof p.ticketId === 'string') navigate('/admin/support');
    else if (typeof p.bookingId === 'string' && !p.bookingId.startsWith('demo')) navigate('/admin/bookings');
  };

  const sosCount = items.filter(isSos).length;
  const tabs: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: items.length },
    { id: 'unread', label: 'Unread', count: unread },
    { id: 'sos', label: 'SOS', count: sosCount },
  ];
  const stats = [
    { label: 'Total', value: items.length, Icon: Bell, tone: 'bg-indigo-50 text-indigo-600' },
    { label: 'Unread', value: unread, Icon: BellRing, tone: 'bg-amber-50 text-amber-600' },
    { label: 'SOS alerts', value: sosCount, Icon: AlertTriangle, tone: 'bg-red-50 text-red-600' },
  ];

  return (
    <div className="admin-page-container min-w-0 max-w-full space-y-5 !p-4 sm:!p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            {unread > 0 ? `${unread} unread — everything that needs your attention.` : 'You’re all caught up.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void readAll()}
          disabled={unread === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCheck size={16} aria-hidden="true" /> Mark all read
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {stats.map(({ label, value, Icon, tone }) => (
          <div key={label} className="flex min-w-0 flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:gap-4 sm:p-4">
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${tone}`}><Icon size={18} aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-xl font-bold leading-none text-slate-900 sm:text-2xl">{value}</p>
              <p className="mt-1 truncate text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div role="tablist" aria-label="Filter notifications" className="flex gap-1 border-b border-slate-100 bg-slate-50/70 p-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={filter === t.id}
              onClick={() => setFilter(t.id)}
              className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition sm:flex-none sm:px-5 ${
                filter === t.id ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
              <span className={`rounded-full px-1.5 text-xs ${filter === t.id ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-200 text-slate-500'}`}>{t.count}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-px" aria-busy="true">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse bg-slate-100/70" />)}
          </div>
        ) : error && items.length === 0 ? (
          <div role="alert" className="m-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Couldn’t load notifications.
            <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 font-medium shadow-sm">
              <RefreshCw size={14} aria-hidden="true" /> Retry
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400"><Bell size={24} aria-hidden="true" /></span>
            <p className="text-sm font-semibold text-slate-700">Nothing here</p>
            <p className="text-xs text-slate-500">{filter === 'all' ? 'New alerts will show up here live.' : 'No notifications match this filter.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map((n) => {
              const { title, Icon, tone } = metaOf(n.type);
              const sos = isSos(n);
              const message = typeof n.payload?.message === 'string' ? n.payload.message : null;
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => open(n)}
                    className={`group relative flex w-full items-start gap-3 px-4 py-4 text-left transition hover:bg-slate-50 sm:items-center sm:gap-4 sm:px-6 ${
                      sos && !n.readAt ? 'bg-red-50/70 hover:bg-red-50' : !n.readAt ? 'bg-indigo-50/40' : ''
                    }`}
                  >
                    {!n.readAt && <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${sos ? 'bg-red-500' : 'bg-indigo-500'}`} />}
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className={`text-sm ${n.readAt ? 'font-medium text-slate-700' : 'font-semibold text-slate-900'}`}>{title}</span>
                        {sos && !n.readAt && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Urgent</span>}
                      </span>
                      {message && <span className="mt-0.5 block break-words text-sm text-slate-600">{message}</span>}
                      <span className="mt-1 block text-xs text-slate-400 sm:hidden">{ago(n.createdAt)}</span>
                    </span>
                    <span className="hidden shrink-0 text-xs font-medium text-slate-400 sm:block">{ago(n.createdAt)}</span>
                    {!n.readAt && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500 sm:mt-0" aria-label="Unread" />}
                    <ChevronRight size={16} aria-hidden="true" className="hidden shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500 sm:block" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AdminNotificationsPage;
