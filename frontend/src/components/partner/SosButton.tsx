import React, { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { triggerSos, getErrorMessage } from '@/pages/partner/JobDetails/jobDetails.api';

export interface SosButtonProps {
  bookingId: string;
  coordinates?: { lat: number; lng: number } | null;
  onSuccess?: () => void;
  className?: string;
}

export const SosButton: React.FC<SosButtonProps> = ({
  bookingId,
  coordinates = null,
  onSuccess,
  className = '',
}) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alertSent, setAlertSent] = useState(false);

  const handleTrigger = async () => {
    if (loading) return; // Prevent duplicate triggering
    setLoading(true);
    setError(null);

    try {
      await triggerSos(bookingId, coordinates);
      setAlertSent(true);
      setConfirmOpen(false);
      onSuccess?.();
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Failed to trigger SOS alert. Please call emergency services (112) immediately.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`sos-button-wrapper ${className}`}>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirmOpen(true);
        }}
        disabled={loading}
        aria-label="Emergency SOS"
        className="sos-btn inline-flex items-center justify-center rounded-full bg-[#dc2626] px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#b91c1c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50"
      >
        <span>{alertSent ? 'SOS Sent' : 'SOS'}</span>
      </button>

      {error && (
        <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}

      {confirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-dialog-title"
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
              <ShieldAlert className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 id="sos-dialog-title" className="text-lg font-bold text-slate-900">
              Trigger Emergency SOS?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This will immediately alert the safety team and record your booking location. Only use
              this in a real emergency.
            </p>

            {error && (
              <p className="mt-3 text-xs font-semibold text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleTrigger()}
                disabled={loading}
                aria-busy={loading}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Confirm SOS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SosButton;
