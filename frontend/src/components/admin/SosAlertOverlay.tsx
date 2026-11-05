import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Phone, ShieldAlert, Volume2, VolumeX, X } from "lucide-react";
import { getSocket } from "@/services/bookingSocket";
import { createSiren, unlockOnFirstTouch, type Siren } from "@/lib/sosSiren";

/** Mirrors backend SosAlertDto (modules/sos/sos.types.ts) as sent on the `partner:sos` socket event. */
interface SosAlert {
  id: string;
  partnerId: string;
  bookingId: string | null;
  location: { lat: number; lng: number; accuracy?: number } | null;
  status: string;
  triggeredAt: string;
  partnerName?: string;
  partnerPhone?: string;
}

const SOS_EVENT = "partner:sos";
const enc = encodeURIComponent;

const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });

/**
 * Live emergency alert for admins. When a partner confirms SOS, this shows a red alert on whatever admin page is
 * open and plays a siren until an admin opens the details or dismisses it. Mounted once in AdminLayout.
 */
export default function SosAlertOverlay() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<SosAlert[]>([]);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false); // the browser refused sound until the page is touched
  const sirenRef = useRef<Siren | null>(null);
  const mutedRef = useRef(false);
  mutedRef.current = muted;

  const siren = (): Siren => (sirenRef.current ??= createSiren());

  const playIfNeeded = useCallback(async () => {
    if (mutedRef.current) return;
    const ok = await siren().start();
    setBlocked(!ok);
    if (!ok) {
      // Try again on the admin's first click or key press anywhere on the page.
      unlockOnFirstTouch(() => { if (!mutedRef.current) void siren().start().then((started) => setBlocked(!started)); });
    }
  }, []);

  // Listen for new SOS alerts.
  useEffect(() => {
    const socket = getSocket();
    const onSos = (a: SosAlert) => {
      if (!a?.id) return;
      setAlerts((cur) => (cur.some((x) => x.id === a.id) ? cur : [a, ...cur]));
      void playIfNeeded();
      try { navigator.vibrate?.([300, 150, 300, 150, 600]); } catch { /* not supported */ }
    };
    socket.on(SOS_EVENT, onSos);
    return () => { socket.off(SOS_EVENT, onSos); };
  }, [playIfNeeded]);

  // Siren runs only while an alert is open and sound is not muted.
  useEffect(() => {
    if (alerts.length === 0 || muted) {
      sirenRef.current?.stop();
      setBlocked(false);
    }
  }, [alerts.length, muted]);

  // Flash the tab title so the alert is seen from another tab.
  useEffect(() => {
    if (alerts.length === 0) return;
    const original = document.title;
    let on = true;
    const t = window.setInterval(() => {
      document.title = on ? "\u{1F6A8} SOS ALERT" : original;
      on = !on;
    }, 900);
    return () => { window.clearInterval(t); document.title = original; };
  }, [alerts.length]);

  useEffect(() => () => sirenRef.current?.stop(), []);

  const dismiss = (id: string) => setAlerts((cur) => cur.filter((a) => a.id !== id));
  const openDetails = (a: SosAlert, to: string) => {
    dismiss(a.id);
    navigate(to);
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-red-950/70 p-3 backdrop-blur-sm sm:items-center sm:p-6" role="alertdialog" aria-modal="true" aria-labelledby="sos-alert-title">
      <div className="w-full max-w-md space-y-3">
        <div className="flex items-center justify-between rounded-2xl bg-red-600 px-4 py-3 text-white shadow-lg">
          <h2 id="sos-alert-title" className="flex items-center gap-2 text-base font-extrabold tracking-wide">
            <ShieldAlert className="h-6 w-6 animate-pulse" aria-hidden="true" /> EMERGENCY SOS{alerts.length > 1 ? ` (${alerts.length})` : ""}
          </h2>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-bold hover:bg-white/30"
            aria-label={muted ? "Turn the siren on" : "Mute the siren"}
          >
            {muted ? <VolumeX size={14} aria-hidden="true" /> : <Volume2 size={14} aria-hidden="true" />} {muted ? "Muted" : "Mute"}
          </button>
        </div>

        {blocked && !muted && (
          <button type="button" onClick={() => void playIfNeeded()} className="w-full rounded-xl bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900">
            Tap here to turn on the siren
          </button>
        )}

        {alerts.map((a) => (
          <article key={a.id} className="rounded-2xl bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-red-600">Partner needs help</p>
                <p className="mt-0.5 truncate text-lg font-extrabold text-slate-900">{a.partnerName ?? "A partner"}</p>
                <p className="text-xs text-slate-500">Pressed SOS at {clock(a.triggeredAt)}</p>
              </div>
              <button type="button" onClick={() => dismiss(a.id)} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Dismiss alert">
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {a.partnerPhone && (
                <a href={`tel:${a.partnerPhone}`} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">
                  <Phone size={14} aria-hidden="true" /> Call {a.partnerPhone}
                </a>
              )}
              {a.location && (
                <a
                  href={`https://www.google.com/maps?q=${a.location.lat},${a.location.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 font-semibold text-sky-700"
                >
                  <MapPin size={14} aria-hidden="true" /> View location
                </a>
              )}
            </div>
            {!a.location && <p className="mt-2 text-xs text-slate-500">Location was not shared.</p>}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => openDetails(a, `/admin/partners/${enc(a.partnerId)}`)}
                className="flex-1 rounded-xl bg-red-600 px-3 py-2.5 text-sm font-bold text-white hover:bg-red-700"
              >
                View partner details
              </button>
              {a.bookingId && (
                <button
                  type="button"
                  onClick={() => openDetails(a, `/admin/bookings?booking=${enc(a.bookingId as string)}`)}
                  className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Open booking
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
