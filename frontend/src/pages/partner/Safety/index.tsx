import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ChevronRight, Mail, MapPin, Phone, ShieldAlert, WifiOff } from 'lucide-react';
import SosButton from '@/components/partner/SosButton';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { fetchAssignedServices } from '@/pages/partner/JobDetails/jobDetails.api';
import { STATUS_LABEL, type JobStatus } from '@/pages/partner/JobDetails/jobStatus';

export const SUPPORT_PHONE = '+919390212572';
export const SUPPORT_PHONE_LABEL = '+91 93902 12572';
export const SUPPORT_EMAIL = 'support@homecarex.com';

const EMERGENCY_NUMBERS = [
  { number: '112', label: 'Emergency services', primary: true },
  { number: '100', label: 'Police', primary: false },
  { number: '108', label: 'Ambulance', primary: false },
] as const;

/** Jobs where the partner is out on a visit and sharing a live location makes sense. */
const LIVE_STATUSES: JobStatus[] = ['en_route', 'arrived', 'in_progress'];
const OBJECT_ID = /^[a-f\d]{24}$/i;

type LiveJob = { id: string; status: JobStatus } | null;
type LiveState = { kind: 'loading' } | { kind: 'ready'; job: LiveJob } | { kind: 'error' };

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600';

/**
 * Safety & SOS. One page, two layouts:
 * - phone: red "call now" panel on top (big buttons), then SOS, contact rows and live location, stacked.
 * - laptop: a wide red banner across the top with the three numbers in a row, then three equal cards side by side.
 */
export default function PartnerSafetyPage() {
  const online = useOnlineStatus();
  const [live, setLive] = useState<LiveState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    fetchAssignedServices()
      .then((jobs) => {
        if (cancelled) return;
        const found = jobs.find((j) => OBJECT_ID.test(j.id) && LIVE_STATUSES.includes(j.status));
        setLive({ kind: 'ready', job: found ? { id: found.id, status: found.status } : null });
      })
      .catch(() => {
        if (!cancelled) setLive({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full space-y-4">
      <Helmet>
        <title>Safety &amp; SOS | HomeCareX Partner</title>
      </Helmet>

      <header className="lg:flex lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 lg:text-3xl">Safety &amp; SOS</h1>
          <p className="mt-1 text-sm text-slate-600">
            If you feel unsafe on a job, get to a safe place first, then use the options below.
          </p>
        </div>
      </header>

      {!online && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <WifiOff className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            You are offline, so an SOS alert cannot reach HomeCareX. <strong>Call 112 now.</strong>
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Emergency services: red panel on phones, wide banner on laptops */}
        <section
          className="rounded-2xl bg-red-600 p-5 text-white shadow-sm lg:col-span-3 lg:flex lg:items-center lg:justify-between lg:gap-8 lg:p-6"
          aria-labelledby="safety-emergency"
        >
          <div className="lg:max-w-md">
            <h2 id="safety-emergency" className="text-lg font-semibold">
              Call emergency services
            </h2>
            <p className="mt-1 text-sm text-red-100">In danger or injured? Call first. These calls are free.</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:mt-0 lg:flex lg:flex-1 lg:justify-end lg:gap-3">
            {EMERGENCY_NUMBERS.map((n) => (
              <a
                key={n.number}
                href={`tel:${n.number}`}
                aria-label={`Call ${n.label} on ${n.number}`}
                className={`flex items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold ${focus} ${
                  n.primary
                    ? 'col-span-2 min-h-[64px] bg-white text-base text-red-700 hover:bg-red-50 lg:min-h-[52px] lg:px-6'
                    : 'min-h-[48px] border border-white/40 bg-red-700 text-white hover:bg-red-800 lg:px-5'
                }`}
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                {n.primary ? `Call ${n.number} · ${n.label}` : `${n.number} · ${n.label}`}
              </a>
            ))}
          </div>
        </section>

        {/* SOS alert to HomeCareX */}
        <section className={card} aria-labelledby="safety-sos">
          <div className="flex items-start gap-3 lg:flex-col">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <ShieldAlert className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="safety-sos" className="text-base font-semibold text-slate-900">
                Alert the HomeCareX safety team
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Sends your location (if you allow it) to our team right now. It does not call the police, so call 112 as well if you are in danger.
              </p>
            </div>
          </div>
          <div className="mt-4">
            <SosButton bookingId={live.kind === 'ready' ? live.job?.id ?? null : null} variant="large" />
          </div>
        </section>

        {/* Contact HomeCareX: tap rows on phones, same rows stacked in the card on laptops */}
        <section className={card} aria-labelledby="safety-contact">
          <h2 id="safety-contact" className="text-base font-semibold text-slate-900">
            Contact HomeCareX
          </h2>
          <div className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
            <a
              href={`tel:${SUPPORT_PHONE}`}
              className={`flex min-h-[52px] items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 ${focus}`}
            >
              <Phone className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{SUPPORT_PHONE_LABEL}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </a>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className={`flex min-h-[52px] items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 ${focus}`}
            >
              <Mail className="h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{SUPPORT_EMAIL}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            </a>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Not urgent?{' '}
            <Link to="/partner/support" className={`font-semibold text-indigo-700 underline ${focus}`}>
              Raise a support ticket
            </Link>{' '}
            and choose the Safety category.
          </p>
        </section>

        {/* Live location */}
        <section className={card} aria-labelledby="safety-location">
          <h2 id="safety-location" className="text-base font-semibold text-slate-900">
            Share live location
          </h2>
          {live.kind === 'loading' && <p className="mt-2 text-sm text-slate-500">Checking your current job…</p>}
          {live.kind === 'error' && (
            <p className="mt-2 text-sm text-slate-600" role="status">
              Could not check your current job. Open the job from My Jobs to share your live location.
            </p>
          )}
          {live.kind === 'ready' && !live.job && (
            <p className="mt-2 text-sm text-slate-600">
              Live location sharing is available once you are on the way to a job.
            </p>
          )}
          {live.kind === 'ready' && live.job && (
            <div className="mt-2">
              <p className="text-sm text-slate-600">
                Your current job is <strong>{STATUS_LABEL[live.job.status]}</strong>. Let the customer and HomeCareX see where you are.
              </p>
              <Link
                to={`/partner/jobs/${live.job.id}/location`}
                className={`mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 lg:w-auto ${focus}`}
              >
                <MapPin className="h-4 w-4" aria-hidden="true" />
                Open live location
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export { PartnerSafetyPage };