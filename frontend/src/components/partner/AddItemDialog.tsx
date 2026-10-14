import React, { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { addJobItem, getErrorMessage } from '@/pages/partner/JobDetails/jobDetails.api';

export interface AddItemDialogProps {
  bookingId: string;
  isOpen: boolean;
  onClose: () => void;
  onItemAdded?: (item: { title: string; amount: number; reason?: string }) => void;
}

export const AddItemDialog: React.FC<AddItemDialogProps> = ({
  bookingId,
  isOpen,
  onClose,
  onItemAdded,
}) => {
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // duplicate prevention

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Item title is required.');
      return;
    }

    const amount = parseFloat(amountStr);
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (!navigator.onLine) {
      setError('You are offline. Cannot add item.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await addJobItem(bookingId, {
        title: trimmedTitle,
        amount,
        reason: reason.trim() || undefined,
      });

      onItemAdded?.({ title: trimmedTitle, amount, reason: reason.trim() || undefined });
      onClose();
    } catch (err) {
      // Backend does not currently support partner adding extra charges endpoint; show honest error
      setError(
        getErrorMessage(
          err,
          'Adding extra items/charges is not supported by the backend service. This dependency is documented.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-item-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <h2 id="add-item-title" className="text-base font-bold text-ink">
            Add Service Item / Charge
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-muted hover:text-ink hover:bg-slate-100"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="item-title" className="block text-xs font-semibold text-slate-700">
              Item or material title *
            </label>
            <input
              id="item-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Spare compressor valve"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          <div>
            <label htmlFor="item-amount" className="block text-xs font-semibold text-slate-700">
              Amount (₹) *
            </label>
            <input
              id="item-amount"
              type="number"
              required
              min="1"
              step="any"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="e.g. 350"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          <div>
            <label htmlFor="item-reason" className="block text-xs font-semibold text-slate-700">
              Reason or notes (optional)
            </label>
            <textarea
              id="item-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for extra charge"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm text-ink focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </div>

          {error && (
            <p className="text-xs font-medium text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              aria-busy={loading}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              {loading ? 'Adding…' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddItemDialog;
