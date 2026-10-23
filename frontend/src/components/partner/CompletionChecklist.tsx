import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ListChecks,
  Lock,
  Receipt,
  ShieldCheck,
  User,
  Wallet,
  X,
} from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { completeJob, getErrorMessage } from '@/pages/partner/JobDetails/jobDetails.api';
import type { ExtraChargeItem, JobDetails } from '@/pages/partner/JobDetails/jobDetails.types';

export interface CompletionChecklistProps {
  job: JobDetails;
  extraCharges?: ExtraChargeItem[];
  isOpen: boolean;
  onClose: () => void;
  onCompleted: (updatedJob: JobDetails) => void;
}

export const CompletionChecklist: React.FC<CompletionChecklistProps> = ({
  job,
  extraCharges = [],
  isOpen,
  onClose,
  onCompleted,
}) => {
  const online = useOnlineStatus();
  const inFlight = useRef(false);

  const [confirmed, setConfirmed] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Checklist completion check
  const incompleteItems = job.checklist.filter((item) => !item.done);
  const hasIncompleteChecklist = incompleteItems.length > 0;
  const doneCount = job.checklist.length - incompleteItems.length;
  const totalCount = job.checklist.length;
  const checklistPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 100;

  // 2. Extra charges check (cannot complete while any charge is pending)
  const pendingCharges = extraCharges.filter((c) => c.status === 'pending');
  const hasPendingCharges = pendingCharges.length > 0;
  const approvedCharges = extraCharges.filter((c) => c.status === 'approved');
  const approvedTotal = approvedCharges.reduce((sum, c) => sum + (c.amount * (c.quantity || 1)), 0);

  // 3. Already completed check
  const isAlreadyCompleted = job.status === 'completed' || job.status === 'rated';

  // Can submit check
  const canSubmit =
    !isAlreadyCompleted &&
    !hasIncompleteChecklist &&
    !hasPendingCharges &&
    confirmed &&
    online &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || inFlight.current) return;

    if (isAlreadyCompleted) {
      setError('This job is already completed.');
      return;
    }

    if (hasIncompleteChecklist) {
      setError(`Cannot complete: ${incompleteItems.length} checklist item(s) are not finished yet.`);
      return;
    }

    if (hasPendingCharges) {
      setError(`Cannot complete: ${pendingCharges.length} extra charge request(s) are still pending customer approval.`);
      return;
    }

    if (!confirmed) {
      setError('Please confirm that all tasks and inclusions have been completed.');
      return;
    }

    if (!online) {
      setError('You are offline. Reconnect before completing the job.');
      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setError(null);

    try {
      const updated = await completeJob(job.id, {
        notes: notes.trim() || undefined,
      });

      onCompleted(updated);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Could not complete the job. Please try again.'));
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="completion-modal-title"
    >
      <div className="relative flex flex-col w-full max-w-xl max-h-[92vh] sm:max-h-[90vh] rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden transition-all animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar - Fixed at top */}
        <div className="shrink-0 bg-gradient-to-b from-slate-50 to-white px-5 sm:px-6 pt-5 pb-3.5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-[#4338ca] shadow-sm ring-1 ring-indigo-100">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#4338ca]">
                    Job Completion
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {job.bookingCode}
                  </span>
                </div>
                <h2 id="completion-modal-title" className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 mt-0.5">
                  Complete Service Order
                </h2>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {/* Quick Recap Strip */}
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl bg-slate-100/70 p-2.5 text-xs text-slate-600 border border-slate-200/60">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Customer</p>
                <p className="font-semibold text-slate-900 truncate">{job.customer.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">Service</p>
                <p className="font-semibold text-slate-900 truncate">{job.service.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <Wallet className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-semibold text-emerald-600 tracking-wider">Payout</p>
                <p className="font-bold text-emerald-700 truncate">
                  ₹{(job.price.partnerEarning + approvedTotal).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0" noValidate>
          {/* Scrollable Body Content */}
          <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4 space-y-4 sm:space-y-4.5 overscroll-contain">
          {/* Offline alert */}
          {!online && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 p-3.5 text-xs text-amber-800 border border-amber-200" role="status">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
              <span>You are currently offline. Please reconnect to complete and close this job.</span>
            </div>
          )}

          {/* Already completed notice */}
          {isAlreadyCompleted && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 p-3.5 text-xs text-emerald-800 border border-emerald-200" role="alert">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
              <span>This job is already completed. It cannot be completed again.</span>
            </div>
          )}

          {/* 1. Checklist Verification Card */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-[#4338ca]" aria-hidden="true" />
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-800">
                  1. Inclusions Checklist
                </h3>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  hasIncompleteChecklist
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {!hasIncompleteChecklist && <CheckCircle2 className="h-3 w-3" />}
                {doneCount} of {totalCount} Done
              </span>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-200/80 rounded-full h-1.5 overflow-hidden my-2.5">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  hasIncompleteChecklist ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${checklistPct}%` }}
              />
            </div>

            {hasIncompleteChecklist ? (
              <div className="rounded-xl bg-amber-50 p-3 border border-amber-200/80 text-xs text-amber-800 space-y-1.5 mt-2">
                <p className="font-semibold flex items-center gap-1.5 text-amber-900">
                  <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-hidden="true" />
                  Incomplete mandatory items:
                </p>
                <ul className="list-disc pl-5 space-y-0.5 text-amber-800">
                  {incompleteItems.map((item) => (
                    <li key={item.id}>{item.label}</li>
                  ))}
                </ul>
                <p className="text-[11px] text-amber-700/90 pt-1">
                  Please finish and check off all tasks on the active job screen before completing.
                </p>
              </div>
            ) : (
              <p className="text-xs text-emerald-700 flex items-center gap-1.5 font-medium mt-1">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                All checklist items completed.
              </p>
            )}
          </div>

          {/* 2. Extra Charges Status Card (Always Visible) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 transition-all" aria-labelledby="comp-extra-charges-title">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#4338ca]" aria-hidden="true" />
                <h3 id="comp-extra-charges-title" className="text-xs font-bold uppercase tracking-wide text-slate-800">
                  2. Extra Charges Status
                </h3>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  hasPendingCharges
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : extraCharges.length === 0
                      ? 'bg-slate-200/70 text-slate-600'
                      : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                {hasPendingCharges ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" aria-hidden="true" />
                    {pendingCharges.length} Pending Approval
                  </>
                ) : extraCharges.length === 0 ? (
                  'None Requested'
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3" />
                    All Decided
                  </>
                )}
              </span>
            </div>

            {hasPendingCharges ? (
              <div className="rounded-xl bg-amber-50/90 border border-amber-300/80 p-3.5 text-xs text-amber-900 space-y-2 mt-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>Pending Customer Approval</span>
                </div>
                <p className="text-amber-800 text-[11.5px]">
                  The customer must approve or reject these requested extra charges before the job can be closed:
                </p>
                <div className="space-y-1.5 pt-1">
                  {pendingCharges.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between bg-white/90 rounded-lg p-2.5 border border-amber-200/80"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{c.title}</p>
                        <p className="text-[11px] text-slate-500">
                          Qty: {c.quantity || 1} × ₹{c.amount}
                        </p>
                      </div>
                      <span className="font-bold text-slate-900 text-sm">
                        ₹{(c.quantity || 1) * c.amount}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-1 pt-1.5 border-t border-amber-200/60">
                  <p className="text-[11px] text-amber-800 font-medium">
                    💡 Ask the customer to check their booking screen and tap &ldquo;Approve&rdquo; or &ldquo;Reject&rdquo;.
                  </p>
                  <a
                    href={`/customer/bookings/${job.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 hover:text-indigo-900 hover:underline"
                  >
                    Open Customer View ↗
                  </a>
                </div>
              </div>
            ) : extraCharges.length === 0 ? (
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-medium">
                <CheckCircle2 className="h-4 w-4 text-slate-400 shrink-0" aria-hidden="true" />
                No extra charges requested for this job.
              </p>
            ) : (
              <div className="mt-1 space-y-1">
                <p className="text-xs text-emerald-700 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
                  All extra charges have been decided by the customer.
                </p>
                {approvedTotal > 0 && (
                  <p className="text-[11px] text-slate-500 pl-5.5">
                    Added to payout: <span className="font-bold text-emerald-700">₹{approvedTotal.toLocaleString('en-IN')}</span> ({approvedCharges.length} approved item{approvedCharges.length === 1 ? '' : 's'})
                  </p>
                )}
              </div>
            )}
          </div>

          {/* 3. Handover Notes / Remarks (Optional) */}
          <div className="space-y-1.5">
            <label htmlFor="comp-notes" className="block text-xs font-semibold text-slate-800">
              Completion Notes / Remarks <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              id="comp-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Customer inspected work, satisfied with cleaning, key handed over..."
              className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#4338ca] focus:ring-2 focus:ring-[#4338ca]/15 outline-none transition-all"
            />
          </div>

          {/* 4. Formal Partner Confirmation Card */}
          <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 transition-all">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                id="confirm-completion"
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                disabled={submitting || isAlreadyCompleted}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4338ca] focus:ring-[#4338ca] cursor-pointer"
              />
              <span className="text-xs font-medium text-slate-800 leading-relaxed">
                I confirm that all tasks, inclusions, and agreed services have been thoroughly completed in the presence of the customer.
              </span>
            </label>
          </div>

          {/* Server / Validation Error */}
          {error && (
            <div className="flex items-center gap-2.5 rounded-2xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-200 animate-in fade-in" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}
          </div>

          {/* Modal Actions - Pinned at bottom */}
          <div className="shrink-0 bg-slate-50/90 px-5 sm:px-6 py-3.5 border-t border-slate-200/80 flex flex-col gap-2">
            <div className="flex justify-end items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="h-10 sm:h-11 px-4 sm:px-5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSubmit}
                aria-busy={submitting}
                className="inline-flex h-10 sm:h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#4338ca] to-[#3730a3] px-5 sm:px-6 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 hover:from-[#3730a3] hover:to-[#2e2889] disabled:opacity-50 disabled:shadow-none transition-all"
              >
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {submitting ? 'Completing job…' : 'Complete Job & Finalize Payout'}
              </button>
            </div>

            <p className="flex items-center justify-center gap-1 text-[11px] text-slate-400">
              <Lock className="h-3 w-3" aria-hidden="true" />
              Completing this service securely closes the work order and releases your earnings.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CompletionChecklist;
