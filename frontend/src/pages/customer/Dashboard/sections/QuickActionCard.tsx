import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";

export type QuickActionTone = "indigo" | "orange" | "pink" | "green";

const TONES: Record<QuickActionTone, string> = {
  indigo: "from-[#6366F1] to-[#4F46E5] shadow-[0_6px_16px_rgba(79,70,229,.35)]",
  orange: "from-[#FB923C] to-[#EA580C] shadow-[0_6px_16px_rgba(234,88,12,.35)]",
  pink: "from-[#F472B6] to-[#DB2777] shadow-[0_6px_16px_rgba(219,39,119,.35)]",
  green: "from-[#34D399] to-[#059669] shadow-[0_6px_16px_rgba(5,150,105,.35)]",
};

interface QuickActionCardProps {
  label: string;
  to: string;
  icon: LucideIcon;
  tone: QuickActionTone;
  disabled?: boolean;
  state?: unknown;
}

/** One round glossy icon with its label underneath (a cell of the QuickActions row). */
export default function QuickActionCard({ label, to, icon: Icon, tone, disabled = false, state }: QuickActionCardProps) {
  const disc = (
    <span
      aria-hidden="true"
      className={clsx(
        "flex h-[48px] w-[48px] items-center justify-center rounded-full bg-gradient-to-br text-white transition-transform duration-200",
        TONES[tone],
        disabled ? "opacity-40 grayscale" : "group-hover:scale-105 group-active:scale-95",
      )}
    >
      <Icon className="h-5 w-5 drop-shadow-[0_1px_1px_rgba(0,0,0,.25)]" aria-hidden="true" />
    </span>
  );
  const text = "max-w-[5rem] text-center text-[11px] sm:text-xs font-semibold leading-tight";

  if (disabled) {
    return (
      <span aria-disabled="true" title={`${label} isn't available yet`} className="flex flex-col items-center gap-1.5 px-1 py-1">
        {disc}
        <span className={clsx(text, "text-slate-400")}>{label}</span>
      </span>
    );
  }
  return (
    <Link to={to} state={state} className={clsx("group flex flex-col items-center gap-1.5 rounded-2xl px-1 py-1", FOCUS_RING)}>
      {disc}
      <span className={clsx(text, "text-slate-800")}>{label}</span>
    </Link>
  );
}
