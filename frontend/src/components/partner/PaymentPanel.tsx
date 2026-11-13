import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { AlertTriangle, CheckCircle2, Copy, Loader2, RefreshCw, Wallet } from 'lucide-react';
import { collectPayment, fetchJob, getErrorMessage } from '@/pages/partner/JobDetails/jobDetails.api';
import type { JobDetails } from '@/pages/partner/JobDetails/jobDetails.types';
import './paymentPanel.css';

const POLL_MS = 5000;

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

function formatPaidAt(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata',
      });
}

/** Draws the UPI link as a QR image. Returns null while generating or if it fails. */
function useQr(text: string | null): { src: string | null; failed: boolean } {
  const [state, setState] = useState<{ text: string | null; src: string | null; failed: boolean }>({
    text: null,
    src: null,
    failed: false,
  });

  useEffect(() => {
    if (!text) return;
    let cancelled = false;
    QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 1, width: 280 })
      .then((src: string) => {
        if (!cancelled) setState({ text, src, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ text, src: null, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  // Ignore a result that belongs to an older link.
  if (!text || state.text !== text) return { src: null, failed: false };
  return { src: state.src, failed: state.failed };
}

interface PaymentPanelProps {
  job: JobDetails;
  /** Called with the fresh job whenever polling sees a change (e.g. payment became PAID). */
  onJobChange?: (job: JobDetails) => void;
  online?: boolean;
}

/**
 * Collect-payment card for the partner.
 *  - before the job is completed: shows what will be due
 *  - after completion, unpaid: UPI QR the customer scans, with live "waiting" status
 *  - paid / failed / refunded: final states
 */
export default function PaymentPanel({ job, onJobChange, online = true }: PaymentPanelProps) {
  const { payment } = job;
  const jobDone = job.status === 'completed' || job.status === 'rated';
  const shouldPoll = jobDone && payment.phase === 'pending';
  const showQr = jobDone && (payment.phase === 'pending' || payment.phase === 'failed');

  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onChangeRef = useRef(onJobChange);
  useEffect(() => {
    onChangeRef.current = onJobChange;
  }, [onJobChange]);

  const refresh = useCallback(
    async (manual: boolean) => {
      if (manual) setChecking(true);
      try {
        const fresh = await fetchJob(job.id);
        setCheckError(null);
        onChangeRef.current?.(fresh);
      } catch (err) {
        if (manual) setCheckError(getErrorMessage(err, 'Could not check the payment. Try again.'));
      } finally {
        if (manual) setChecking(false);
      }
    },
    [job.id],
  );

  // Poll while the customer is paying. Skips ticks when the tab is hidden or the phone is offline.
  useEffect(() => {
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'hidden' || !navigator.onLine) return;
      void refresh(false);
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [shouldPoll, refresh]);

  const upi = payment.upi;
  const { src: qrSrc, failed: qrFailed } = useQr(showQr && upi ? upi.uri : null);

  const [cashing, setCashing] = useState(false);
  const [cashError, setCashError] = useState<string | null>(null);

  /** Partner confirms the money arrived (cash in hand, or a UPI credit seen in their UPI app). The server marks the booking PAID. */
  const markCollected = async (method: 'cash' | 'upi') => {
    const ok = window.confirm(
      method === 'cash'
        ? `Confirm you collected ${money.format(payment.amount)} in cash from the customer?`
        : `Confirm ${money.format(payment.amount)} reached the HomeCareX UPI account? Check your UPI app or the bank SMS first.`,
    );
    if (!ok) return;
    setCashing(true);
    setCashError(null);
    try {
      const fresh = await collectPayment(job.id, method);
      onChangeRef.current?.(fresh);
    } catch (err) {
      setCashError(getErrorMessage(err, 'Could not record the payment. Try again.'));
    } finally {
      setCashing(false);
    }
  };
  const markCashCollected = () => markCollected('cash');

  const cashButton = (
    <>
      <button type="button" className="pp-btn" onClick={() => void markCashCollected()} disabled={cashing || !online}>
        {cashing ? <Loader2 size={16} className="pp-spin" aria-hidden="true" /> : <Wallet size={16} aria-hidden="true" />}
        Collected cash
      </button>
      {cashError && <span className="pp-error" role="alert">{cashError}</span>}
    </>
  );

  const copyUpiId = async () => {
    if (!upi) return;
    try {
      await navigator.clipboard.writeText(upi.payeeId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // ---- Paid
  if (payment.phase === 'paid') {
    const when = formatPaidAt(payment.paidAt);
    return (
      <section className="pp-card pp-card-paid" aria-label="Payment" role="status">
        <CheckCircle2 size={28} aria-hidden="true" className="pp-icon-ok" />
        <div className="pp-body">
          <strong className="pp-title">Payment received</strong>
          <span className="pp-sub">
            {money.format(payment.amount)}
            {when ? ` · ${when}` : ''}
          </span>
        </div>
      </section>
    );
  }

  // ---- Refunded
  if (payment.phase === 'refunded') {
    return (
      <section className="pp-card" aria-label="Payment" role="status">
        <Wallet size={28} aria-hidden="true" className="pp-icon-muted" />
        <div className="pp-body">
          <strong className="pp-title">Payment refunded</strong>
          <span className="pp-sub">This booking was refunded to the customer.</span>
        </div>
      </section>
    );
  }

  // ---- Job not finished yet: nothing to scan, just tell the partner what is coming
  if (!jobDone) {
    return (
      <section className="pp-card" aria-label="Payment">
        <Wallet size={28} aria-hidden="true" className="pp-icon-muted" />
        <div className="pp-body">
          <strong className="pp-title">{money.format(payment.amount)} to collect</strong>
          <span className="pp-sub">
            The payment QR appears here once you complete the job. Extra charges the customer approved are included.
          </span>
        </div>
      </section>
    );
  }

  // ---- Completed but no UPI details came from the backend
  if (!upi || !upi.payeeId) {
    return (
      <section className="pp-card pp-card-warn" aria-label="Payment" role="alert">
        <AlertTriangle size={28} aria-hidden="true" className="pp-icon-warn" />
        <div className="pp-body">
          <strong className="pp-title">Payment details unavailable</strong>
          <span className="pp-sub">
            No UPI QR is available for this booking. If the customer pays in cash, collect {money.format(payment.amount)} and
            tap “Collected cash”.
          </span>
          {cashButton}
          <button type="button" className="pp-btn" onClick={() => void refresh(true)} disabled={checking || !online}>
            {checking ? <Loader2 size={16} className="pp-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
            Check again
          </button>
          {checkError && <span className="pp-error" role="alert">{checkError}</span>}
        </div>
      </section>
    );
  }

  // ---- Completed, unpaid (pending or failed): show the QR
  return (
    <section className="pp-card pp-card-collect" aria-label="Collect payment">
      <header className="pp-head">
        <span className="pp-eyebrow">COLLECT PAYMENT</span>
        <strong className="pp-amount">{money.format(payment.amount)}</strong>
      </header>

      {payment.phase === 'failed' && (
        <p className="pp-alert" role="alert">
          <AlertTriangle size={16} aria-hidden="true" /> The last payment attempt failed. The customer can scan the QR again.
        </p>
      )}

      <div className="pp-collect-grid">
        <div className="pp-col pp-col-qr">
          <div className="pp-qr-wrap">
            {qrSrc ? (
              <img
                className="pp-qr"
                src={qrSrc}
                alt={`UPI QR code to pay ${money.format(payment.amount)} to ${upi.payeeName}`}
                width={220}
                height={220}
              />
            ) : qrFailed ? (
              <p className="pp-error" role="alert">Could not draw the QR. Use the UPI ID below.</p>
            ) : (
              <div className="pp-qr-skel" aria-busy="true" aria-label="Preparing QR code" />
            )}
          </div>
        </div>

      <div className="pp-col pp-col-actions">
        <div className="pp-payee">
          <div>
            <span className="pp-label">Paying to</span>
            <strong>{upi.payeeName}</strong>
            <span className="pp-upi-id">{upi.payeeId}</span>
          </div>
        </div>

        <div className="pp-col pp-col-actions">
          <div className="pp-payee">
            <div>
              <span className="pp-label">Paying to</span>
              <strong>{upi.payeeName}</strong>
              <span className="pp-upi-id">{upi.payeeId}</span>
            </div>
            <button type="button" className="pp-btn pp-btn-ghost" onClick={() => void copyUpiId()} aria-live="polite">
              <Copy size={16} aria-hidden="true" /> {copied ? 'Copied' : 'Copy ID'}
            </button>
          </div>

          <p className="pp-hint">Ask the customer to scan with any UPI app (GPay, PhonePe, Paytm, BHIM).</p>

          <div className="pp-wait" role="status" aria-live="polite">
            {online ? (
              <>After the customer pays, check the money in your UPI app, then tap “UPI payment received”.</>
            ) : (
              <>You are offline. Reconnect to record the payment.</>
            )}
          </div>

          <button type="button" className="pp-btn pp-btn-primary" onClick={() => void markCollected('upi')} disabled={cashing || !online}>
            {cashing ? <Loader2 size={16} className="pp-spin" aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
            UPI payment received
          </button>

          <button type="button" className="pp-btn" onClick={() => void refresh(true)} disabled={checking || !online}>
            {checking ? <Loader2 size={16} className="pp-spin" aria-hidden="true" /> : <RefreshCw size={16} aria-hidden="true" />}
            Check payment now
          </button>
          {checkError && <p className="pp-error" role="alert">{checkError}</p>}

          {cashButton}
        </div>
      </div>
      </div>
    </section>
  );
}