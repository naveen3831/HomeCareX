import { Clock } from "lucide-react";
import { normalizeStatus } from "../trackingModel";

/** "About 12 min away" while the partner is travelling, otherwise a short state. Renders nothing when there is nothing useful to say. */
export default function EtaBadge({
  status,
  minutes,
}: {
  status: string;
  /** Rough minutes away. Null when there is no live position. */
  minutes: number | null;
}) {
  const s = normalizeStatus(status);
  let text: string | null = null;
  if (s === "en_route" && minutes) {
    text = `About ${minutes} min away`;
  } else if (s === "assigned") {
    text = "Will set off before your slot";
  }
  if (!text) return null;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium leading-tight text-slate-600 sm:text-[13px]">
      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}
