import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { LOGIN_PATH } from "@/routes/authPaths";
import { FOCUS_RING } from "@/components/customer/focusRing";
import LogoutDialog from "@/components/customer/LogoutDialog";

/** Log out with a confirm pop-up (same look as Delete account), so a stray tap at the bottom of the page can't end the session. */
export default function LogoutCard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await logout();
      navigate(LOGIN_PATH, { replace: true });
    } catch {
      setError("Couldn't log out. Please try again.");
      setBusy(false);
    }
  }

  function stay() {
    setOpen(false);
    setError(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <section className="profile-rise md:hidden" style={{ ["--d" as string]: "360ms" }} aria-label="Sign out">
      <div className="overflow-hidden rounded-[22px] border border-line/70 bg-panel shadow-[0_10px_28px_-12px_rgba(30,27,46,.14)]">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          className={clsx("group flex min-h-[64px] w-full items-center gap-3.5 px-4 py-3 text-left transition-colors active:bg-danger-soft", FOCUS_RING)}
        >
          <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-danger-soft text-danger transition-transform duration-200 motion-safe:group-active:scale-90">
            <LogOut className="h-5 w-5" />
          </span>
          <span className="text-[15px] font-semibold text-danger">Log out</span>
        </button>
      </div>
      <LogoutDialog open={open} busy={busy} error={error} onStay={stay} onLogout={handleLogout} />
    </section>
  );
}
