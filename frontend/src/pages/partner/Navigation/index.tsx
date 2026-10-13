import { useEffect, useRef, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  Clock,
  Home,
  MapPin,
  Radio,
  Route,
  User,
} from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import LiveMap from "@/components/partner/LiveMap";
import MaskedCallButton from "@/components/MaskedCallButton";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import {
  getErrorMessage,
  getHttpStatus,
  updateBookingStatus,
} from "../JobDetails/jobDetails.api";
import type { ApiJob } from "../JobDetails/jobDetails.types";
import { STATUS_LABEL } from "../JobDetails/jobStatus";
import { useLocationSharing } from "../LocationSharing/useLocationSharing";
import {
  distanceKm,
  estimateEtaMinutes,
  formatDistance,
  formatEta,
  mapsDirectionsUrl,
} from "./geo";
import { isBookingId } from "./bookingId";
import { fetchNavigationJob } from "./navigation.api";
import { useLocalPosition } from "./useLocalPosition";
import "./navigation.css";

const whenText = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : null;

function DemoJobNotice() {
  const go = useNavigate();
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const valid = isBookingId(trimmed);
  return (
    <div className="nav-page">
      <div className="nav-card nav-center">
        <h2 className="nav-title">Demo booking</h2>
        <p className="nav-muted">
          This offer is a simulated job. Location sharing, chat and calls only
          work for a real booking assigned to you. Paste its booking ID to open
          it.
        </p>
        <label className="nav-label" htmlFor="real-booking-id">
          Real booking ID
        </label>
        <input
          id="real-booking-id"
          className="nav-input"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="24-character booking ID"
          maxLength={24}
          autoComplete="off"
        />
        <button
          type="button"
          className="nav-btn nav-btn-primary"
          disabled={!valid}
          onClick={() => go(`/partner/jobs/${trimmed}/navigation`)}
        >
          Open navigation
        </button>
        <Link className="nav-btn" to="/partner/jobs">
          Back to jobs
        </Link>
      </div>
    </div>
  );
}

/** Statuses in which the backend accepts live location (partner-location.service.ts). */
const SHARING_STATUSES = new Set(["en_route", "arrived", "in_progress"]);
/** Statuses in which a masked call can be set up (masked-call.service.ts). */
const CALL_STATUSES = new Set([
  "assigned",
  "en_route",
  "arrived",
  "in_progress",
]);

type LoadState = "loading" | "ready" | "notfound" | "error";

