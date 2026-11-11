import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { LifeBuoy, MapPin, MessageCircle, X } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import LiveMap from "@/components/partner/LiveMap";
import MaskedCallButton from "@/components/MaskedCallButton";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { getErrorMessage, getHttpStatus } from "../JobDetails/jobDetails.api";
import type { ApiJob } from "../JobDetails/jobDetails.types";
import { useLocationSharing } from "../LocationSharing/useLocationSharing";
import { isBookingId } from "./bookingId";
import { fetchNavigationJob } from "./navigation.api";
import { useLocalPosition } from "./useLocalPosition";
import "./navigation.css";
import "./navigationApp.css";

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

/* ============ TESTING ONLY ============
 * true  = pretend the partner is standing at the customer's location (map pin + Arrived check).
 * Set to false (or delete the 3 lines marked TEST) after testing. */
const TEST_MOVE_TO_CUSTOMER = true;
/* ====================================== */

type LoadState = "loading" | "ready" | "notfound" | "error";

/** Headline + one helpful line for the panel, per job status (what the partner should do now). */
function stepInfo(status: string): { title: string; sub: string } {
  switch (status) {
    case "en_route":
      return {
        title: "Heading to the customer",
        sub: "The customer can follow you live on their phone.",
      };
    case "arrived":
      return {
        title: "You have arrived",
        sub: "Ask the customer for the start code, then take a start photo.",
      };
    case "in_progress":
      return {
        title: "Job in progress",
        sub: "Finish the work, then complete the job below.",
      };
    case "completed":
    case "rated":
      return { title: "Job completed", sub: "Collect the payment to wrap up." };
    default:
      return {
        title: "Ready to head out",
        sub: "Tap the button below when you leave so the customer can follow you live.",
      };
  }
}

