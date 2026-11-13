import clsx from "clsx";
import { Check, Wallet } from "lucide-react";
import { ErrorState } from "@/components/customer";
import type { PriceQuote } from "@/types/pricing";
import { formatINR } from "../formatMoney";

export interface ReferralEligibility {
  eligible: boolean;
  rewardAmount: number;
  referralId?: string;
  alreadyCredited?: boolean;
  alreadyUsed?: boolean;
  programName?: string;
}

export interface PriceBreakdownProps {
  quote: PriceQuote | undefined;
  isLoading: boolean;
  /** A newer quote is loading; the old numbers stay visible but are marked as updating. */
  isRefreshing?: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  walletBalance?: number;
  isWalletSelected?: boolean;
  onToggleWallet?: () => void;
  walletApplied?: number;
  remainingPayable?: number;
  // Backwards-compatible props
  referralEligibility?: ReferralEligibility | null;
  useReferralWallet?: boolean;
  onToggleReferralWallet?: () => void;
  walletUsed?: number;
  displayGst?: number;
  displayTotal?: number;
}

function Row({ label, value, muted = false, positive = false, strong = false }: {
  label: string;
  value: string;
  muted?: boolean;
  positive?: boolean;
  strong?: boolean;
}) {
  const tone = positive ? "text-green-700" : muted ? "text-muted" : "text-ink";
  return (
    <div className={`flex items-baseline justify-between gap-4 text-sm ${tone} ${strong ? "font-semibold" : ""}`}>
      <dt>{label}</dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}

function BreakdownSkeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-2">
      <span className="sr-only">Calculating your price…</span>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex justify-between gap-4" aria-hidden="true">
          <div className="h-4 w-1/2 animate-pulse rounded bg-line" />
          <div className="h-4 w-16 animate-pulse rounded bg-line" />
        </div>
      ))}
    </div>
  );
}

/** Renders the server's quote line by line with HomeCareX Wallet deduction. */
export default function PriceBreakdown({
  quote,
  isLoading,
  isRefreshing = false,
  isError,
  errorMessage,
  onRetry,
  walletBalance = 0,
  isWalletSelected,
  onToggleWallet,
  walletApplied,
  remainingPayable,
  useReferralWallet,
  onToggleReferralWallet,
  walletUsed,
  displayTotal,
}: PriceBreakdownProps) {
  if (isLoading) return <BreakdownSkeleton />;
  if (isError || !quote) {
    return (
      <ErrorState
        title="Couldn't calculate your price"
        message={errorMessage ?? "Please check your connection and try again."}
        onRetry={onRetry}
      />
    );
  }

  const selected = isWalletSelected ?? useReferralWallet ?? false;
  const handleToggle = onToggleWallet ?? onToggleReferralWallet;
  const originalTotal = quote.total;
  const finalWalletApplied =
    walletApplied ?? walletUsed ?? (selected ? Math.min(Math.max(0, walletBalance), originalTotal) : 0);
  const finalTotal =
    remainingPayable ?? displayTotal ?? (selected ? Math.max(0, originalTotal - finalWalletApplied) : originalTotal);

  const [base, ...addOns] = quote.lines;

  return (
    <dl aria-label="Price breakdown" aria-busy={isRefreshing} className={`space-y-2 ${isRefreshing ? "opacity-60" : ""}`}>
      {/* 1. Service price */}
      <Row label={`${base.name} × ${base.quantity}`} value={formatINR(base.amount)} />
      {addOns.map((l) => (
        <Row key={l.refId} label={l.quantity > 1 ? `${l.name} × ${l.quantity}` : l.name} value={`+${formatINR(l.amount)}`} muted />
      ))}

      {/* 2. Evening demand charge / Surge */}
      {quote.surge > 0 && <Row label={quote.surgeLabel ?? "Evening demand"} value={`+${formatINR(quote.surge)}`} muted />}

      {/* 3. Subtotal */}
      <div className="border-t border-line pt-1.5">
        <Row label="Subtotal" value={formatINR(quote.subtotal)} />
      </div>

      {/* 4. Coupon discount */}
      {quote.coupon && (
        <Row
          label={`Coupon (${quote.coupon.code})`}
          value={`−${formatINR(quote.coupon.discount ?? quote.discount)}`}
          positive
        />
      )}

      {/* HomeCareX Wallet interactive component */}
      <div className="py-0.5">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          onClick={() => {
            handleToggle?.();
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleToggle?.();
            }
          }}
          className={clsx(
            "flex items-center justify-between gap-3 px-3.5 py-3 rounded-2xl cursor-pointer transition-all duration-200 select-none",
            selected
              ? "border-2 border-[#6366F1] bg-[#F5F3FF]/40 shadow-xs"
              : "border border-slate-200 bg-white hover:border-slate-300"
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
              <Wallet className="h-5 w-5" />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#16A34A] text-white ring-2 ring-white">
                <Check className="h-2.5 w-2.5 stroke-[3]" />
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                HomeCareX Wallet
              </p>
              <p className="text-[11px] sm:text-xs font-semibold text-[#6366F1] leading-tight">
                {formatINR(walletBalance)} Balance
              </p>
            </div>
          </div>
          <div className="shrink-0">
            <div
              className={clsx(
                "flex h-5 w-5 items-center justify-center rounded-md transition-colors",
                selected
                  ? "bg-[#6366F1] text-white"
                  : "border-2 border-slate-300 bg-white"
              )}
            >
              {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
            </div>
          </div>
        </div>
      </div>

      {/* 5. HomeCareX Wallet deduction row (green text, negative amount) */}
      {selected && finalWalletApplied > 0 && (
        <Row
          label="HomeCareX Wallet"
          value={`−${formatINR(finalWalletApplied)}`}
          positive
        />
      )}

      {/* 6. Convenience fee */}
      <Row label="Convenience fee" value={formatINR(quote.convenienceFee)} muted />

      {/* 7. GST */}
      <Row label="GST" value={formatINR(quote.gst)} muted />

      {/* 8. Final Total Payable */}
      <div className="border-t border-line pt-1.5">
        <Row label="Total" value={formatINR(finalTotal)} strong />
      </div>
    </dl>
  );
}
