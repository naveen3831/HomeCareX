import { Link } from 'react-router-dom';
import { Headset } from 'lucide-react';
import SosButton from '@/components/partner/SosButton';

export interface HelpSafetyCardProps {
  /** The job the partner is on right now, if any, so the SOS alert knows which job it belongs to. */
  bookingId?: string | null;
  className?: string;
}

/**
 * Compact "Need help?" card for the Home page body: a red SOS button and an indigo Help button side by side.
 * SOS opens the same confirmation dialog used on the Safety page, so a stray tap cannot raise a false alarm.
 * Help opens the Help Center (articles and FAQs).
 */
export default function HelpSafetyCard({ bookingId = null, className = '' }: HelpSafetyCardProps) {
  return (
    <section
      aria-labelledby="home-help-title"
      className={`rounded-xl border border-slate-200 bg-white p-3 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="home-help-title" className="text-sm font-bold text-slate-900">
          Need help?
        </h2>
        <p className="text-[11px] text-slate-500">
          Emergency? Call{' '}
          <a href="tel:112" className="font-semibold text-red-700 underline">
            112
          </a>
        </p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <SosButton bookingId={bookingId} variant="compact" className="min-w-0" />
        <Link
          to="/partner/help"
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          <Headset className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Help</span>
        </Link>
      </div>
    </section>
  );
}