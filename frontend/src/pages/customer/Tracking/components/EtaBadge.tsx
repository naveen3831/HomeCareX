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
  if (s === "en_route")
    text = minutes ? `About ${minutes} min away` : "On the way";
  else if (s === "arrived") text = "Arrived";
  else if (s === "in_progress") text = "Service in progress";
  else if (s === "assigned") text = "Will set off before your slot";
  if (!text) return null;

  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-medium leading-tight text-muted">
      <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
      {text}
    </span>
  );
}
