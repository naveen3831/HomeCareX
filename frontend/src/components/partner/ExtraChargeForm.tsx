import React, { useRef, useState } from 'react';
import { Plus, X, AlertCircle } from 'lucide-react';
import { createExtraCharge, getErrorMessage } from '@/pages/partner/JobDetails/jobDetails.api';
import type { ExtraChargeItem } from '@/pages/partner/JobDetails/jobDetails.types';

export interface ExtraChargeFormProps {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
  onChargeCreated?: (charge: ExtraChargeItem) => void;
}

export const ExtraChargeForm: React.FC<ExtraChargeFormProps> = ({
  bookingId,
  isOpen,
  onClose,
  onChargeCreated,
}) => {
  const [description, setDescription] = useState('');
  const [quantityStr, setQuantityStr] = useState('1');
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inFlight = useRef(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || inFlight.current) return;

    const trimmedDesc = description.trim();
    if (!trimmedDesc) {
      setError('Item description is required.');
      return;
    }

    const qty = parseInt(quantityStr, 10);
    if (Number.isNaN(qty) || qty < 1) {
      setError('Quantity must be a positive integer (at least 1).');
      return;
    }

    const amount = parseFloat(amountStr);
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Please enter a valid positive monetary amount.');
      return;
    }

    if (!navigator.onLine) {
      setError('You are offline. Please reconnect before requesting extra charges.');
      return;
    }

    inFlight.current = true;
    setLoading(true);
    setError(null);

    try {
      const created = await createExtraCharge(bookingId, {
        description: trimmedDesc,
        quantity: qty,
        amount,
        reason: reason.trim() || undefined,
      });

      onChargeCreated?.(created);
      onClose();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Could not request extra charge. The server endpoint may not be available yet.',
        ),
      );
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  };

  const parsedQty = parseInt(quantityStr, 10);
  const parsedAmt = parseFloat(amountStr);
  const estimatedTotal = !Number.isNaN(parsedQty) && parsedQty > 0 && !Number.isNaN(parsedAmt) && parsedAmt > 0
    ? parsedQty * parsedAmt
    : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="extra-charge-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 id="extra-charge-title" className="text-base font-bold text-slate-900">
            Request Extra Charge
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form noValidate onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="extra-desc" className="block text-xs font-semibold text-slate-700">
              Item or extra-work description *
            </label>
            <input
              id="extra-desc"
              type="text"
              required
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Additional pipe fitting or deep stain removal"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#4338ca] focus:ring-1 focus:ring-[#4338ca] outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="extra-quantity" className="block text-xs font-semibold text-slate-700">
                Quantity *
              </label>
              <input
                id="extra-quantity"
                type="number"
                required
                min="1"
                step="1"
                value={quantityStr}
                onChange={(e) => {
                  setQuantityStr(e.target.value);
                  if (error) setError(null);
                }}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#4338ca] focus:ring-1 focus:ring-[#4338ca] outline-none"
              />
            </div>

            <div>
              <label htmlFor="extra-amount" className="block text-xs font-semibold text-slate-700">
                Unit Amount (₹) *
              </label>
              <input
                id="extra-amount"
                type="number"
                required
                min="1"
                step="any"
                value={amountStr}
                onChange={(e) => {
                  setAmountStr(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="e.g. 250"
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#4338ca] focus:ring-1 focus:ring-[#4338ca] outline-none"
              />
            </div>
          </div>

          {estimatedTotal !== null && (
            <div className="rounded-lg bg-indigo-50 p-2 text-xs font-medium text-indigo-900">
              Total extra charge to request: ₹{estimatedTotal.toLocaleString('en-IN')}
            </div>
          )}

          <div>
            <label htmlFor="extra-reason" className="block text-xs font-semibold text-slate-700">
              Reason / Customer note (optional)
            </label>
            <textarea
              id="extra-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this extra work was needed"
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-[#4338ca] focus:ring-1 focus:ring-[#4338ca] outline-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#4338ca] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3730a3] disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {loading ? 'Submitting…' : 'Submit for approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ExtraChargeForm;
