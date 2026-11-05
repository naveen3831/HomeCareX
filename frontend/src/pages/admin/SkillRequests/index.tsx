import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Check, Clock3, Phone, X } from 'lucide-react';
import { classifyApiError } from '@/lib/apiError';
import {
  fetchSkillRequests,
  reviewSkillRequest,
  type AdminSkillRequest,
  type SkillRequestStatus,
} from '@/services/adminSkillRequestsApi';

const TABS: { id: SkillRequestStatus; label: string }[] = [
  { id: 'pending', label: 'Pending' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
];

const when = (iso: string) => new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

function RequestCard({ r, onDone }: { r: AdminSkillRequest; onDone: () => void }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const mutation = useMutation({
    mutationFn: (v: { decision: 'approve' | 'reject'; note?: string }) => reviewSkillRequest(r.id, v.decision, v.note),
    onSuccess: onDone,
  });
  const pending = r.status === 'pending';

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Requested skill</p>
          <h2 className="text-lg font-extrabold text-slate-900">{r.name}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Requested {when(r.createdAt)}
            {r.reviewedAt ? ` · Reviewed ${when(r.reviewedAt)}` : ''}
          </p>
        </div>
        {!pending && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${r.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            {r.status === 'approved' ? <BadgeCheck size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
            {r.status === 'approved' ? 'Approved' : 'Rejected'}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <Link to={`/admin/partners/${encodeURIComponent(r.partnerId)}`} className="font-semibold text-indigo-700 hover:underline">
          {r.partnerName ?? 'View partner'}
        </Link>
        {r.partnerPhone && (
          <a href={`tel:${r.partnerPhone}`} className="inline-flex items-center gap-1 text-slate-600">
            <Phone size={13} aria-hidden="true" /> {r.partnerPhone}
          </a>
        )}
      </div>

      {r.currentSkills.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Already has: <span className="text-slate-700">{r.currentSkills.join(', ')}</span>
        </p>
      )}
      {r.reviewNote && <p className="mt-2 text-xs text-slate-600">Note: {r.reviewNote}</p>}

      {pending && (
        <div className="mt-4">
          {rejecting ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700" htmlFor={`note-${r.id}`}>Reason (the partner will see this)</label>
              <input
                id={`note-${r.id}`}
                value={note}
                maxLength={300}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button type="button" disabled={mutation.isPending} onClick={() => setRejecting(false)} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700">Back</button>
                <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ decision: 'reject', note: note.trim() || undefined })} className="rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                  Confirm reject
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate({ decision: 'approve' })} className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                <Check size={15} aria-hidden="true" /> Approve
              </button>
              <button type="button" disabled={mutation.isPending} onClick={() => setRejecting(true)} className="inline-flex items-center gap-1 rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">
                <X size={15} aria-hidden="true" /> Reject
              </button>
            </div>
          )}
          {mutation.isError && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{classifyApiError(mutation.error).message}</p>}
        </div>
      )}
    </article>
  );
}

/** Admin: partners' requests to add a new skill. Approving adds it to the partner's profile. */
export default function AdminSkillRequestsPage() {
  const [tab, setTab] = useState<SkillRequestStatus>('pending');
  const queryClient = useQueryClient();
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: ['admin-skill-requests', tab],
    queryFn: () => fetchSkillRequests(tab),
  });
  const done = () => void queryClient.invalidateQueries({ queryKey: ['admin-skill-requests'] });

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 p-4">
      <header>
        <h1 className="text-xl font-extrabold text-slate-900">Skill requests</h1>
        <p className="text-sm text-slate-500">Partners ask to add new skills here. A skill only appears on their profile after you approve it.</p>
      </header>

      <div className="flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Request status">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${tab === t.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isPending && <div className="h-28 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" />}
      {isError && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {classifyApiError(error).message}{' '}
          <button type="button" onClick={() => void refetch()} className="font-bold underline">Try again</button>
        </div>
      )}
      {data && data.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          <Clock3 size={22} aria-hidden="true" />
          {tab === 'pending' ? 'No skill requests waiting.' : `No ${tab} requests yet.`}
        </div>
      )}
      {data?.map((r) => <RequestCard key={r.id} r={r} onDone={done} />)}
    </div>
  );
}
