import { Link } from "react-router-dom";
import { ArrowRight, MapPin, Navigation } from "lucide-react";
import type { ActiveJob } from "@/types/partner";

const STATUS_LABEL: Record<ActiveJob["status"], string> = {
  en_route: "On the way",
  arrived: "Arrived",
  in_progress: "In progress",
};

/** Lavender banner (like the customer's "track" strip) for the job in progress. */
export default function ActiveJobCard({ job }: { job: ActiveJob | null }) {
  if (!job) {
    return (
      <div className="rounded border border-dashed border-line bg-panel p-6 text-center">
        <p className="text-sm font-medium text-ink">No active job</p>
        <p className="mt-1 text-xs text-muted">When you start a job, it shows up here.</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/partner/jobs/BK-20418"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#3730a3]"
          >
            Booking #BK-20418 Details <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link
            to="/partner/jobs/BK-20418/active"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand bg-white px-3.5 py-2 text-xs font-semibold text-brand hover:bg-brand-soft"
          >
            Active Job (Deep home cleaning) <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    );
  }
  const time = new Date(job.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <Link
      to={`/partner/jobs/${job.id}`}
      className="flex items-center gap-4 rounded bg-brand-soft px-4 py-4 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white">
        <Navigation className="h-5 w-5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{job.service}</p>
        <p className="truncate text-xs text-muted">
          {STATUS_LABEL[job.status]} · {job.customer} · {time}
        </p>
        {job.address && (
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
            <MapPin size={12} aria-hidden /> {job.address}
          </p>
        )}
      </div>
      <span className="flex shrink-0 items-center gap-1 text-sm font-medium text-brand">
        Open <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </span>
    </Link>
  );
}