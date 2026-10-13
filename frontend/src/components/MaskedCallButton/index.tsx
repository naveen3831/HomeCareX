import { useState } from "react";
import api from "@/lib/api";
import { errorMessage } from "@/services/Chat.api";
import "./MaskedCallButton.css";

interface CallSession {
  proxyNumber: string;
  expiresAt: string;
}

const until = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });

/**
 * Calls the customer through a private proxy number. The customer's real number never reaches the browser:
 * the server asks the call provider for a session and returns only the proxy number.
 */
export default function MaskedCallButton({
  bookingId,
  disabled = false,
}: {
  bookingId: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<CallSession | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ data: CallSession }>(
        `/partner/jobs/${bookingId}/call`,
      );
      setSession(res.data.data);
      // On a phone this opens the dialler straight away; the link below covers browsers that block it.
      window.location.href = `tel:${res.data.data.proxyNumber}`;
    } catch (err) {
      setSession(null);
      setError(
        errorMessage(err, "Could not set up the call. Please try again."),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mc">
      <button
        type="button"
        className="mc-btn"
        onClick={() => void start()}
        disabled={disabled || busy}
      >
        {busy ? "Connecting…" : "Call customer"}
      </button>
      {session && (
        <p className="mc-note" role="status">
          <a className="mc-link" href={`tel:${session.proxyNumber}`}>
            Tap to dial {session.proxyNumber}
          </a>
          <span>
            Private number, valid until {until(session.expiresAt)}. The customer
            sees this number, not yours.
          </span>
        </p>
      )}
      {error && (
        <p className="mc-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
