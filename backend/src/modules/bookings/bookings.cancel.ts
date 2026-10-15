export interface CancellationPolicy {
  windowHours: number;
  feeAmount: number;
}

export interface CancellationQuote {
  windowHours: number;
  paidAmount: number;
  freeCancellation: boolean;
  fee: number;
  feeAmount: number;
  refundAmount: number;
}

export function computeCancellation({
  slotStart,
  now,
  paidAmount,
  policy,
}: {
  slotStart: Date;
  now: Date;
  paidAmount: number;
  policy: CancellationPolicy;
}): CancellationQuote {
  const paid = Number.isFinite(paidAmount) ? Math.max(0, paidAmount) : 0;

  const windowHours = Math.max(0, Number(policy?.windowHours ?? 0));

  const feeAmount = Math.max(0, Number(policy?.feeAmount ?? 0));

  const windowMs = windowHours * 60 * 60 * 1000;
  const timeRemainingMs = slotStart.getTime() - now.getTime();

  const freeCancellation = timeRemainingMs >= windowMs || paid <= 0;

  const fee = freeCancellation ? 0 : Math.min(feeAmount, paid);

  return {
    windowHours,
    paidAmount: paid,
    feeAmount,
    freeCancellation,
    fee,
    refundAmount: Math.max(paid - fee, 0),
  };
}
