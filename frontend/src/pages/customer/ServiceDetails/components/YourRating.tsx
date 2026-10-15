import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import clsx from "clsx";
import { FOCUS_RING } from "@/components/customer/focusRing";
import { useMyReviews } from "@/hooks/useReviews";
import { customerPath } from "@/routes/customerPath";

/**
 * "You rated this 4/5": the rating the signed-in customer gave this service, when they gave one.
 * Renders nothing while loading, when the request fails, or when they haven't rated it (never blocks the page).
 */
export default function YourRating({ serviceId, className }: { serviceId: string; className?: string }) {
  const { data } = useMyReviews();
  const mine = data?.find((r) => r.serviceId === serviceId);
  if (!mine) return null;
  return (
    <Link
      to={customerPath("/reviews?tab=mine")}
      className={clsx("inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 ring-1 ring-inset ring-amber-200 transition-colors hover:bg-amber-100", FOCUS_RING, className)}
    >
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
      You rated this {mine.rating}/5
    </Link>
  );
}
