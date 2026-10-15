import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, LogOut } from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/features/customer";
import { customerPath } from "@/routes/customerPath";
import { LOGIN_PATH } from "@/routes/authPaths";
import { FOCUS_RING } from "./focusRing";
import DeleteAccount from "./DeleteAccount";
import LogoutDialog from "./LogoutDialog";

/** Bottom of the desktop sidebar: who's signed in (opens Profile) + Log out. Replaces the old avatar menu in the top bar. */
export default function SidebarAccount() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const profile = useProfile();
  // Same photo as the Profile page; falls back to the signed-in user while the profile loads.
  const name = profile.data?.name ?? user?.name ?? "Guest";
  const email = profile.data?.email ?? user?.email;
  const avatarUrl = profile.data?.avatarUrl;
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  function stay() {
    setOpen(false);
    setError(null);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

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

  return (
    <div className="mt-auto border-t border-line p-3">
      <Link to={customerPath("/profile")} className={clsx("flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-canvas", FOCUS_RING)}>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-sm font-medium text-white" aria-hidden="true">
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-ink">{name}</span>
          <span className="block truncate text-xs text-muted">{email ?? "View profile"}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted" aria-hidden="true" />
      </Link>
      <DeleteAccount variant="sidebar" />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={clsx("mt-1 flex min-h-[44px] w-full items-center gap-3 rounded-lg px-2 text-sm font-medium text-danger transition-colors hover:bg-danger-soft", FOCUS_RING)}
      >
        <LogOut className="ml-2.5 h-4 w-4" aria-hidden="true" />
        Log out
      </button>
      <LogoutDialog open={open} busy={busy} error={error} onStay={stay} onLogout={handleLogout} />
    </div>
  );
}
