import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Star,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";

import ErrorState from "@/components/common/ErrorState";
import Skeleton from "@/components/common/Skeleton";
import {
  ServiceThumb,
  formatClock,
  formatInr,
  isToday,
  useCountdown,
  whenLabel,
  whenRangeLabel,
} from "@/components/partner/jobs/jobUi";
import RejectReasonDialog from "@/components/partner/RejectReasonDialog";
import HelpSafetyCard from "@/components/partner/HelpSafetyCard";
import ServiceAreaBar from "@/components/partner/Serviceareabar";
import { usePartnerStatus } from "@/layouts/PartnerLayout";
import { useAuth } from "@/hooks/useAuth";
import { useJobs } from "@/hooks/useJobs";
import { partnerApi } from "@/services/partnerApi";
import type { PartnerJob } from "@/types/partner";

/**
 * Desktop-only dashboard (shown from 1024px up). The mobile dashboard in
 * ./index.tsx is untouched. Uses the same queries (same cache keys), so it
 * does not add extra requests.
 */

/* ================= helpers ================= */

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const todayLabel = () =>
  new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });

const dateTime = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const time = d
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    .toLowerCase();
  return `${day}, ${time}`;
};

const timeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });

const weekday = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(m) || m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} hours ago`;
  return `${Math.round(m / 1440)} days ago`;
};

const percent = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? null : Math.max(0, Math.min(100, Math.round(v)));

const panel = "rounded-2xl border border-slate-200 bg-white shadow-sm";

/* ================= small pieces ================= */

function Panel({
  title,
  icon,
  action,
  children,
}: {
  title: string;
  icon?: ReactNode;
  action?: { label: string; to: string };
  children: ReactNode;
}) {
  return (
    <section className={`${panel} p-6`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
          {icon}
          {title}
        </h2>
        {action && (
          <Link
            to={action.to}
            className="inline-flex items-center gap-0.5 text-sm font-semibold text-indigo-700 hover:text-indigo-900"
          >
            {action.label}
            <ChevronRight size={15} />
          </Link>
        )}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Kpi({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ReactNode;
  tone: "indigo" | "orange" | "slate";
}) {
  const tones = {
    indigo: "bg-indigo-700 text-white border-indigo-700",
    orange: "bg-orange-50 text-slate-900 border-orange-200",
    slate: "bg-white text-slate-900 border-slate-200",
  } as const;
  const sub1 = tone === "indigo" ? "text-indigo-100" : "text-slate-500";
  const chip = tone === "indigo" ? "bg-white/15 text-white" : tone === "orange" ? "bg-orange-100 text-orange-600" : "bg-indigo-50 text-indigo-700";
  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${tones[tone]}`}>
      <div className="flex items-center justify-between">
        <p className={`text-sm font-medium ${sub1}`}>{label}</p>
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${chip}`}>{icon}</span>
      </div>
      <p className="mt-3 break-words text-2xl font-extrabold tracking-tight">{value}</p>
      {sub && <p className={`mt-1 text-xs ${sub1}`}>{sub}</p>}
    </div>
  );
}

function Meter({ label, value, bar }: { label: string; value: number | null; bar: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-600">{label}</span>
        <span className="font-bold text-slate-900">{value === null ? "No data" : `${value}%`}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined}>
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

/** One incoming request as a wide row: photo, details, timer, reject / accept. */
function RequestRow({
  job,
  busy,
  onAccept,
  onReject,
}: {
  job: PartnerJob;
  busy: boolean;
  onAccept: (id: string) => void;
  onReject: (job: PartnerJob) => void;
}) {
  const seconds = useCountdown(job.expiresAt);
  const hasDeadline = Boolean(job.expiresAt);
  const expired = hasDeadline && seconds <= 0;
  return (
    <article className="flex items-center gap-5 rounded-2xl border-2 border-orange-300 bg-orange-50/40 p-4">
      <div className="flex h-24 w-24 shrink-0">
        <ServiceThumb service={job.service} size="lg" image={job.image} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <h3 className="truncate text-base font-bold text-slate-900">{job.service}</h3>
          <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-[11px] font-bold text-white">New request</span>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm text-slate-600">
          <p className="flex items-center gap-2"><CalendarDays size={15} className="shrink-0 text-slate-400" />{whenRangeLabel(job.scheduledAt)}</p>
          <p className="flex items-center gap-2"><User size={15} className="shrink-0 text-slate-400" />{job.customer}</p>
          <p className="col-span-2 flex items-start gap-2"><MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" />{job.location}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-3">
        {job.amount > 0 && <span className="text-xl font-extrabold text-indigo-700">{formatInr(job.amount)}</span>}
        <span className="flex items-center gap-1.5 text-sm font-bold text-orange-700" role="timer">
          <Clock3 size={15} />
          {!hasDeadline ? "Assigned to you" : expired ? "Expired" : formatClock(seconds)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onReject(job)}
            disabled={busy}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onAccept(job.id)}
            disabled={busy || expired}
            className="rounded-xl bg-orange-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Please wait..." : "Accept"}
          </button>
        </div>
      </div>
    </article>
  );
}

/** Photo-first tile for an active job or the next job. */
function JobTile({ job, live }: { job: PartnerJob; live: boolean }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 pt-4">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${live ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"}`}>
          {live ? "In progress" : "Next job"}
        </span>
        <span className="text-xs text-slate-500">{dateTime(job.scheduledAt)}</span>
      </div>
      <div className="flex flex-1 items-start gap-4 p-4">
        <div className="flex h-24 w-24 shrink-0">
          <ServiceThumb service={job.service} size="lg" image={job.image} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-base font-bold text-slate-900">{job.service}</h3>
            {job.amount > 0 && <span className="shrink-0 font-extrabold text-indigo-700">{formatInr(job.amount)}</span>}
          </div>
          <p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><User size={15} className="shrink-0" />{job.customer}</p>
          <p className="mt-1.5 flex items-start gap-2 text-sm text-slate-500"><MapPin size={15} className="mt-0.5 shrink-0" />{job.location}</p>
        </div>
      </div>
      <Link
        to={live ? `/partner/jobs/${job.id}/active` : `/partner/jobs/${job.id}`}
        className="mx-4 mb-4 flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-indigo-800"
      >
        {live ? "Continue job" : "View job details"}
        <ArrowRight size={16} />
      </Link>
    </article>
  );
}