function NavigationContent({ id }: { id: string }) {
  const online = useOnlineStatus();
  const sharing = useLocationSharing(id);
  const local = useLocalPosition();

  const [job, setJob] = useState<ApiJob | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [message, setMessage] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [actionError] = useState<string | null>(null);

  // ?panel=chat / ?panel=call come from the buttons on the Job Requests card.
  const [params] = useSearchParams();
  const panel = params.get("panel");
  const [chatOpen, setChatOpen] = useState(false);

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

  // Keep the job fresh without a reload: re-read it every 10 s (only while the tab is visible and
  // the job is not finished) and when the tab comes back to the front. Statuses and the start
  // verification state (attempts, lock) change on the server, e.g. when support unlocks a job.
  const doneStatus = job?.status === "completed" || job?.status === "rated";
  useEffect(() => {
    if (state !== "ready" || doneStatus) return undefined;
    const refresh = () => {
      if (document.visibilityState === "hidden" || !navigator.onLine) return;
      fetchNavigationJob(id)
        .then((j) => setJob(j))
        .catch(() => undefined);
    };
    const timer = window.setInterval(refresh, 10_000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [id, state, doneStatus]);

  // Location tracking starts by itself: no button needed. Live sharing once the job is on the
  // way (the server only accepts it then); before that the position is read for the map only.
  const jobStatus = job?.status;
  const sharingReady = sharing.load === "ready";
  const startSharing = sharing.start;
  const startLocal = local.start;
  useEffect(() => {
    if (state !== "ready" || !sharingReady || !jobStatus) return;
    if (jobStatus === "completed" || jobStatus === "rated") return;
    if (SHARING_STATUSES.has(jobStatus)) startSharing();
    else startLocal();
  }, [state, sharingReady, jobStatus, startSharing, startLocal]);

  // ?panel=chat (from a job card) opens the chat straight away.
  // A URL parameter must never start a call by itself, so ?panel=call does nothing.
  useEffect(() => {
    if (state === "ready" && sharing.load !== "loading" && panel === "chat") {
      setChatOpen(true);
    }
  }, [state, sharing.load, panel]);

  // While the chat sheet is open: Esc closes it and the page behind does not scroll.
  useEffect(() => {
    if (!chatOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setChatOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [chatOpen]);

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
  const realPartner = sharing.coords ?? local.coords;
  // TEST: move the partner to the customer location (remove after testing)
  const partner = TEST_MOVE_TO_CUSTOMER && customer ? customer : realPartner;
  const addressText = [
    job.location.line1,
    job.location.area,
    job.location.city,
    job.location.pincode,
  ]
    .filter(Boolean)
    .join(", ");
  const finished = job.status === "completed" || job.status === "rated";
  const canShare = SHARING_STATUSES.has(job.status);
  const canCall = CALL_STATUSES.has(job.status);
  const geoProblem = sharing.geoProblem ?? (local.error ? "unavailable" : null);
  const mapSummary = customer
    ? "Your location and the customer location"
    : "Customer location unavailable";

  const step = stepInfo(job.status);
  const initials =
    job.customer.name
      .replace(/[^A-Za-z ]/g, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "C";

  return (
    <div className="nav-page nv-page nv-app">
      <h2 className="nav-sr">Navigation</h2>

      {!online && (
        <p className="nav-offline" role="status">
          You are offline. The map and chat will catch up when you reconnect.
        </p>
      )}

      <div className={`nv-layout${finished ? " nv-layout-single" : ""}`}>
        {!finished && (
          <section className="nv-map" aria-label="Map">
            <LiveMap customer={customer} partner={partner} summary={mapSummary} />
          </section>
        )}

        <section className="nv-panel" aria-label="Job actions">
          <span className="nv-grabber" aria-hidden="true" />

          <header className="nv-status">
            <div className="nv-status-text">
              <h3 className="nv-status-title">{step.title}</h3>
              <p className="nv-status-sub">{step.sub}</p>
            </div>
            <span className="nv-code" title="Booking ID">
              #{job.id.slice(-6).toUpperCase()}
            </span>
          </header>

          <div className="nv-trip">
            <span className="nv-avatar" aria-hidden="true">
              {initials}
            </span>
            <div className="nv-trip-body">
              <strong className="nv-trip-name">{job.customer.name}</strong>
              <span className="nv-trip-service">{job.service.name}</span>
              <span className="nv-trip-addr">
                <MapPin size={14} aria-hidden="true" />
                <span>{addressText}</span>
              </span>
            </div>
          </div>

          <div className="nv-tiles">
            <div className="nv-call">
              <MaskedCallButton bookingId={id} disabled={!canCall} />
            </div>
            <button
              type="button"
              className="nv-tile nv-tile-chat"
              onClick={() => setChatOpen(true)}
            >
              <MessageCircle size={20} aria-hidden="true" />
              <span>Chat</span>
            </button>
            <Link className="nv-tile nv-tile-help" to="/partner/help">
              <LifeBuoy size={20} aria-hidden="true" />
              <span>Help</span>
            </Link>
          </div>

          {!customer && (
            <p className="nav-note" role="status">
              This booking has no map pin. Navigation will search the address instead.
            </p>
          )}
          {geoProblem === "denied" && (
            <p className="nav-alert" role="alert">
              Location permission is blocked. Allow it in your browser settings,
              then reload this page.
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
          {!canShare && job.status === "assigned" && (
            <p className="nav-hint">
              Tap “
              {job.actions.find((a) => a.status === "en_route")?.label ?? "On the way"}
              ” when you leave so the customer can follow you live.
            </p>
          )}

          {chatOpen && (
            <div
              className="nv-overlay"
              role="presentation"
              onClick={() => setChatOpen(false)}
            >
              <div
                className="nv-sheet"
                role="dialog"
                aria-modal="true"
                aria-label="Chat with customer"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="nv-sheet-bar">
                  <strong>Chat</strong>
                  <button
                    type="button"
                    className="nv-sheet-close"
                    onClick={() => setChatOpen(false)}
                    aria-label="Close chat"
                  >
                    <X size={20} aria-hidden="true" />
                  </button>
                </div>
                <div className="nv-sheet-body">
                  <ChatPanel bookingId={id} viewerRole="partner" />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function PartnerNavigationPage() {
  const { id = "" } = useParams<{ id: string }>();
  return isBookingId(id) ? <NavigationContent id={id} /> : <DemoJobNotice />;
}