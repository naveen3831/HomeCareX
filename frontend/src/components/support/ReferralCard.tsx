import { useRef, useState } from "react";
import { Copy, Link2, MessageCircle, Share2 } from "lucide-react";
import type { ReferralSummary } from "@/hooks/useReferral";
export const money = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    paise / 100,
  );

const rupees = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

type Offer = NonNullable<ReferralSummary["offers"]>[number];

/** One code with its copy / share / WhatsApp / copy-link actions. */
function CodeShare({ code, inputId }: { code: string; inputId: string }) {
  const [notice, setNotice] = useState("");
  const codeInput = useRef<HTMLInputElement>(null);
  const shareUrl = new URL(
    `/register?ref=${encodeURIComponent(code)}`,
    window.location.origin,
  ).href;
  const message = `Join me on HomeCareX! Use my referral code ${code} when signing up: ${shareUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copy(text: string, done = "Copied to clipboard.") {
    try {
      await navigator.clipboard.writeText(text);
      setNotice(done);
    } catch {
      // Clipboard blocked (e.g. non-secure origin): fall back to the old execCommand copy.
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      document.body.removeChild(ta);
      setNotice(
        ok ? done : "Could not copy. Please select the link below and copy it.",
      );
    }
  }
  async function share() {
    // Native share sheet when it really works; otherwise copy the invite link so something always happens.
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "Join me on HomeCareX",
          text: `Use my referral code ${code} when signing up.`,
          url: shareUrl,
        });
        setNotice("Share options opened.");
        return;
      } catch (error) {
        if ((error as { name?: string }).name === "AbortError") return;
      }
    }
    await copy(shareUrl, "Invite link copied. Paste it in a message to your friend.");
  }

  return (
    <>
      <label htmlFor={inputId}>Your referral code</label>
      <input id={inputId} value={code} readOnly ref={codeInput} />
      <div className="hcx-support-referral-actions">
        <button type="button" onClick={() => void copy(code)}>
          <Copy size={16} aria-hidden="true" />
          Copy code
        </button>
        <button
          type="button"
          className="hcx-support-primary"
          onClick={() => void share()}
        >
          <Share2 size={16} aria-hidden="true" />
          Share invite
        </button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hcx-support-wa"
        >
          <MessageCircle size={16} aria-hidden="true" />
          WhatsApp
        </a>
        <button
          type="button"
          onClick={() => void copy(shareUrl, "Invite link copied.")}
        >
          <Link2 size={16} aria-hidden="true" />
          Copy link
        </button>
      </div>
      <p className="hcx-support-muted" style={{ wordBreak: "break-all" }}>
        {shareUrl}
      </p>
      <p role="status">{notice}</p>
    </>
  );
}

function OfferDetails({ o }: { o: Offer }) {
  return (
    <div className="hcx-support-referral-offers">
      <h3>{o.name}</h3>
      <span className="hcx-support-referral-offer-value">
        {o.discountType === "PERCENT"
          ? `${o.value}% off`
          : `${rupees(o.value)} off`}
        {o.discountType === "PERCENT" && o.maxDiscount
          ? ` (up to ${rupees(o.maxDiscount)})`
          : ""}{" "}
        on your friend’s first booking
      </span>
      <span className="hcx-support-muted">
        {o.scope === "ALL" ? "All services" : o.appliesTo.join(", ")}
        {o.minOrder > 0 ? ` · Min order ${rupees(o.minOrder)}` : ""}
        {o.endAt
          ? ` · Valid till ${new Date(o.endAt).toLocaleDateString("en-IN")}`
          : ""}
      </span>
    </div>
  );
}

export default function ReferralCard({ data }: { data: ReferralSummary }) {
  const offers = data.offers ?? [];
  // No active admin offer = nothing to share, so no code is shown at all.
  if (!offers.length) return null;
  return (
    <section className="hcx-support-referral-card">
      <p className="hcx-support-eyebrow">A GOOD THING TO SHARE</p>
      <h2>Invite a friend to HomeCareX</h2>
      <p className="hcx-support-muted">
        Each offer has its own code. Share the code of the offer you want your friend to get. Your friend enters it when creating a customer account, and gets that offer on their first booking (one offer per friend).
      </p>
      {offers.map((o) => (
        <div key={o.id} className="hcx-support-referral-offer-block">
          <OfferDetails o={o} />
          <CodeShare code={o.code} inputId={`referral-code-${o.id}`} />
        </div>
      ))}
      <p className="hcx-support-muted">
        {data.rewardPerReferralPaise > 0
          ? `${money(data.rewardPerReferralPaise)} is credited to your wallet after your friend’s first paid booking. Each friend can earn one referral reward.`
          : "Referral rewards will be announced by HomeCareX. Your invitations and completed bookings are still tracked."}
      </p>
    </section>
  );
}