import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, MapPin } from 'lucide-react';
import { getServiceArea } from '@/pages/partner/ServiceArea/serviceArea.api';

/**
 * Slim bar under the top header on Home showing where the partner works, e.g. "Hyderabad · 15 km".
 * Tapping it opens the Service area page. If no area is saved yet it asks the partner to set one.
 */
export default function ServiceAreaBar({ className = '' }: { className?: string }) {
  const { data, isPending } = useQuery({
    queryKey: ['partner', 'service-area'],
    queryFn: getServiceArea,
    staleTime: 60_000,
  });

  const place = data?.cities?.[0] ?? data?.baseLocation?.label ?? '';
  const more = (data?.cities?.length ?? 0) > 1 ? ` +${data!.cities.length - 1}` : '';
  const text = isPending
    ? 'Loading service area…'
    : data?.configured && place
      ? `${place}${more} · ${data.radiusKm} km`
      : 'Set your service area';

  return (
    <Link
      to="/partner/service-area"
      aria-label={`Service area: ${text}. Tap to change`}
      className={`flex min-h-[44px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${className}`}
    >
      <MapPin size={18} className="shrink-0 text-orange-500" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{text}</span>
      <span className="shrink-0 text-xs font-bold text-indigo-600">Change</span>
      <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
    </Link>
  );
}