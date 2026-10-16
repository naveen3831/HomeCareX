import { useRef, useState } from 'react';
import { Copy, Share2 } from 'lucide-react';
import type { ReferralSummary } from '@/hooks/useReferral';
export const money = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
    paise / 100,
  );

export default function ReferralCard({ data }: { data: ReferralSummary }) {
  const [notice, setNotice] = useState('');
  const codeInput = useRef<HTMLInputElement>(null);
  const shareUrl = new URL(
    `/register?ref=${encodeURIComponent(data.code)}`,
    window.location.origin,
  ).href;
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('Copied to clipboard.');
    } catch {
      codeInput.current?.focus();
      codeInput.current?.select();
      setNotice('Select and copy your code from the field above.');
    }
  }
  return (
    <section className="hcx-support-referral-card">
      <p className="hcx-support-eyebrow">A GOOD THING TO SHARE</p>
      <h2>Invite a friend to HomeCareX</h2>
      <p className="hcx-support-muted">
        Your friend enters this code when creating a customer account.
      </p>
      <label htmlFor="referral-code">Your referral code</label>
      <input id="referral-code" value={data.code} readOnly ref={codeInput} />
      <div className="hcx-support-referral-actions">
        <button type="button" onClick={() => void copy(data.code)}>
          <Copy size={16} aria-hidden="true" />
          Copy code
        </button>
        <button
          type="button"
          className="hcx-support-primary"
          onClick={async () => {
            try {
              if (navigator.share) {
                await navigator.share({
                  title: 'Join me on HomeCareX',
                  text: `Use my referral code ${data.code} when signing up.`,
                  url: shareUrl,
                });
                setNotice('Share options opened.');
              } else await copy(shareUrl);
            } catch (error) {
              if ((error as { name?: string }).name !== 'AbortError')
                setNotice(
                  'Could not share. You can copy your referral code instead.',
                );
            }
          }}
        >
          <Share2 size={16} aria-hidden="true" />
          Share invite
        </button>
      </div>
      <p role="status">{notice}</p>
      <p className="hcx-support-muted">
        {data.rewardPerReferralPaise > 0
          ? `${money(data.rewardPerReferralPaise)} is credited to your wallet after your friend’s first completed booking. Each friend can earn one referral reward.`
          : 'Referral rewards will be announced by HomeCareX. Your invitations and completed bookings are still tracked.'}
      </p>
    </section>
  );
}
