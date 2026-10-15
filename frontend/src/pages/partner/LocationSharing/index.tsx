import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { isBookingId } from "../Navigation/bookingId";
import {
  SEND_INTERVAL_MS,
  useLocationSharing,
  type GeoProblem,
} from "./useLocationSharing";
import "./locationSharing.css";

const GEO_MESSAGE: Record<GeoProblem, string> = {
  denied:
    "Location permission is blocked. Allow location access for this site in your browser settings, then tap Start sharing.",
  unavailable:
    "Your device could not get a location fix. Move to an open area or check that location services are on.",
  unsupported: "This browser does not support location sharing.",
};

/** "12 s ago", "3 min ago"; re-rendered every second by the caller's tick. */
function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(
    0,
    Math.round((now - new Date(iso).getTime()) / 1000),
  );
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

/** Shown instead of the page when the URL id is not a real booking (e.g. the "Simulate Confirmed Booking" demo job). */
function DemoJobNotice() {
  return (
    <div className="ls-page">
      <div className="ls-card ls-center">
        <h2 className="ls-title">Demo booking</h2>
        <p className="ls-muted">
          This route is only available for real booking IDs.
        </p>
        <Link className="ls-btn" to="/partner/jobs">
          Back to jobs
        </Link>
      </div>
    </div>
  );
}

function LocationSharingContent({ id }: { id: string }) {
  const online = useOnlineStatus();
  const s = useLocationSharing(id);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (s.load === "loading") {
    return (
      <div
        className="ls-page"
        aria-busy="true"
        aria-label="Loading location sharing"
      >
        <div className="ls-skel ls-skel-tall" />
        <div className="ls-skel" />
      </div>
    );
  }

  if (s.load === "notfound") {
    return (
      <div className="ls-page">
        <div className="ls-card ls-center">
          <h2 className="ls-title">Job not found</h2>
          <p className="ls-muted">
            This job was not found, or it is not assigned to you.
          </p>
          <Link className="ls-btn" to="/partner/jobs">
            Back to jobs
          </Link>
        </div>
      </div>
    );
  }

  if (s.load === "error") {
    return (
      <div className="ls-page">
        <div className="ls-card ls-center">
          <p className="ls-alert" role="alert">
            {s.loadMessage || "Could not load location sharing."}
          </p>
          <button type="button" className="ls-btn" onClick={s.reload}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const hasPosition = s.coords !== null;
  const mapsHref = hasPosition
    ? `https://www.google.com/maps/search/?api=1&query=${s.coords!.lat},${s.coords!.lng}`
    : null;
  const statusLabel = s.sharing
    ? "Sharing active"
    : s.ended
      ? "Job not active"
      : "Not sharing";

  return (
    <div className="ls-page">
      {!online && (
        <p className="ls-offline" role="status">
          You are offline. Your location will be sent again as soon as you
          reconnect.
        </p>
      )}

      <header className="ls-header">
        <div>
          <h2 className="ls-title">Location sharing</h2>
          <p className="ls-muted">
            The customer sees your live position while you travel to the job.
          </p>
        </div>
        <span
          className={`ls-badge ${s.sharing ? "ls-badge-on" : "ls-badge-off"}`}
          role="status"
        >
          <span className="ls-dot" aria-hidden="true" />
          {statusLabel}
        </span>
      </header>

      {s.geoProblem && (
        <p className="ls-alert" role="alert">
          {GEO_MESSAGE[s.geoProblem]}
        </p>
      )}
      {s.ended && (
        <p className="ls-alert" role="alert">
          Sharing stopped because this job is no longer active.
        </p>
      )}
      {s.sendProblem && (
        <p className="ls-alert" role="alert">
          {s.sendProblem}
        </p>
      )}

      <section className="ls-card" aria-label="Current location">
        {hasPosition ? (
          <dl className="ls-grid">
            <div>
              <dt>Latitude</dt>
              <dd>{s.coords!.lat.toFixed(5)}</dd>
            </div>
            <div>
              <dt>Longitude</dt>
              <dd>{s.coords!.lng.toFixed(5)}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>
                {s.coords!.accuracy !== null
                  ? `±${Math.round(s.coords!.accuracy)} m`
                  : "Unknown"}
              </dd>
            </div>
            <div>
              <dt>Last updated</dt>
              <dd>
                {s.lastUpdated
                  ? timeAgo(s.lastUpdated, now)
                  : s.sharing
                    ? "Waiting for first update…"
                    : "Never"}
              </dd>
            </div>
          </dl>
        ) : (
          <div className="ls-center">
            <p className="ls-empty-title">
              {s.sharing ? "Getting your location…" : "No location shared yet"}
            </p>
            <p className="ls-muted">
              {s.sharing
                ? "This can take a few seconds. Keep this page open."
                : "Start sharing so the customer can follow your arrival."}
            </p>
          </div>
        )}
        {mapsHref && (
          <a
            className="ls-link"
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
          >
            Open in Maps
          </a>
        )}
      </section>

      <div className="ls-actions">
        {s.sharing ? (
          <button
            type="button"
            className="ls-btn ls-btn-danger"
            onClick={() => void s.stop()}
            disabled={s.stopping}
          >
            {s.stopping ? "Stopping…" : "Stop sharing"}
          </button>
        ) : (
          <button
            type="button"
            className="ls-btn ls-btn-primary"
            onClick={s.start}
            disabled={s.ended || s.geoProblem === "unsupported"}
          >
            Start sharing
          </button>
        )}
        <Link className="ls-btn" to={`/partner/jobs/${id}`}>
          Back to job
        </Link>
      </div>

      {s.sharing && (
        <p className="ls-hint">
          Your location is sent about every {SEND_INTERVAL_MS / 1000} seconds
          while this page is open.
        </p>
      )}
    </div>
  );
}

export default function LocationSharingPage() {
  const { id = "" } = useParams<{ id: string }>();
  return isBookingId(id) ? (
    <LocationSharingContent id={id} />
  ) : (
    <DemoJobNotice />
  );
}
