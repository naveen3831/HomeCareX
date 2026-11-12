import React, { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  fetchAdminReferralMoney,
  type ReferralAudience,
  type ReferralMoney as ReferralMoneyData,
  type ReferralPerson,
} from '@/services/adminPaymentApi';
import { formatDateTime, formatMoney } from './paymentFormat';

const PAGE_SIZE = 15;

const TYPE_TABS: { value: '' | ReferralAudience; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'PARTNER', label: 'Partners' },
];

const WALLET_LABEL = { customer_wallet: 'Customer wallet', partner_wallet: 'Partner wallet' } as const;

const Person: React.FC<{ p: ReferralPerson | null }> = ({ p }) =>
  p ? (
    <div>
      <strong>{p.name}</strong>
      <div className="prm-sub">{p.role === 'partner' ? 'Partner' : 'Customer'}{p.phone ? ` · ${p.phone}` : ''}</div>
    </div>
  ) : (
    <span className="prm-sub">Unknown user</span>
  );

/** Admin > Payments > Referral money: who got referral credit in their wallet, and referral discounts used. */
const ReferralMoney: React.FC = () => {
  const [type, setType] = useState<'' | ReferralAudience>('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReferralMoneyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setData(await fetchAdminReferralMoney({ page, limit: PAGE_SIZE, ...(type ? { type } : {}) }));
    } catch (e) {
      setError((e as { message?: string })?.message || 'Could not load referral money.');
    } finally {
      setLoading(false);
    }
  }, [page, type]);

  useEffect(() => { void load(); }, [load]);

  const t = data?.totals;

  return (
    <div className="admin-page-container pay-page">
      <header className="pay-head">
        <div>
          <h1 className="pay-head__title">Referral money</h1>
          <p className="pay-head__desc">
            Wallet credit paid to the referrer and the new friend when the friend&apos;s first booking (customers) or first
            job (partners) goes through, and referral discounts used on bookings.
          </p>
        </div>
      </header>

      <section className="pay-totals" aria-label="Referral totals">
        <div className="pay-total pay-total--paid">
          <div className="pay-total__body">
            <span className="pay-total__label">Credited to wallets</span>
            <strong className="pay-total__value">{t ? formatMoney(t.totalCredited) : '—'}</strong>
            <span className="pay-total__sub">{t ? `${t.customer.referrals + t.partner.referrals} referrals rewarded` : ' '}</span>
          </div>
        </div>
        <div className="pay-total pay-total--pending">
          <div className="pay-total__body">
            <span className="pay-total__label">Customers</span>
            <strong className="pay-total__value">{t ? formatMoney(t.customer.referrerCredited + t.customer.friendCredited) : '—'}</strong>
            <span className="pay-total__sub">{t ? `${t.customer.referrals} referrals` : ' '}</span>
          </div>
        </div>
        <div className="pay-total pay-total--refunded">
          <div className="pay-total__body">
            <span className="pay-total__label">Partners</span>
            <strong className="pay-total__value">{t ? formatMoney(t.partner.referrerCredited + t.partner.friendCredited) : '—'}</strong>
            <span className="pay-total__sub">{t ? `${t.partner.referrals} referrals` : ' '}</span>
          </div>
        </div>
        <div className="pay-total pay-total--failed">
          <div className="pay-total__body">
            <span className="pay-total__label">Referral discount used</span>
            <strong className="pay-total__value">{t ? formatMoney(t.discountUsed.amount) : '—'}</strong>
            <span className="pay-total__sub">{t ? `${t.discountUsed.count} bookings` : ' '}</span>
          </div>
        </div>
      </section>

      <div className="pay-tabs pay-tabs--inner" role="tablist" aria-label="Referral type">
        {TYPE_TABS.map((o) => (
          <button
            key={o.value || 'all'}
            type="button"
            role="tab"
            aria-selected={type === o.value}
            className={`pay-tab${type === o.value ? ' is-selected' : ''}`}
            onClick={() => { setType(o.value); setPage(1); }}
          >
            {o.label}
          </button>
        ))}
      </div>

      {error && <div className="pay-alert" role="alert">{error}</div>}

      <section className="pay-card" aria-busy={loading}>
        <h2 className="prm-title">Wallet credits</h2>
        {loading && !data ? (
          <p className="prm-sub prm-pad">Loading…</p>
        ) : !data || data.credits.length === 0 ? (
          <p className="prm-sub prm-pad">No referral credits yet.</p>
        ) : (
          <div className="prm-scroll">
            <table className="pay-table">
              <thead>
                <tr><th>Credited to</th><th>Role in referral</th><th>Wallet</th><th>Amount</th><th>Credited on</th></tr>
              </thead>
              <tbody>
                {data.credits.map((c) => (
                  <tr key={c.id}>
                    <td><Person p={c.user} /></td>
                    <td>{c.side === 'referrer' ? 'Referrer (shared the code)' : 'New friend (joined with the code)'}</td>
                    <td>{WALLET_LABEL[c.wallet]}</td>
                    <td><strong>{formatMoney(c.amount)}</strong></td>
                    <td>{formatDateTime(c.creditedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && data.meta.pages > 1 && (
          <div className="prm-pager">
            <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft size={16} /></button>
            <span>Page {data.meta.page} of {data.meta.pages}</span>
            <button type="button" disabled={page >= data.meta.pages || loading} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight size={16} /></button>
          </div>
        )}
      </section>

      {type !== 'PARTNER' && (
        <section className="pay-card">
          <h2 className="prm-title">Referral discounts used on bookings</h2>
          {!data || data.discounts.length === 0 ? (
            <p className="prm-sub prm-pad">No referral discounts used yet.</p>
          ) : (
            <div className="prm-scroll">
              <table className="pay-table">
                <thead>
                  <tr><th>Booking</th><th>Customer</th><th>Offer</th><th>Discount</th><th>Used on</th></tr>
                </thead>
                <tbody>
                  {data.discounts.map((d) => (
                    <tr key={d.id}>
                      <td>{d.bookingRef}</td>
                      <td><Person p={d.customer} /></td>
                      <td>{d.program ?? 'Referral offer'}</td>
                      <td><strong>{formatMoney(d.amount)}</strong></td>
                      <td>{formatDateTime(d.usedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default ReferralMoney;
