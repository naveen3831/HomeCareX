import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, ServerCrash, Sparkles, Ticket, Timer } from 'lucide-react';
import clsx from 'clsx';
import { adminPricingApi, getPricingApiMode, type PricingApiError } from '@/services/adminPricingApi';
import type { PricingFormValues, PricingRule, ServiceOption } from '@/types/adminPricing';
import type { ServerPriceQuote } from '@/types/pricing';

/** Same slots the booking flow offers (backend SERVICE_SLOTS). */
const SLOTS = ['08:00-10:00', '10:00-12:00', '12:00-14:00', '14:00-16:00', '16:00-18:00', '18:00-20:00'];
const CONVENIENCE_FEE = 29;
const GST = 0.18;

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const tomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

const COUPON_MESSAGES: Record<string, string> = {
  COUPON_EXPIRED: 'That coupon has expired.',
  COUPON_USAGE_LIMIT: 'That coupon has reached its usage limit.',
  COUPON_NOT_APPLICABLE: 'That coupon does not apply to this service.',
  COUPON_INVALID: 'That coupon code is not valid.',
};

const Row: React.FC<{ label: string; value: string; muted?: boolean; accent?: boolean }> = ({ label, value, muted, accent }) => (
  <div className={clsx('prc-row', muted && 'is-muted', accent && 'is-accent')}><dt>{label}</dt><dd>{value}</dd></div>
);

interface Props {
  /** The values being edited in the form (drives the instant estimate). */
  values: PricingFormValues;
  /** Scope picked in the form. Drives which service the server quote is asked for. */
  scope: { categoryId: string; serviceId: string | null; city: string };
  services: ServiceOption[];
  /** The saved rule being edited, when there is one. Its add-ons carry the ids the server needs. */
  saved: PricingRule | null;
}

/**
 * Two views of the price. "Estimate" is instant and uses the values being typed (nothing is saved or sent).
 * "Server quote" calls POST /pricing/quote, so it shows what a customer would really be charged,
 * including coupon, GST, quoteId and expiry. It reads SAVED rules, so unsaved edits do not show there.
 */