function NavigationContent({ id }: { id: string }) {
  const online = useOnlineStatus();
  const sharing = useLocationSharing(id);
  const local = useLocalPosition();

  const [job, setJob] = useState<ApiJob | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // ?panel=chat / ?panel=call come from the buttons on the Job Requests card.
  const [params] = useSearchParams();
  const chatRef = useRef<HTMLElement>(null);
  const actionsRef = useRef<HTMLElement>(null);
  const panel = params.get("panel");

  // Step 1: booking id, status and customer address.
  useEffect(() => {
    let cancelled = false;
    fetchNavigationJob(id)
      .then((j) => {
        if (cancelled) return;
        setJob(j);
        setState("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const status = getHttpStatus(err);
        if (status === 403 || status === 404) setState("notfound");
        else {
          setMessage(getErrorMessage(err, "Could not load this job."));
          setState("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id, reloadKey]);

  // Scroll to the chat or the quick actions when opened from a job card.
  useEffect(() => {
    if (state !== "ready" || sharing.load === "loading") return;
    if (panel === "chat") {
      chatRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      chatRef.current?.querySelector<HTMLElement>("textarea, input")?.focus();
    } else if (panel === "call") {
      // Scroll only. A URL parameter must never start a call by itself.
      actionsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [state, sharing.load, panel]);

  if (
    state === "loading" ||
    (state === "ready" && sharing.load === "loading")
  ) {
    return (
      <div
        className="nav-page"
        role="status"
        aria-busy="true"
        aria-label="Loading navigation"
      >
        <div className="nav-skel nav-skel-tall" />
        <div className="nav-skel" />
      </div>
    );
  }

  if (state === "notfound" || sharing.load === "notfound" || !job) {
    if (state === "error") {
      return (
        <div className="nav-page">
          <div className="nav-card nav-center">
            <p className="nav-alert" role="alert">
              {message}
            </p>
            <button
              type="button"
              className="nav-btn"
              onClick={() => {
                setState("loading");
                setReloadKey((k) => k + 1);
              }}
            >
              Try again
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="nav-page">
        <div className="nav-card nav-center">
          <h2 className="nav-title">Job not found</h2>
          <p className="nav-muted">
            This job was not found, or it is not assigned to you.
          </p>
          <Link className="nav-btn" to="/partner/jobs">
            Back to jobs
          </Link>
        </div>
      </div>
    );
  }

  const customer = job.location.coordinates;
  const partner = sharing.coords ?? local.coords;
  const addressText = [
    job.location.line1,
    job.location.area,
    job.location.city,
    job.location.pincode,
  ]
    .filter(Boolean)
    .join(", ");
  const canShare = SHARING_STATUSES.has(job.status);
  const canCall = CALL_STATUSES.has(job.status);
  const km = customer && partner ? distanceKm(partner, customer) : null;
  const travelling = job.status === "assigned" || job.status === "en_route";
  const geoProblem = sharing.geoProblem ?? (local.error ? "unavailable" : null);

  const mapSummary =
    km !== null
      ? `${formatDistance(km)} from you to the customer`
      : customer
        ? "Customer location shown"
        : "Customer location unavailable";

  // Optional fields: shown only if the backend returns them.
  const extras = job as ApiJob & {
    service?: { name?: string };
    scheduledAt?: string;
    slot?: string | null;
    partnerEarning?: number;
  };
  const serviceName = extras.service?.name;
  const scheduled = whenText(extras.scheduledAt);

  // Step 2: open turn-by-turn directions and start tracking.
  const startNavigation = () => {
    if (canShare) sharing.start();
    else local.start();
    window.open(
      mapsDirectionsUrl(customer, addressText),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const runAction = async (status: string) => {
    setBusyAction(status);
    setActionError(null);
    try {
      await updateBookingStatus(id, status);
      if (status === "en_route") sharing.start(); // leaving for the job: the customer can now follow live
      setReloadKey((k) => k + 1);
    } catch (err) {
      setActionError(getErrorMessage(err, "Could not update the job status."));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="nav-page nav-page-wide">
      <h2 className="nav-sr">Navigation</h2>

      {!online && (
        <p className="nav-offline" role="status">
          You are offline. The map and chat will catch up when you reconnect.
        </p>
      )}

      <Link className="nav-back" to="/partner/jobs">
        <ArrowLeft size={14} aria-hidden="true" /> Back to My Jobs
      </Link>

      {/* Summary */}
      <section className="nav-card nav-summary" aria-label="Booking summary">
        <div>
          <span className="nav-icon-box" aria-hidden="true">
            <Home size={22} />
          </span>
          <div>
            <div className="nav-row">
              <p className="nav-strong">
                Booking #{id.slice(-8).toUpperCase()}
              </p>
              <span className="nav-badge" role="status">
                {STATUS_LABEL[job.status]}
              </span>
            </div>
            {serviceName && <p className="nav-strong">{serviceName}</p>}
            {scheduled && (
              <p className="nav-muted">
                Scheduled · {scheduled}
                {extras.slot ? ` · ${extras.slot}` : ""}
              </p>
            )}
          </div>
        </div>
        <div>
          <span className="nav-icon-circle" aria-hidden="true">
            <User size={20} />
          </span>
          <div>
            <p className="nav-strong">{job.customer.name}</p>
            <p className="nav-muted">Customer</p>
          </div>
        </div>
        <div className="nav-summary-addr">
          <MapPin size={18} aria-hidden="true" />
          <div>
            <p className="nav-strong">Service Address</p>
            <p className="nav-muted">{addressText}</p>
          </div>
        </div>
      </section>

      <div className="nav-grid">
        {/* Map + stats + alerts */}
        <div className="nav-mapblock">
          <LiveMap customer={customer} partner={partner} summary={mapSummary} />

          {!customer && (
            <p className="nav-note" role="status">
              This booking has no map pin, so distance and ETA are unavailable.
              Start Navigation will search the address instead.
            </p>
          )}

          <dl className="nav-stats">
            <div className="nav-stat">
              <Route size={20} aria-hidden="true" />
              <dt>Distance</dt>
              <dd>{km !== null ? `~${formatDistance(km)}` : "—"}</dd>
            </div>
            <div className="nav-stat">
              <Clock size={20} aria-hidden="true" />
              <dt>ETA</dt>
              <dd>
                {km !== null && travelling
                  ? `~${formatEta(estimateEtaMinutes(km))}`
                  : km !== null
                    ? "At location"
                    : "—"}
              </dd>
            </div>
            <div className="nav-stat">
              <Radio size={20} aria-hidden="true" />
              <dt>Location Sharing</dt>
              <dd>
                {sharing.sharing ? "Active" : partner ? "Only you" : "Off"}
              </dd>
            </div>
          </dl>
          <p className="nav-hint">
            Distance is straight-line and ETA assumes city driving, so treat
            both as estimates. Your maps app has live traffic.
          </p>

          {geoProblem === "denied" && (
            <p className="nav-alert" role="alert">
              Location permission is blocked. Allow it in your browser settings,
              then tap Start Navigation again.
            </p>
          )}
          {geoProblem === "unsupported" && (
            <p className="nav-alert" role="alert">
              This browser does not support location sharing.
            </p>
          )}
          {local.error && !sharing.geoProblem && (
            <p className="nav-alert" role="alert">
              {local.error}
            </p>
          )}
          {sharing.ended && (
            <p className="nav-alert" role="alert">
              Sharing stopped because this job is no longer active.
            </p>
          )}
          {sharing.sendProblem && (
            <p className="nav-alert" role="alert">
              {sharing.sendProblem}
            </p>
          )}
          {actionError && (
            <p className="nav-alert" role="alert">
              {actionError}
            </p>
          )}
        </div>

        {/* Quick actions */}
        <section
          className="nav-card nav-actions-card"
          ref={actionsRef}
          aria-label="Quick actions"
        >
          <h3 className="nav-card-title">Quick Actions</h3>
          <button
            type="button"
            className="nav-btn nav-btn-primary nav-btn-block"
            onClick={startNavigation}
          >
            Start Navigation
          </button>
          {job.actions.map((a) => (
            <button
              key={a.status}
              type="button"
              className="nav-btn nav-btn-block"
              onClick={() => void runAction(a.status)}
              disabled={busyAction !== null}
            >
              {busyAction === a.status ? "Updating…" : a.label}
            </button>
          ))}
          <div className="nav-split">
            <div className="nav-call">
              <MaskedCallButton bookingId={id} disabled={!canCall} />
            </div>
            <Link className="nav-btn" to={`/partner/jobs/${id}/location`}>
              <MapPin size={16} aria-hidden="true" />
              &nbsp;Location Sharing
            </Link>
          </div>
          {sharing.sharing && (
            <button
              type="button"
              className="nav-btn nav-btn-danger nav-btn-block"
              onClick={() => void sharing.stop()}
              disabled={sharing.stopping}
            >
              {sharing.stopping ? "Stopping…" : "Stop sharing"}
            </button>
          )}
          {!canShare && job.status === "assigned" && (
            <p className="nav-hint">
              Tap “
              {job.actions.find((a) => a.status === "en_route")?.label ??
                "On the way"}
              ” when you leave so the customer can follow you live.
            </p>
          )}
        </section>

        {/* Service details (collapsible) */}
        <details className="nav-card nav-details" open>
          <summary>Service Details</summary>
          <dl className="nav-kv">
            <div>
              <dt>Service</dt>
              <dd>{serviceName ?? "—"}</dd>
            </div>
            {scheduled && (
              <div>
                <dt>Scheduled</dt>
                <dd>{scheduled}</dd>
              </div>
            )}
            {extras.slot && (
              <div>
                <dt>Slot</dt>
                <dd>{extras.slot}</dd>
              </div>
            )}
            {typeof extras.partnerEarning === "number" && (
              <div>
                <dt>Your earning</dt>
                <dd>₹{extras.partnerEarning.toLocaleString("en-IN")}</dd>
              </div>
            )}
          </dl>
        </details>

        {/* Chat */}
        <section className="nav-chat" ref={chatRef} aria-label="Customer chat">
          <ChatPanel bookingId={id} viewerRole="partner" />
        </section>
      </div>
    </div>
  );
}

export default function PartnerNavigationPage() {
  const { id = "" } = useParams<{ id: string }>();
  return isBookingId(id) ? <NavigationContent id={id} /> : <DemoJobNotice />;
}
