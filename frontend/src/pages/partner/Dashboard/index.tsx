import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Star,
  User,
} from "lucide-react";

import ErrorState from "@/components/common/ErrorState";
import OfflineState from "@/components/common/OfflineState";
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
import { usePartnerStatus } from "@/layouts/PartnerLayout";
import { useAuth } from "@/hooks/useAuth";
import { useJobs } from "@/hooks/useJobs";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { partnerApi } from "@/services/partnerApi";
import type { PartnerJob } from "@/types/partner";
import DashboardDesktop from "./DashboardDesktop";

/* ================= helpers ================= */

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/** "27 Oct, 8:00 am" */
const dateTime = (iso: string) => {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
  const time = d
    .toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    .toLowerCase();
  return `${day}, ${time}`;
};

const timeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

const weekday = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(m) || m < 1) return "Just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} hours ago`;
  return `${Math.round(m / 1440)} days ago`;
};

/** Rates are 0-100, or null when there is nothing to measure yet. */
const percent = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? null : Math.max(0, Math.min(100, Math.round(v)));

const card = "rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm";

/* ================= small pieces ================= */

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; to: string };
  children: ReactNode;
}) {
  return (
    <section className={card}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
        {action && (
          <Link
            to={action.to}
            className="inline-flex items-center gap-0.5 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
          >
            {action.label}
            <ChevronRight size={15} />
          </Link>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Meter({ label, value, bar }: { label: string; value: number | null; bar: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600">{label}</span>
        <span className="font-bold text-slate-900">{value === null ? "No data" : `${value}%`}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
      >
        <div className={`h-full rounded-full ${bar}`} style={{ width: `${value ?? 0}%` }} />
      </div>
    </div>
  );
}

/** Same card as your screenshot: used for jobs in progress and for the next job. */
function JobCard({ job, live }: { job: PartnerJob; live: boolean }) {
  return (
    <article className={card}>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-xs font-bold ${live ? "text-emerald-600" : "text-indigo-700"}`}>
          {live ? "Job in progress" : "Your next job"}
        </span>
        <span className="text-xs text-slate-500">{dateTime(job.scheduledAt)}</span>
      </div>

      <div className="mt-2.5 flex items-start gap-3">
        <ServiceThumb service={job.service} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold leading-5 text-slate-900">{job.service}</h3>
            {job.amount > 0 && (
              <span className="shrink-0 text-sm font-extrabold text-indigo-700">{formatInr(job.amount)}</span>
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <User size={13} className="shrink-0" />
            <span className="truncate">{job.customer}</span>
          </p>
          <p className="mt-0.5 flex items-start gap-1.5 text-xs text-slate-500">
            <MapPin size={13} className="mt-0.5 shrink-0" />
            <span className="line-clamp-2">{job.location}</span>
          </p>
        </div>
      </div>

      <Link
        to={live ? `/partner/jobs/${job.id}/active` : `/partner/jobs/${job.id}`}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-800"
      >
        {live ? "Continue job" : "View job details"}
        <ArrowRight size={15} />
      </Link>
    </article>
  );
}

function RequestCard({
  job,
  onAccept,
  onReject,
  busy,
}: {
  job: PartnerJob;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  busy: boolean;
}) {
  const seconds = useCountdown(job.expiresAt);
  const expired = seconds <= 0;

  return (
    <article className="rounded-xl border-2 border-orange-300 bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-orange-500 px-2.5 py-0.5 text-xs font-bold text-white">
          New request
        </span>
        <span className="flex items-center gap-1.5 text-xs font-bold text-orange-700" role="timer">
          <Clock3 size={15} />
          {expired ? "Expired" : formatClock(seconds)}
        </span>
      </div>

      <div className="mt-2.5 flex items-start gap-3">
        <ServiceThumb service={job.service} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold leading-5 text-slate-900">{job.service}</h3>
            {job.amount > 0 && (
              <span className="shrink-0 text-sm font-extrabold text-indigo-700">{formatInr(job.amount)}</span>
            )}
          </div>
          <div className="mt-1 space-y-0.5 text-xs text-slate-500">
            <p className="flex items-center gap-1.5">
              <User size={13} className="shrink-0" />
              {job.customer}
            </p>
            <p className="flex items-start gap-1.5">
              <MapPin size={13} className="mt-0.5 shrink-0" />
              {job.location}
            </p>
            <p className="flex items-center gap-1.5">
              <Clock3 size={13} className="shrink-0" />
              {whenRangeLabel(job.scheduledAt)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => onReject(job.id)}
          disabled={busy}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reject
        </button>
        <button
          type="button"
          onClick={() => onAccept(job.id)}
          disabled={busy || expired}
          className="col-span-2 rounded-lg bg-orange-500 px-3 py-2.5 text-sm font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Please wait..." : "Accept job"}
        </button>
      </div>
    </article>
  );
}

/* ================= PAGE ================= */

export default function PartnerDashboard() {
  const queryClient = useQueryClient();
  const { online } = usePartnerStatus();
  const { user } = useAuth();
  const networkOnline = useOnlineStatus();

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

  /* Same source as the Earnings page: used when the dashboard has no earnings block. */
  const summary = useQuery({
    queryKey: ["partner", "earnings-summary"],
    queryFn: () => partnerApi.getEarningsSummary(),
    retry: 1,
    refetchInterval: 30000,
  });

  const requestsQ = useJobs("requests");
  const upcomingQ = useJobs("upcoming");
  const activeQ = useJobs("active");

  const notifications = useQuery({
    queryKey: ["partner", "notifications"],
    queryFn: () => partnerApi.getNotifications(),
    retry: 1,
  });

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

  const pendingRequest = requests[0];
  const extraRequests = Math.max(0, requests.length - 1);

  const activeIds = useMemo(() => new Set(active.map((j) => j.id)), [active]);
  const todaysJobs = useMemo(
    () =>
      [...active, ...upcoming]
        .filter((j) => isToday(j.scheduledAt))
        .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()),
    [active, upcoming],
  );
  const expectedToday = todaysJobs
    .filter((j) => !activeIds.has(j.id))
    .reduce((sum, j) => sum + j.amount, 0);

  /* ---------- money: dashboard ledger first, earnings summary as fallback ---------- */
  const earn = {
    today: data?.earnings?.today ?? summary.data?.today ?? data?.todayEarnings ?? 0,
    week: data?.earnings?.week ?? summary.data?.week,
    month: data?.earnings?.month ?? summary.data?.month,
    pending: data?.earnings?.pending,
  };
  const days = data?.last7Days ?? [];
  const maxDay = Math.max(1, ...days.map((d) => d.amount));
  const money = (v?: number) => (v === undefined ? "—" : formatInr(v));

  /* ---------- performance: new block first, older fields as fallback ---------- */
  const perf = data?.performance;
  const rating = perf ? perf.rating : data && data.rating > 0 ? data.rating : null;
  const ratingCount = perf?.ratingCount ?? 0;
  const acceptance = percent(perf ? perf.acceptanceRate : data?.acceptanceRate);
  const completion = percent(perf ? perf.completionRate : data?.completionRate);
  const onTime = percent(perf?.onTimeRate);

  const firstName = user?.name?.split(" ")[0] || "Partner";

  /* ---------- states ---------- */

  if (!data && !networkOnline) {
    return <OfflineState onRetry={() => void dashboard.refetch()} />;
  }

  if (dashboard.isPending || requestsQ.isPending) {
    return (
      <div className="w-full space-y-4" role="status" aria-label="Loading dashboard">
        <Skeleton className="h-10 w-2/3 rounded-xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (dashboard.isError || !data) {
    return <ErrorState message={dashboard.error?.message} onRetry={() => void dashboard.refetch()} />;
  }

  return (
    <>
    {/* Desktop (1024px+) gets its own layout; the mobile layout below is unchanged. */}
    <DashboardDesktop />
    <main className="mx-auto w-full max-w-3xl min-w-0 space-y-3 pb-6 text-slate-900 lg:hidden">
      {/* ---------- header: greeting and name only (the online switch is in the top bar) ---------- */}
      <h1 className="text-lg font-extrabold tracking-tight sm:text-2xl">
        {greeting()}, {firstName}
      </h1>

      {/* ---------- notices ---------- */}
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

      <RejectReasonDialog
        open={rejectTarget !== null}
        jobLabel={rejectTarget?.service}
        busy={rejectMutation.isPending}
        error={
          rejectMutation.isError
            ? rejectMutation.error instanceof Error
              ? rejectMutation.error.message
              : "Couldn't reject this job."
            : null
        }
        onCancel={() => {
          rejectMutation.reset();
          setRejectTarget(null);
        }}
        onConfirm={(reason) => {
          if (rejectTarget) rejectMutation.mutate({ id: rejectTarget.id, reason });
        }}
      />

      {/* ---------- 1. NEW REQUEST (always first) ---------- */}
      {pendingRequest && (
        <div className="space-y-3">
          <RequestCard
            job={pendingRequest}
            busy={acceptMutation.isPending || rejectMutation.isPending}
            onAccept={(id) => acceptMutation.mutate(id)}
            onReject={() => {
              rejectMutation.reset();
              setRejectTarget(pendingRequest);
            }}
          />
          {extraRequests > 0 && (
            <Link
              to="/partner/jobs/requests"
              className="block rounded-xl bg-orange-50 p-3 text-center text-sm font-semibold text-orange-700 hover:bg-orange-100"
            >
              {extraRequests} more pending {extraRequests === 1 ? "request" : "requests"}
            </Link>
          )}
        </div>
      )}

      {/* ---------- 2. ACTIVE JOBS (or next job) ---------- */}
      {active.length > 0 ? (
        active.map((job) => <JobCard key={job.id} job={job} live />)
      ) : upcoming[0] ? (
        <JobCard job={upcoming[0]} live={false} />
      ) : (
        <section className={card}>
          <p className="text-sm font-bold text-slate-900">No active jobs</p>
          <p className="mt-1 text-sm text-slate-500">
            {online ? "New job requests will appear at the top of this page." : "Go online to start receiving requests."}
          </p>
        </section>
      )}

      {/* ---------- 3. TODAY'S SCHEDULE ---------- */}
      <Section title="Today's schedule" action={{ label: "All jobs", to: "/partner/jobs" }}>
        {todaysJobs.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-4 py-4 text-center text-xs text-slate-500">
            Nothing booked for today.
            {upcoming[0] ? ` Your next job is ${whenLabel(upcoming[0].scheduledAt)}.` : ""}
          </p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {todaysJobs.map((job) => {
              const live = activeIds.has(job.id);
              return (
                <li key={job.id}>
                  <Link
                    to={live ? `/partner/jobs/${job.id}/active` : `/partner/jobs/${job.id}`}
                    className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                  >
                    <span className="flex h-10 w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-indigo-50 text-[11px] font-bold text-indigo-700">
                      {timeOnly(job.scheduledAt)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-slate-900">{job.service}</span>
                      <span className="block truncate text-xs text-slate-500">
                        {job.customer}, {job.location}
                      </span>
                      {live && <span className="text-xs font-semibold text-emerald-600">In progress</span>}
                    </span>
                    {job.amount > 0 && (
                      <span className="shrink-0 text-sm font-bold text-slate-900">{formatInr(job.amount)}</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
        {expectedToday > 0 && (
          <p className="mt-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
            {formatInr(expectedToday)} more lined up for today
          </p>
        )}
      </Section>

      {/* ---------- 3b. SOS + HELP ---------- */}
      <HelpSafetyCard bookingId={active[0]?.id ?? null} />

      {/* ---------- 4. EARNINGS ---------- */}
      <Section title="Earnings" action={{ label: "Details", to: "/partner/earnings" }}>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Today", value: money(earn.today), hot: true },
            { label: "This week", value: money(earn.week), hot: false },
            { label: "This month", value: money(earn.month), hot: false },
          ].map((t) => (
            <div key={t.label} className={`min-w-0 rounded-lg p-2.5 ${t.hot ? "bg-indigo-700 text-white" : "bg-slate-50"}`}>
              <p className={`text-xs ${t.hot ? "text-indigo-100" : "text-slate-500"}`}>{t.label}</p>
              <p className="mt-1 break-words text-sm font-extrabold sm:text-lg">{t.value}</p>
            </div>
          ))}
        </div>

        {earn.pending !== undefined && (
          <p className="mt-2 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-500">Payout pending</span>
            <span className="font-bold text-slate-900">{formatInr(earn.pending)}</span>
          </p>
        )}

        {days.length > 0 && (
          <div className="mt-3 flex h-20 items-end gap-1.5" role="img" aria-label="Net earnings for the last 7 days">
            {days.map((d, i) => (
              <div key={d.date} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
                <div className="flex w-full flex-1 items-end justify-center">
                  <div
                    title={`${weekday(d.date)}: ${formatInr(d.amount)}`}
                    className={`w-full max-w-8 rounded-t-md ${i === days.length - 1 ? "bg-orange-500" : "bg-indigo-200"}`}
                    style={{ height: `${Math.max(4, (d.amount / maxDay) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-slate-500">{weekday(d.date)}</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ---------- 5. PERFORMANCE ---------- */}
      <Section title="Performance" action={{ label: "Report", to: "/partner/performance" }}>
        <div className="flex items-center gap-2.5 rounded-lg bg-orange-50 px-3 py-2">
          <Star size={20} className="shrink-0 fill-orange-400 text-orange-400" />
          <div>
            <p className="text-base font-extrabold text-slate-900">
              {rating === null ? "No reviews yet" : `${rating.toFixed(1)} / 5`}
            </p>
            {rating !== null && ratingCount > 0 && (
              <p className="text-xs text-slate-500">
                {ratingCount} {ratingCount === 1 ? "review" : "reviews"}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 space-y-2.5">
          <Meter label="Acceptance" value={acceptance} bar="bg-indigo-600" />
          <Meter label="Completion" value={completion} bar="bg-emerald-500" />
          <Meter label="On time" value={onTime} bar="bg-orange-500" />
        </div>
      </Section>

      {/* ---------- 6. RECENT ACTIVITY ---------- */}
      <Section title="Recent activity">
        {notifications.isPending ? (
          <Skeleton className="h-28" />
        ) : notifications.isError ? (
          <ErrorState
            title="Couldn't load activity"
            message={notifications.error.message}
            onRetry={() => void notifications.refetch()}
          />
        ) : notifications.data.length === 0 ? (
          <p className="rounded-lg bg-slate-50 px-4 py-4 text-center text-xs text-slate-500">
            You're all caught up.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.data.slice(0, 5).map((n) => (
              <li key={n.id} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-slate-300" : "bg-orange-500"}`} />
                <div className="min-w-0">
                  <p className={`text-sm leading-5 ${n.read ? "text-slate-600" : "font-semibold text-slate-900"}`}>
                    {n.title}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">{ago(n.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
    </>
  );
}