export const QuotePreview: React.FC<Props> = ({ values, scope, services, saved }) => {
  const [view, setView] = useState<'estimate' | 'server'>('estimate');
  const [slot, setSlot] = useState(SLOTS[0]);
  const [qty, setQty] = useState('1');
  const [picked, setPicked] = useState<Set<number>>(new Set());

  // ---- server quote state ----
  const [date, setDate] = useState(tomorrow);
  const [serviceId, setServiceId] = useState('');
  const [coupon, setCoupon] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [quote, setQuote] = useState<ServerPriceQuote | null>(null);
  /** End date of the coupon applied to the quote (null when no coupon, or it could not be looked up). */
  const [couponEndAt, setCouponEndAt] = useState<string | null>(null);

  const categoryServices = useMemo(() => services.filter((s) => s.categoryId === scope.categoryId), [services, scope.categoryId]);
  // A service rule quotes that service; a category rule lets the admin choose which service to try.
  const quoteServiceId = scope.serviceId ?? (serviceId || categoryServices[0]?.id || '');

  useEffect(() => { setQuote(null); setError(''); setServiceId(''); setPicked(new Set()); }, [scope.categoryId, scope.serviceId]);

  const togglePick = (i: number) => setPicked((p) => { const next = new Set(p); if (next.has(i)) next.delete(i); else next.add(i); return next; });

  // ---- local estimate ----
  const q = useMemo(() => {
    const n = Math.max(1, Math.floor(Number(qty) || 1));
    const unit = Math.max(0, Number(values.basePrice) || 0);
    const base = unit * n;
    const addOns = values.addOns.reduce((sum, a, i) => (picked.has(i) ? sum + Math.max(0, Number(a.price) || 0) : sum), 0);
    const start = toMin(slot.slice(0, 5));
    const win = values.surgeWindows.find((w) => w.startTime && w.endTime && start >= toMin(w.startTime) && start < toMin(w.endTime));
    const surge = win ? Math.round((base + addOns) * ((Number(win.percent) || 0) / 100)) : 0;
    const subtotal = base + addOns + surge;
    const gst = Math.round((subtotal + CONVENIENCE_FEE) * GST);
    return { n, base, addOns, surge, surgeLabel: win?.label, subtotal, gst, total: subtotal + CONVENIENCE_FEE + gst };
  }, [values, slot, qty, picked]);

  // ---- server quote ----
  const savedAddOns = saved?.addOns ?? [];
  async function getQuote() {
    setLoading(true); setError('');
    try {
      const n = Math.max(1, Math.floor(Number(qty) || 1));
      const addOns = savedAddOns.flatMap((a, i) => (picked.has(i) && a.id ? [{ addOnId: a.id, quantity: 1 }] : []));
      const res = await adminPricingApi.quote({
        serviceId: quoteServiceId, quantity: n, addOns, date, slot,
        ...(scope.city ? { city: scope.city } : {}),
        ...(coupon.trim() ? { couponCode: coupon.trim().toUpperCase() } : {}),
      });
      setQuote(res);
      setCouponEndAt(res.coupon?.code ? await adminPricingApi.couponEndAt(res.coupon.code) : null);
    } catch (e) {
      setQuote(null); setCouponEndAt(null);
      const err = e as PricingApiError;
      setError(err.fields ? Object.values(err.fields)[0] : err.message);
    } finally { setLoading(false); }
  }

  const demo = getPricingApiMode() === 'demo';
  const couponExpired = couponEndAt !== null && new Date(couponEndAt).getTime() <= Date.now();
  const canAsk = !demo && !loading && Boolean(quoteServiceId) && Boolean(date);

  return (
    // Enter inside the preview must not submit the pricing form it sits in.
    <section className="cat-form__sec prc-vcard prc-quote" aria-labelledby="qp-title" onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}>
      <div className="prc-vcard__head">
        <h3 id="qp-title">Quote preview</h3>
        <p>{view === 'estimate' ? 'Instant estimate from the values you are editing.' : 'What a customer is charged right now, from the saved rules.'}</p>
      </div>

      <div role="tablist" aria-label="Quote source" className="prc-seg prc-seg--full">
        <button type="button" role="tab" aria-selected={view === 'estimate'} className={clsx(view === 'estimate' && 'is-on')} onClick={() => setView('estimate')}><Sparkles size={13} aria-hidden /> Estimate</button>
        <button type="button" role="tab" aria-selected={view === 'server'} className={clsx(view === 'server' && 'is-on')} onClick={() => setView('server')}><Timer size={13} aria-hidden /> Server quote</button>
      </div>

      <div className="prc-item__row prc-item__row--2">
        <label className="cat-field">
          <span>Slot</span>
          <select value={slot} onChange={(e) => setSlot(e.target.value)}>{SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        </label>
        <label className="cat-field">
          <span>{values.mode === 'HOURLY' ? 'Hours' : 'Quantity'}</span>
          <input type="number" min={1} max={20} value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>
      </div>

      {view === 'server' && (
        <>
          <div className="prc-item__row prc-item__row--2">
            <label className="cat-field">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <label className="cat-field">
              <span>Coupon</span>
              <input value={coupon} maxLength={30} placeholder="Optional" onChange={(e) => setCoupon(e.target.value)} />
            </label>
          </div>
          {scope.serviceId === null && (
            <label className="cat-field">
              <span>Service to quote</span>
              <select value={quoteServiceId} onChange={(e) => setServiceId(e.target.value)} disabled={!scope.categoryId}>
                {categoryServices.length === 0 && <option value="">No services in this category</option>}
                {categoryServices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
        </>
      )}

      {/* add-ons: estimate uses the form's add-ons, server quote uses the saved ones (they carry server ids) */}
      {view === 'estimate' && values.addOns.length > 0 && (
        <fieldset className="prc-picks">
          <legend>Add-ons</legend>
          {values.addOns.map((a, i) => (
            <label key={i} className="prc-pick">
              <input type="checkbox" checked={picked.has(i)} onChange={() => togglePick(i)} />
              <span>{a.name || `Add-on ${i + 1}`}</span>
              <em>{rupees(Math.max(0, Number(a.price) || 0))}</em>
            </label>
          ))}
        </fieldset>
      )}
      {view === 'server' && savedAddOns.length > 0 && (
        <fieldset className="prc-picks">
          <legend>Saved add-ons</legend>
          {savedAddOns.map((a, i) => (
            <label key={a.id ?? i} className="prc-pick">
              <input type="checkbox" checked={picked.has(i)} onChange={() => togglePick(i)} />
              <span>{a.name}</span>
              <em>{rupees(a.price)}</em>
            </label>
          ))}
        </fieldset>
      )}

      {view === 'estimate' ? (
        <>
          <dl className="prc-bill">
            <Row label={values.mode === 'HOURLY' ? `Rate × ${q.n} h` : q.n > 1 ? `Base × ${q.n}` : 'Base'} value={rupees(q.base)} />
            {q.addOns > 0 && <Row label="Add-ons" value={rupees(q.addOns)} />}
            {q.surge > 0 && <Row label={q.surgeLabel || 'Surge'} value={rupees(q.surge)} />}
            <Row label="Convenience fee" value={rupees(CONVENIENCE_FEE)} muted />
            <Row label="GST (18%)" value={rupees(q.gst)} muted />
            <div className="prc-row prc-row--total"><dt>Total</dt><dd>{rupees(q.total)}</dd></div>
          </dl>
          <p className="prc-note">Cancellation fee: {rupees(Math.max(0, Number(values.cancellationFee) || 0))}. Coupons are only applied by the server quote.</p>
        </>
      ) : (
        <>
          <button type="button" className="hcx-btn hcx-btn--primary prc-ask" onClick={() => void getQuote()} disabled={!canAsk}>
            {loading ? <Loader2 size={15} className="prc-spin" aria-hidden /> : <RefreshCw size={15} aria-hidden />} {quote ? 'Refresh quote' : 'Get server quote'}
          </button>

          {demo && <p className="prc-note prc-note--warn"><ServerCrash size={13} aria-hidden /> The backend is not reachable, so there is no server quote. Use the estimate.</p>}
          {!demo && !saved && <p className="prc-note">This rule is not saved yet. The server quote uses the rules that are saved, so save it first to see its price here.</p>}
          {error && <p role="alert" className="cat-err">{error}</p>}

          {quote && (
            <div className="prc-qres" aria-live="polite">
              <div className="prc-qmeta">
                {couponEndAt && (
                  <span className={clsx('prc-expiry', couponExpired && 'is-expired')}>
                    <Timer size={12} aria-hidden /> {couponExpired ? 'Coupon expired' : `Coupon valid till ${fmtDateTime(couponEndAt)}`}
                  </span>
                )}
                <span className={clsx('prc-mode', quote.mode === 'HOURLY' && 'is-hourly')}>{quote.mode === 'HOURLY' ? 'per hour' : 'fixed'}</span>
              </div>
              <dl className="prc-bill">
                {quote.lines.map((l) => (
                  <Row key={`${l.kind}-${l.refId}`} label={`${l.name}${l.quantity > 1 ? ` × ${l.quantity}` : ''}`} value={rupees(l.amount)} />
                ))}
                {quote.surge > 0 && <Row label={quote.surgeLabel || 'Surge'} value={rupees(quote.surge)} />}
                {quote.discount > 0 && <Row label={`Coupon ${quote.coupon?.code ?? ''}`} value={`− ${rupees(quote.discount)}`} accent />}
                <Row label="Convenience fee" value={rupees(quote.convenienceFee)} muted />
                <Row label="GST (18%)" value={rupees(quote.gst)} muted />
                <div className="prc-row prc-row--total"><dt>Total</dt><dd>{rupees(quote.total)}</dd></div>
              </dl>
              {quote.couponError && (
                <p className="prc-note prc-note--warn"><Ticket size={13} aria-hidden /> {COUPON_MESSAGES[quote.couponError.code] ?? (quote.couponError.code === 'COUPON_MIN_ORDER' ? `Minimum order is ${rupees(quote.couponError.minOrder ?? 0)}.` : 'The coupon was not applied.')}</p>
              )}
              <p className="prc-note">Cancellation fee: {rupees(quote.cancellationFee)}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default QuotePreview;