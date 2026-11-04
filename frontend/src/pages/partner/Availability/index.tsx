import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, CalendarDays, ChevronRight, Clock, Power, RefreshCw } from 'lucide-react';
import { Availability, getAvailability } from './availability.api';
import { getSchedule, Schedule as ScheduleData } from '../Schedule/schedule.api';
import { formatTime, todayName } from './time';
import { usePartnerStatus } from '@/layouts/PartnerLayout';
import './Availability.css'; // shared palette variables used by sibling pages

const HORIZON = 30;
const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

const pad = (n: number) => String(n).padStart(2, '0');
const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
};
const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const dayNameOf = (s: string) => DAY_NAMES[new Date(`${s}T00:00:00Z`).getUTCDay()];
const shortDate = (s: string) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const toHours = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return h + (m || 0) / 60;
};
const hoursBetween = (a: string, b: string) => Math.max(0, toHours(b) - toHours(a));
const fmtHrs = (h: number) => (Number.isInteger(h) ? `${h}` : h.toFixed(1));
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const card = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
const bigBtn =
  'flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';

/**
 * Availability, kept simple but friendly: am I online, what are my hours, which days can't I work.
 * Every action is a plain button with a clear label.
 */
export const PartnerAvailabilityPage: React.FC = () => {
  const { online, setOnline } = usePartnerStatus();
  const [data, setData] = useState<Availability | null>(null);
  const [sched, setSched] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const from = todayStr();
      const [avail, schedule] = await Promise.all([
        getAvailability(),
        getSchedule(from, addDays(from, HORIZON - 1)).catch(() => null),
      ]);
      setData(avail);
      setSched(schedule);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const blackoutMap = useMemo(() => {
    const m = new Map<string, string>();
    (sched?.blackoutDates ?? []).forEach((b) => m.set(b.date, b.reason));
    return m;
  }, [sched]);

  // Counts for the next 30 days
  const summary = useMemo(() => {
    if (!data) return null;
    const from = todayStr();
    let work = 0;
    let off = 0;
    let blocked = 0;
    for (let i = 0; i < HORIZON; i++) {
      const date = addDays(from, i);
      if (blackoutMap.has(date)) blocked++;
      else {
        const wd = data.workingHours.find((w) => w.day === dayNameOf(date));
        if (!wd || wd.off) off++;
        else work++;
      }
    }
    return { work, off, blocked: sched ? blocked : null };
  }, [data, sched, blackoutMap]);

  const weekHours = useMemo(
    () => (data ? data.workingHours.filter((d) => !d.off).reduce((s, d) => s + hoursBetween(d.start, d.end), 0) : 0),
    [data],
  );

  if (loading && !data) {
    return (
      <div className="mx-auto w-full max-w-xl space-y-3" aria-busy="true">
        <div className="h-48 animate-pulse rounded-3xl bg-slate-100" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  if (!data || !summary) {
    return (
      <div className="mx-auto w-full max-w-xl">
        <div className={`${card} text-center`} role="alert">
          <p className="text-sm text-slate-700">{error ?? 'No availability found.'}</p>
          <button type="button" onClick={load} className={`${bigBtn} mt-3 bg-indigo-600 text-white hover:bg-indigo-700`}>
            <RefreshCw size={16} aria-hidden="true" /> Try again
          </button>
        </div>
      </div>
    );
  }

  const today = todayStr();
  const todayHours = data.workingHours.find((d) => d.day === todayName());
  const todayBlockedReason = blackoutMap.get(today);
  const workingToday = !!todayHours && !todayHours.off && !todayBlockedReason;
  const nextBlocked = [...blackoutMap.keys()].sort().find((d) => d >= today);
  const total = summary.work + summary.off + (summary.blocked ?? 0);
  const pct = (n: number) => `${total ? (n / total) * 100 : 0}%`;

  const todayText = todayBlockedReason
    ? `Blocked today (${todayBlockedReason})`
    : workingToday && todayHours
      ? `${formatTime(todayHours.start)} – ${formatTime(todayHours.end)}`
      : 'Day off today';

  return (
    <div className="mx-auto w-full max-w-xl space-y-3 pb-6 text-slate-900">
      {error && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {/* 1. Online / offline */}
      <section
        aria-live="polite"
        className={`rounded-2xl border p-4 ${online ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white shadow-sm'}`}
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
              online ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'
            }`}
          >
            <Power size={22} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-500">Your status</p>
            <h2 className="text-lg font-extrabold leading-6">{online ? 'You are Online' : 'You are Offline'}</h2>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-600">
          {online ? 'Customers can book you now.' : "Customers can't see you, so you won't get new jobs."}
        </p>
        <button
          type="button"
          onClick={() => setOnline(!online)}
          className={`${bigBtn} mt-3 ${
            online
              ? 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {online ? 'Go Offline' : 'Go Online'}
        </button>
      </section>

      {/* Today */}
      <section className={card}>
        <p className="text-xs font-semibold text-slate-500">Today you work</p>
        <p className="mt-1 flex items-center gap-2 text-base font-extrabold">
          <Clock size={18} className="shrink-0 text-indigo-600" aria-hidden="true" />
          {todayText}
        </p>
        {workingToday && !online && (
          <p className="mt-2 rounded-lg bg-orange-50 px-3 py-2 text-xs font-medium text-orange-800">
            These are your working hours, but you are offline. Tap Go Online to get jobs.
          </p>
        )}
      </section>

      {/* 2. Working hours */}
      <section className={card}>
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold">My working hours</h3>
          <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700">
            {fmtHrs(weekHours)} hrs / week
          </span>
        </div>

        <ul className="mt-3 space-y-1.5">
          {data.workingHours.map((d) => {
            const isToday = d.day === todayName();
            const hrs = d.off ? 0 : hoursBetween(d.start, d.end);
            return (
              <li
                key={d.day}
                className={`flex items-center gap-3 rounded-xl px-2.5 py-2 ${
                  isToday ? 'bg-indigo-50' : ''
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                    d.off
                      ? 'bg-slate-100 text-slate-400'
                      : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {d.day.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-5 ${isToday ? 'font-bold text-indigo-800' : 'font-semibold text-slate-800'}`}>
                    {cap(d.day)}
                    {isToday && (
                      <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 align-middle text-[10px] font-bold text-indigo-700">
                        TODAY
                      </span>
                    )}
                  </p>
                  <p className={`text-xs ${d.off ? 'text-slate-400' : 'text-slate-600'}`}>
                    {d.off ? 'Day off' : `${formatTime(d.start)} – ${formatTime(d.end)}`}
                  </p>
                </div>
                {!d.off && (
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-bold text-indigo-700 ring-1 ring-indigo-100">
                    {fmtHrs(hrs)}h
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        <Link to="/partner/working-hours" className={`${bigBtn} mt-3 bg-indigo-600 text-white shadow-sm hover:bg-indigo-700`}>
          <Clock size={16} aria-hidden="true" /> Change working hours
        </Link>
      </section>

      {/* 3. Two quick tiles */}
      <section className="grid grid-cols-2 gap-3" aria-label="More options">
        <Link
          to="/partner/blackout-dates"
          className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-orange-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
            <Ban size={18} aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-bold text-slate-900">Days I can't work</p>
          <p className="mt-0.5 text-xs text-slate-600">{nextBlocked ? `Next: ${shortDate(nextBlocked)}` : 'None coming up'}</p>
          <p className="mt-2 flex items-center gap-0.5 text-xs font-bold text-orange-600">
            Add a day off <ChevronRight size={14} aria-hidden="true" />
          </p>
        </Link>

        <Link
          to="/partner/schedule"
          className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
            <CalendarDays size={18} aria-hidden="true" />
          </span>
          <p className="mt-3 text-sm font-bold text-slate-900">My schedule</p>
          <p className="mt-0.5 text-xs text-slate-600">Month view with jobs</p>
          <p className="mt-2 flex items-center gap-0.5 text-xs font-bold text-indigo-700">
            Open <ChevronRight size={14} aria-hidden="true" />
          </p>
        </Link>
      </section>

      {/* 4. Next 30 days */}
      <section className={card}>
        <h3 className="text-base font-bold">Next {HORIZON} days</h3>
        <div
          className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100"
          role="img"
          aria-label={`${summary.work} working, ${summary.off} weekly off, ${summary.blocked ?? 0} blocked`}
        >
          <span className="bg-indigo-600" style={{ width: pct(summary.work) }} />
          <span className="bg-slate-300" style={{ width: pct(summary.off) }} />
          <span className="bg-orange-500" style={{ width: pct(summary.blocked ?? 0) }} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xl font-extrabold text-indigo-700">{summary.work}</p>
            <p className="flex items-center justify-center gap-1 text-xs text-slate-600">
              <i className="h-2 w-2 rounded-full bg-indigo-600" aria-hidden="true" /> Working
            </p>
          </div>
          <div>
            <p className="text-xl font-extrabold text-slate-600">{summary.off}</p>
            <p className="flex items-center justify-center gap-1 text-xs text-slate-600">
              <i className="h-2 w-2 rounded-full bg-slate-300" aria-hidden="true" /> Weekly off
            </p>
          </div>
          <div>
            <p className="text-xl font-extrabold text-orange-600">{summary.blocked ?? '–'}</p>
            <p className="flex items-center justify-center gap-1 text-xs text-slate-600">
              <i className="h-2 w-2 rounded-full bg-orange-500" aria-hidden="true" /> Blocked
            </p>
          </div>
        </div>
        {!sched && <p className="mt-2 text-xs text-slate-500">Blocked days could not be loaded.</p>}
      </section>
    </div>
  );
};

export default PartnerAvailabilityPage;