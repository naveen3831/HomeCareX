import { useEffect, useState } from "react";
import {
  Bug,
  Droplets,
  Hammer,
  Paintbrush,
  Sparkles,
  Wind,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

import "./jobUi.css";

/* =========================================================
   Shared helpers for the partner Home + Jobs screens
========================================================= */

export const formatInr = (n: number): string =>
  `₹${n.toLocaleString("en-IN")}`;

const clockTime = (d: Date): string =>
  d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** "Today" / "Tomorrow" / "12 Oct" */
export function dayLabel(iso: string): string {
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return "—";

  const now = new Date();
  const tomorrow = new Date(now);

  tomorrow.setDate(now.getDate() + 1);

  if (sameDay(d, now)) return "Today";
  if (sameDay(d, tomorrow)) return "Tomorrow";

  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "Today, 3:30 PM" */
export function whenLabel(iso: string): string {
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return "—";

  return `${dayLabel(iso)}, ${clockTime(d)}`;
}

/** "Today, 3:30 PM - 4:30 PM" (the API has no end time, so 1 hour is assumed) */
export function whenRangeLabel(iso: string, durationMin = 60): string {
  const start = new Date(iso);

  if (Number.isNaN(start.getTime())) return "—";

  const end = new Date(start.getTime() + durationMin * 60_000);

  return `${dayLabel(iso)}, ${clockTime(start)} - ${clockTime(end)}`;
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);

  return !Number.isNaN(d.getTime()) && sameDay(d, new Date());
}

/* ---------- countdown ---------- */

const secondsLeft = (expiresAt?: string): number => {
  if (!expiresAt) return 0;

  const t = new Date(expiresAt).getTime();

  if (Number.isNaN(t)) return 0;

  return Math.max(0, Math.ceil((t - Date.now()) / 1000));
};

/** Seconds remaining until `expiresAt`; ticks every second, stops at 0. */
export function useCountdown(expiresAt?: string): number {
  const [seconds, setSeconds] = useState(() => secondsLeft(expiresAt));

  useEffect(() => {
    setSeconds(secondsLeft(expiresAt));

    if (!expiresAt) return;

    const timer = window.setInterval(() => {
      const next = secondsLeft(expiresAt);

      setSeconds(next);

      if (next <= 0) window.clearInterval(timer);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [expiresAt]);

  return seconds;
}

/** 52 -> "00:52" */
export const formatClock = (seconds: number): string =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;

/* ---------- service thumbnail ---------- */

const iconFor = (service: string): LucideIcon => {
  const s = service.toLowerCase();

  if (/\b(ac|air)\b|cooling|a\/c/.test(s)) return Wind;
  if (/plumb|tap|leak|water/.test(s)) return Droplets;
  if (/electr|wiring|fan|light/.test(s)) return Zap;
  if (/clean|sanitiz|sofa|bathroom|kitchen/.test(s)) return Sparkles;
  if (/carpent|furniture|drill/.test(s)) return Hammer;
  if (/paint/.test(s)) return Paintbrush;
  if (/pest|termite|cockroach/.test(s)) return Bug;

  return Wrench;
};

/** Square tile standing in for the service photo in the design. */
export function ServiceThumb({
  service,
  size = "md",
  image,
}: {
  service: string;
  size?: "md" | "lg";
  /** Service photo URL. Falls back to the icon tile if missing or broken. */
  image?: string | null;
}) {
  const Icon = iconFor(service);
  const [broken, setBroken] = useState(false);

  return (
    <span className={`pj-thumb pj-thumb-${size}`} aria-hidden="true">
      {image && !broken ? (
        <img
          className="pj-thumb-img"
          src={image}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <Icon size={size === "lg" ? 34 : 28} strokeWidth={1.7} />
      )}
    </span>
  );
}