/* ================= PAGE (desktop) ================= */

export default function DashboardDesktop() {
  const queryClient = useQueryClient();
  const { online } = usePartnerStatus();
  const { user } = useAuth();

  const [accepted, setAccepted] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<PartnerJob | null>(null);
  const bannerTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(bannerTimer.current), []);

  const dashboard = useQuery({
    queryKey: ["partner", "dashboard"],
    queryFn: () => partnerApi.getDashboard(),
    retry: 1,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });
  const summary = useQuery({
    queryKey: ["partner", "earnings-summary"],
    queryFn: () => partnerApi.getEarningsSummary(),
    retry: 1,
    refetchInterval: 30000,
  });
  const notifications = useQuery({
    queryKey: ["partner", "notifications"],
    queryFn: () => partnerApi.getNotifications(),
    retry: 1,
  });
  const requestsQ = useJobs("requests");
  const upcomingQ = useJobs("upcoming");
  const activeQ = useJobs("active");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["partner", "jobs"] });
    void queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["partner", "earnings-summary"] });
    void queryClient.invalidateQueries({ queryKey: ["partner", "notifications"] });
  };

  const acceptMutation = useMutation({
    mutationFn: (id: string) => partnerApi.acceptJob(id),
    onSuccess: () => {
      setAccepted(true);
      window.clearTimeout(bannerTimer.current);
      bannerTimer.current = window.setTimeout(() => setAccepted(false), 8000);
    },
    onSettled: refresh,
  });
  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => partnerApi.rejectJob(id, reason),
    onSuccess: () => setRejectTarget(null),
    onSettled: refresh,
  });

  const data = dashboard.data;
  const requests = requestsQ.data?.jobs ?? [];
  const upcoming = upcomingQ.data?.jobs ?? [];
  const active = activeQ.data?.jobs ?? [];

  const activeIds = useMemo(() => new Set(active.map((j) => j.id)), [active]);
  const todaysJobs = useMemo(
    () =>
      [...active, ...upcoming]
        .filter((j) => isToday(j.scheduledAt))
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [active, upcoming],
  );
  const expectedToday = todaysJobs.filter((j) => !activeIds.has(j.id)).reduce((s, j) => s + j.amount, 0);

  const earn = {
    today: data?.earnings?.today ?? summary.data?.today ?? data?.todayEarnings ?? 0,
    week: data?.earnings?.week ?? summary.data?.week,
    month: data?.earnings?.month ?? summary.data?.month,
    pending: data?.earnings?.pending,
  };
  const days = data?.last7Days ?? [];
  const maxDay = Math.max(1, ...days.map((d) => d.amount));
  const money = (v?: number) => (v === undefined ? "—" : formatInr(v));

  const perf = data?.performance;
  const rating = perf ? perf.rating : data && data.rating > 0 ? data.rating : null;
  const ratingCount = perf?.ratingCount ?? 0;
  const acceptance = percent(perf ? perf.acceptanceRate : data?.acceptanceRate);
  const completion = percent(perf ? perf.completionRate : data?.completionRate);
  const onTime = percent(perf?.onTimeRate);

  const firstName = user?.name?.split(" ")[0] || "Partner";
  const busy = acceptMutation.isPending || rejectMutation.isPending;

  const jobsToShow = active.length > 0 ? active : upcoming[0] ? [upcoming[0]] : [];

  return (
    <div className="hidden w-full min-w-0 pb-10 text-slate-900 lg:block">
      {/* ---------- header ---------- */}
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">{todayLabel()}</p>
        </div>
        <span className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold ${online ? "bg-orange-50 text-orange-700" : "bg-slate-100 text-slate-500"}`}>
          <span className={`h-2 w-2 rounded-full ${online ? "bg-orange-500" : "bg-slate-400"}`} />
          {online ? "You're online" : "You're offline"}
        </span>
      </header>

      <ServiceAreaBar className="mt-4 max-w-md" />

      {/* ---------- notices ---------- */}
      <div className="mt-4 space-y-3 empty:hidden">
        {!online && (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-medium text-orange-800">
            <AlertCircle size={18} className="shrink-0" />
            Go online to receive new job requests.
          </div>
        )}
        {accepted && (
          <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <CheckCircle2 size={18} className="shrink-0" />
            Job accepted. It's now in your upcoming jobs.
          </div>
        )}
        {acceptMutation.isError && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {acceptMutation.error instanceof Error ? acceptMutation.error.message : "Couldn't accept this job."}
          </div>
        )}
      </div>

      <RejectReasonDialog
        open={rejectTarget !== null}
        jobLabel={rejectTarget?.service}
        busy={rejectMutation.isPending}
        error={rejectMutation.isError ? (rejectMutation.error instanceof Error ? rejectMutation.error.message : "Couldn't reject this job.") : null}
        onCancel={() => {
          rejectMutation.reset();
          setRejectTarget(null);
        }}
        onConfirm={(reason) => {
          if (rejectTarget) rejectMutation.mutate({ id: rejectTarget.id, reason });
        }}
      />

      {/* ---------- KPI strip ---------- */}
      <div className="mt-6 grid grid-cols-4 gap-5">
        <Kpi tone="indigo" label="Today's earnings" value={money(earn.today)} sub={expectedToday > 0 ? `${formatInr(expectedToday)} more lined up` : "Earned so far"} icon={<Wallet size={18} />} />
        <Kpi tone="slate" label="This week" value={money(earn.week)} sub="Last 7 days" icon={<TrendingUp size={18} />} />
        <Kpi tone="slate" label="This month" value={money(earn.month)} sub={earn.pending !== undefined ? `${formatInr(earn.pending)} payout pending` : undefined} icon={<Briefcase size={18} />} />
        <Kpi tone="orange" label="Rating" value={rating === null ? "No reviews" : `${rating.toFixed(1)} / 5`} sub={rating !== null && ratingCount > 0 ? `${ratingCount} ${ratingCount === 1 ? "review" : "reviews"}` : undefined} icon={<Star size={18} className="fill-orange-400" />} />
      </div>

      {/* ---------- two columns ---------- */}
      <div className="mt-6 grid grid-cols-12 items-start gap-6">
        {/* LEFT: work */}
        <div className="col-span-8 min-w-0 space-y-6">
          {requestsQ.isPending ? (
            <Skeleton className="h-40 w-full rounded-2xl" />
          ) : requests.length > 0 ? (
            <Panel title={`New requests (${requests.length})`} action={{ label: "All requests", to: "/partner/jobs?tab=requests" }}>
              <div className="space-y-4">
                {requests.slice(0, 3).map((job) => (
                  <RequestRow
                    key={job.id}
                    job={job}
                    busy={busy}
                    onAccept={(id) => acceptMutation.mutate(id)}
                    onReject={(j) => {
                      rejectMutation.reset();
                      setRejectTarget(j);
                    }}
                  />
                ))}
              </div>
            </Panel>
          ) : null}

          {jobsToShow.length > 0 ? (
            <Panel title={active.length > 0 ? "Active jobs" : "Next job"} action={{ label: "All jobs", to: "/partner/jobs" }}>
              <div className="grid grid-cols-2 gap-5">
                {jobsToShow.map((job) => (
                  <JobTile key={job.id} job={job} live={active.length > 0} />
                ))}
              </div>
            </Panel>
          ) : null}

          <Panel title="Today's schedule" action={{ label: "All jobs", to: "/partner/jobs" }}>
            {todaysJobs.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Nothing booked for today.
                {upcoming[0] ? ` Your next job is ${whenLabel(upcoming[0].scheduledAt)}.` : ""}
              </p>
            ) : (
              <ol className="space-y-3">
                {todaysJobs.map((job) => {
                  const live = activeIds.has(job.id);
                  return (
                    <li key={job.id}>
                      <Link
                        to={live ? `/partner/jobs/${job.id}/active` : `/partner/jobs/${job.id}`}
                        className="flex items-center gap-4 rounded-xl border border-slate-100 p-3 transition hover:border-indigo-200 hover:bg-indigo-50/40"
                      >
                        <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700">
                          {timeOnly(job.scheduledAt)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-slate-900">{job.service}</span>
                          <span className="block truncate text-xs text-slate-500">
                            {job.customer}, {job.location}
                          </span>
                        </span>
                        {live && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">In progress</span>}
                        {job.amount > 0 && <span className="shrink-0 text-sm font-bold text-slate-900">{formatInr(job.amount)}</span>}
                        <ChevronRight size={16} className="shrink-0 text-slate-400" />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <HelpSafetyCard bookingId={active[0]?.id ?? null} />
        </div>

        {/* RIGHT: numbers + activity */}
        <div className="col-span-4 min-w-0 space-y-6">
          <Panel title="Last 7 days" action={{ label: "Details", to: "/partner/earnings" }}>
            {days.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">No earnings yet this week.</p>
            ) : (
              <div className="flex h-40 items-end gap-2" role="img" aria-label="Net earnings for the last 7 days">
                {days.map((d, i) => (
                  <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                    <div className="flex w-full flex-1 items-end justify-center">
                      <div
                        title={`${weekday(d.date)}: ${formatInr(d.amount)}`}
                        className={`w-full max-w-9 rounded-t-md ${i === days.length - 1 ? "bg-orange-500" : "bg-indigo-200"}`}
                        style={{ height: `${Math.max(4, (d.amount / maxDay) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-slate-500">{weekday(d.date)}</span>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Performance" action={{ label: "Report", to: "/partner/performance" }}>
            <div className="space-y-4">
              <Meter label="Acceptance" value={acceptance} bar="bg-indigo-600" />
              <Meter label="Completion" value={completion} bar="bg-emerald-500" />
              <Meter label="On time" value={onTime} bar="bg-orange-500" />
            </div>
          </Panel>

          <Panel title="Recent activity">
            {notifications.isPending ? (
              <Skeleton className="h-28" />
            ) : notifications.isError ? (
              <ErrorState title="Couldn't load activity" message={notifications.error.message} onRetry={() => void notifications.refetch()} />
            ) : notifications.data.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">You're all caught up.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notifications.data.slice(0, 6).map((n) => (
                  <li key={n.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-300" : "bg-orange-500"}`} />
                    <div className="min-w-0">
                      <p className={`text-sm leading-5 ${n.read ? "text-slate-600" : "font-semibold text-slate-900"}`}>{n.title}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{ago(n.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}