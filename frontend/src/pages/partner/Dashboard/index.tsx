import { useState, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Headset,
  IndianRupee,
  Percent,
  Star,
  ThumbsUp,
  Wallet,
  Wrench,
} from "lucide-react";
import KpiCard from "@/components/partner/KpiCard";
import ActiveJobCard from "@/components/partner/ActiveJobCard";
import JobRequestCard from "@/components/partner/JobRequestCard";
import ErrorState from "@/components/common/ErrorState";
import OfflineState from "@/components/common/OfflineState";
import Skeleton from "@/components/common/Skeleton";
import { usePartnerStatus } from "@/layouts/PartnerLayout";
import { useAuth } from "@/hooks/useAuth";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { partnerApi } from "@/services/partnerApi";
import { getPartnerServices } from "../MyServices/myServices.api";

const greeting = () => {
  const h = new Date().getHours();

  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);

  if (Number.isNaN(m) || m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;

  return `${Math.round(m / 1440)} d ago`;
};

const QUICK_ACTIONS = [
  { label: "Job requests", to: "/partner/work/requests", icon: Briefcase },
  { label: "My services", to: "/partner/services", icon: Wrench },
  { label: "Availability", to: "/partner/availability", icon: CalendarClock },
  { label: "Earnings", to: "/partner/earnings", icon: Wallet },
  { label: "Get support", to: "/partner/support", icon: Headset },
];

