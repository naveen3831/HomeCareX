export interface QuoteLine {
  kind: 'BASE' | 'ADDON';
  refId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  amount: number;
}

export interface QuoteAddOnInput {
  addOnId: string;
  quantity: number;
}

export interface QuoteInput {
  serviceId: string;
  quantity: number;
  addOns: QuoteAddOnInput[];
  date: string;
  slot: string;
  city?: string;
  couponCode?: string;
}

/** The money part of a quote. Whole rupees. total = subtotal - discount + convenienceFee + gst. */
export interface PricingBreakdown {
  addOnsTotal: number;
  surge: number;
  surgeLabel?: string;
  /** base + add-ons + surge */
  subtotal: number;
  /** coupon discount + referral discount */
  discount: number;
  convenienceFee: number;
  gst: number;
  total: number;
}

/** Response of POST /pricing/quote. Matches frontend/src/types/pricing.ts (PriceQuote). */
export interface PriceQuote extends PricingBreakdown {
  quoteId?: string;
  expiresAt?: string;
  currency: 'INR';
  mode?: string;
  cancellationFee?: number;
  lines: QuoteLine[];
  coupon: { code: string; discount: number } | null;
  couponError?: { code: string; minOrder?: number };
  /** First-booking discount for a referred customer. Already included in `discount`. */
  referral?: { programId: string; name: string; discount: number } | null;
  computedAt: string;
}

export interface PricingTypes {
  QuoteInput: QuoteInput;
  PriceQuote: PriceQuote;
}
