import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  LifeBuoy,
  MessageCircle,
  Navigation as NavigationIcon,
  X,
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
import { useLocationSharing } from "../LocationSharing/useLocationSharing";
import { mapsDirectionsUrl } from "./geo";
import { isBookingId } from "./bookingId";
import { fetchNavigationJob } from "./navigation.api";
import { useLocalPosition } from "./useLocalPosition";
import JobStepPanel from "./components/JobStepPanel";
import "./navigation.css";

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
  const partner = sharing.coords ?? local.coords;
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

  // Opens Google Maps directions to the customer. No start point is passed, so Maps
  // starts from the partner's present location. Also starts live location sharing.
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
     await updateBookingStatus(id, status as Parameters<typeof updateBookingStatus>[1]);
      if (status === "en_route") sharing.start(); // leaving for the job: the customer can now follow live
      setReloadKey((k) => k + 1);
    } catch (err) {
      setActionError(getErrorMessage(err, "Could not update the job status."));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="nav-page nv-page">
      <h2 className="nav-sr">Navigation</h2>

      {!online && (
        <p className="nav-offline" role="status">
          You are offline. The map and chat will catch up when you reconnect.
        </p>
      )}

      {!finished && (
        <section className="nv-map" aria-label="Map">
          <LiveMap customer={customer} partner={partner} summary={mapSummary} />
        </section>
      )}

      {!finished && (
        <button type="button" className="nv-go" onClick={startNavigation}>
          <NavigationIcon size={20} aria-hidden="true" />
          Navigation
        </button>
      )}

      {job.actions.map((a) => (
        <button
          key={a.status}
          type="button"
          className="nv-step"
          onClick={() => void runAction(a.status)}
          disabled={busyAction !== null}
        >
          {busyAction === a.status ? "Updating…" : a.label}
        </button>
      ))}

      <JobStepPanel
        job={job}
        online={online}
        onChanged={() => setReloadKey((k) => k + 1)}
      />

      <div className="nv-tiles">
        <div className="nv-call">
          <MaskedCallButton bookingId={id} disabled={!canCall} />
        </div>
        <button
          type="button"
          className="nv-tile nv-tile-chat"
          onClick={() => setChatOpen(true)}
        >
          <MessageCircle size={22} aria-hidden="true" />
          <span>Chat</span>
        </button>
        <Link className="nv-tile nv-tile-help" to="/partner/help">
          <LifeBuoy size={22} aria-hidden="true" />
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
          then tap Navigation again.
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
      {sharing.sharing && (
        <button
          type="button"
          className="nv-stop"
          onClick={() => void sharing.stop()}
          disabled={sharing.stopping}
        >
          {sharing.stopping ? "Stopping…" : "Stop sharing location"}
        </button>
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
    </div>
  );
}

export default function PartnerNavigationPage() {
  const { id = "" } = useParams<{ id: string }>();
  return isBookingId(id) ? <NavigationContent id={id} /> : <DemoJobNotice />;
}