const Card = ({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <section className="rounded border border-line bg-panel p-5">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="font-semibold text-ink">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-40 lg:col-span-2" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}

export default function PartnerDashboard() {
  const { online } = usePartnerStatus();
  const { user } = useAuth();
  const networkOnline = useOnlineStatus();
  const [handled, setHandled] = useState<string[]>([]);

  /*
   * Wrap each queryFn in an arrow. React Query passes a context object as the
   * first argument, which would otherwise be received as `partnerId` by
   * partnerApi.getJobRequests(partnerId?).
   */
  const dashboard = useQuery({
    queryKey: ["partner", "dashboard"],
    queryFn: () => partnerApi.getDashboard(),
    retry: 1,
    refetchInterval: 30_000,
  });

  const requests = useQuery({
    queryKey: ["partner", "requests"],
    queryFn: () => partnerApi.getJobRequests(),
    retry: 1,
  });

  const earnings = useQuery({
    queryKey: ["partner", "earnings-summary"],
    queryFn: () => partnerApi.getEarningsSummary(),
    retry: 1,
  });

  const notifications = useQuery({
    queryKey: ["partner", "notifications"],
    queryFn: () => partnerApi.getNotifications(),
    retry: 1,
  });

  const servicesQuery = useQuery({
    queryKey: ["partner", "my-services"],
    queryFn: () => getPartnerServices(),
    retry: 1,
  });

  const data = dashboard.data;

  const assignedServicesList = useMemo(() => {
    if (data?.assignedServices && data.assignedServices.length > 0) {
      return data.assignedServices;
    }
    if (servicesQuery.data) {
      const selected = new Set(servicesQuery.data.selectedIds);
      return servicesQuery.data.approved
        .filter((s) => selected.has(s.id))
        .map((s) => ({ id: s.id, name: s.name }));
    }
    return [];
  }, [data?.assignedServices, servicesQuery.data]);

  const openRequests = (requests.data ?? []).filter(
    (r) => !handled.includes(r.id),
  );

  // TODO(backend): POST /bookings/:id/accept | reject
  const handle = (id: string) => setHandled((h) => [...h, id]);

  let body: ReactNode;

  if (!data && !networkOnline) {
    body = <OfflineState onRetry={() => void dashboard.refetch()} />;
  } else if (dashboard.isPending) {
    body = <DashboardSkeleton />;
  } else if (dashboard.isError || !data) {
    body = (
      <ErrorState
        message={dashboard.error?.message}
        onRetry={() => void dashboard.refetch()}
      />
    );
  } else {
    const scorecard = [
      {
        label: "Rating",
        text: data.rating > 0 ? `${data.rating.toFixed(1)} / 5` : "No ratings yet",
        pct: (data.rating / 5) * 100,
      },
      {
        label: "Acceptance rate",
        text: `${data.acceptanceRate}%`,
        pct: data.acceptanceRate,
      },
      {
        label: "Completion rate",
        text: `${data.completionRate}%`,
        pct: data.completionRate,
      },
    ];

    body = (
      <div className="space-y-6">
        <ActiveJobCard job={data.activeJob} />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {QUICK_ACTIONS.map(({ label, to, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center gap-2 rounded border border-line bg-panel px-3 py-4 text-xs font-medium text-ink transition-colors hover:border-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              <Icon className="h-5 w-5 text-brand" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </div>

        {!online && (
          <p
            className="rounded border border-accent/40 bg-accent-soft px-4 py-2.5 text-sm text-[#9a4a00]"
            role="status"
          >
            You're offline. Go online to receive new job requests.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="New jobs" value={data.newJobs} icon={Briefcase} hint="Waiting for your reply" />
          <KpiCard label="Today's jobs" value={data.todayJobs} icon={CalendarCheck} hint="Scheduled for today" />
          <KpiCard label="Completed" value={data.completedJobs} icon={CheckCircle2} hint="Finished today" />
          <KpiCard label="Today's earnings" value={inr(data.todayEarnings)} icon={IndianRupee} hint="After commission" />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Rating"
            value={data.rating > 0 ? data.rating.toFixed(1) : "–"}
            icon={Star}
            hint={data.rating > 0 ? "Out of 5" : "No ratings yet"}
          />
          <KpiCard label="Acceptance rate" value={`${data.acceptanceRate}%`} icon={ThumbsUp} hint="Requests accepted" />
          <KpiCard label="Completion rate" value={`${data.completionRate}%`} icon={Percent} hint="Jobs completed" />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card
              title="Job requests"
              action={
                <Link to="/partner/work/requests" className="text-sm font-medium text-brand">
                  View all
                </Link>
              }
            >
              {requests.isPending ? (
                <Skeleton className="h-24" />
              ) : requests.isError ? (
                <ErrorState
                  title="Couldn't load requests"
                  message={requests.error.message}
                  onRetry={() => void requests.refetch()}
                />
              ) : openRequests.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  No new requests right now.
                </p>
              ) : (
                <ul className="space-y-3">
                  {openRequests.map((r) => (
                    <JobRequestCard
                      key={r.id}
                      request={r}
                      onAccept={handle}
                      onReject={handle}
                    />
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="Assigned Services"
              action={
                <Link to="/partner/services" className="text-sm font-medium text-brand hover:underline">
                  Manage services
                </Link>
              }
            >
              {servicesQuery.isPending && !data?.assignedServices ? (
                <Skeleton className="h-20" />
              ) : assignedServicesList.length > 0 ? (
                <div>
                  <div className="mb-3 flex items-center justify-between text-xs text-muted">
                    <span>Services currently assigned to your partner account:</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      {assignedServicesList.length} Active
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {assignedServicesList.map((svc) => (
                      <div
                        key={svc.id}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs font-medium text-ink shadow-2xs transition hover:border-brand"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
                        <span>{svc.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <p className="text-sm text-muted">No services assigned yet.</p>
                  <Link
                    to="/partner/services"
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[#ff8a3d] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[#e0600f]"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Select & Configure Services
                  </Link>
                </div>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Performance scorecard">
              <ul className="space-y-3">
                {scorecard.map((item) => (
                  <li key={item.label}>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">{item.label}</span>
                      <span className="font-medium text-ink">{item.text}</span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-canvas" role="presentation">
                      <div
                        className="h-1.5 rounded-full bg-brand"
                        style={{ width: `${Math.max(0, Math.min(100, item.pct))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <Link to="/partner/performance" className="mt-3 inline-block text-sm font-medium text-brand">
                See full scorecard
              </Link>
            </Card>

            <Card title="Earnings summary">
              {earnings.isPending ? (
                <Skeleton className="h-20" />
              ) : earnings.isError ? (
                <ErrorState
                  title="Couldn't load earnings"
                  message={earnings.error.message}
                  onRetry={() => void earnings.refetch()}
                />
              ) : (
                <dl className="space-y-2 text-sm">
                  {[
                    { label: "Today", value: earnings.data.today },
                    { label: "This week", value: earnings.data.week },
                    { label: "This month", value: earnings.data.month },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between">
                      <dt className="text-muted">{row.label}</dt>
                      <dd className="font-medium text-ink">{inr(row.value)}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <Link to="/partner/earnings" className="mt-3 inline-block text-sm font-medium text-brand">
                See full earnings
              </Link>
            </Card>

            <Card
              title="Notifications"
              action={
                <Link to="/partner/system/notifications" className="text-sm font-medium text-brand">
                  Settings
                </Link>
              }
            >
              {notifications.isPending ? (
                <Skeleton className="h-24" />
              ) : notifications.isError ? (
                <ErrorState
                  title="Couldn't load notifications"
                  message={notifications.error.message}
                  onRetry={() => void notifications.refetch()}
                />
              ) : notifications.data.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  You're all caught up.
                </p>
              ) : (
                <ul className="divide-y divide-line">
                  {notifications.data.map((n) => (
                    <li key={n.id} className="flex items-start gap-2 py-2.5">
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                          n.read ? "bg-transparent" : "bg-accent"
                        }`}
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className={`text-sm ${n.read ? "text-muted" : "font-medium text-ink"}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted">{ago(n.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">
          {greeting()}, {user?.name?.split(" ")[0] || "Partner"} 👋
        </h2>
        <p className="mt-1 text-sm text-muted">Here's an overview of your day.</p>
      </div>
      {body}
    </div>
  );
}