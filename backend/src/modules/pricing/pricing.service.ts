import { randomUUID } from 'crypto';
import { AppError } from '../../utils/AppError';
import { HttpError } from '../auth/auth.types';
import { couponsService } from '../coupons/coupons.service';
import { ServiceModel } from '../../models/Service';
import type { SurgeWindow } from '../../models/PricingRule';
import { CONVENIENCE_FEE } from '../bookings/bookings.constants';
import { slotStartMinutes } from '../bookings/bookings.time';
import { GST_RATE, QUOTE_TTL_MINUTES, SURGE_FROM_MINUTES, SURGE_LABEL, SURGE_RATE } from './pricing.constants';
import { pricingRepository } from './pricing.repository';
import type { PriceQuote, PricingBreakdown, QuoteInput, QuoteLine } from './pricing.types';

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

export interface ResolvedRule {
  mode: 'FIXED' | 'HOURLY';
  basePrice: number;
  cancellationFee: number;
  surgeWindows: SurgeWindow[];
  addOns: { id: string; name: string; price: number }[];
}

/** Most specific active rule wins: service+city, service, category+city, category. null = none, use the Service's own price. */
export async function resolveRule(categoryId: string, serviceId: string, city = ''): Promise<ResolvedRule | null> {
  const rows = await pricingRepository.findCandidates(categoryId, serviceId, city.trim());
  const score = (r: { serviceId?: unknown; city?: string }) => (r.serviceId ? 2 : 0) + (r.city ? 1 : 0);
  const best = [...rows].sort((a, b) => score(b) - score(a))[0];
  if (!best) return null;
  return {
    mode: best.mode,
    basePrice: best.basePrice,
    cancellationFee: best.cancellationFee,
    surgeWindows: best.surgeWindows ?? [],
    addOns: (best.addOns ?? []).map((a) => ({ id: String(a._id), name: a.name, price: a.price })),
  };
}

/**
 * The one place price maths lives. `lines` are the BASE line followed by the ADDON lines, already
 * resolved against the database. Used by quote() below and by BookingService.createBooking.
 */
export function calculatePricing({
  lines,
  slot,
  discount = 0,
  rule,
}: {
  lines: { amount: number }[];
  slot: string;
  discount?: number;
  /** When a PricingRule applies, its surge windows replace the built-in evening surge. */
  rule?: Pick<ResolvedRule, 'surgeWindows'> | null;
}): PricingBreakdown {
  const baseAmount = lines[0]?.amount ?? 0;
  const addOnsTotal = lines.slice(1).reduce((sum, l) => sum + l.amount, 0);
  const start = slotStartMinutes(slot);
  let surgePercent = 0;
  let surgeLabelText = SURGE_LABEL;
  if (rule) {
    const w = rule.surgeWindows.find((x) => start >= toMin(x.startTime) && start < toMin(x.endTime));
    if (w) {
      surgePercent = w.percent / 100;
      surgeLabelText = w.label;
    }
  } else if (start >= SURGE_FROM_MINUTES) {
    surgePercent = SURGE_RATE;
  }
  const hasSurge = surgePercent > 0;
  const surge = hasSurge ? Math.round((baseAmount + addOnsTotal) * surgePercent) : 0;
  const subtotal = baseAmount + addOnsTotal + surge;
  const gst = Math.round((subtotal - discount + CONVENIENCE_FEE) * GST_RATE);
  return {
    addOnsTotal,
    surge,
    ...(hasSurge ? { surgeLabel: surgeLabelText } : {}),
    subtotal,
    discount,
    convenienceFee: CONVENIENCE_FEE,
    gst,
    total: subtotal - discount + CONVENIENCE_FEE + gst,
  };
}

/** The coupons module has a few more codes than the frontend's COUPON_ERROR list; fold them into the nearest one. */
export function toQuoteCouponCode(code: string): string {
  switch (code) {
    case 'COUPON_EXPIRED':
    case 'COUPON_MIN_ORDER':
    case 'COUPON_NOT_APPLICABLE':
    case 'COUPON_USAGE_LIMIT':
      return code;
    case 'COUPON_PER_USER_LIMIT':
      return 'COUPON_USAGE_LIMIT';
    default: // COUPON_INVALID, COUPON_INACTIVE, COUPON_NOT_STARTED
      return 'COUPON_INVALID';
  }
}

export const pricingService = {
  /** POST /pricing/quote. Prices come from the database; the client only sends ids and quantities. */
  async quote(input: QuoteInput, userId: string): Promise<PriceQuote> {
    const row = await ServiceModel.findOne({ _id: input.serviceId, active: { $ne: false } }, 'name basePrice addOns categoryId').lean();
    if (!row) throw new AppError(404, 'SERVICE_NOT_FOUND', 'That service was not found');

    if (new Set(input.addOns.map((a) => a.addOnId)).size !== input.addOns.length) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Each add-on can only be listed once');
    }

    const rule = await resolveRule(String(row.categoryId), String(row._id), input.city);
    const unitPrice = rule?.basePrice ?? row.basePrice;

    const lines: QuoteLine[] = [
      {
        kind: 'BASE',
        refId: String(row._id),
        name: row.name,
        unitPrice,
        quantity: input.quantity,
        amount: unitPrice * input.quantity,
      },
    ];
    for (const a of input.addOns) {
      const ruleAddOn = rule?.addOns.find((x) => x.id === a.addOnId);
      const addOn = ruleAddOn
        ? { _id: ruleAddOn.id, name: ruleAddOn.name, price: ruleAddOn.price }
        : (row.addOns ?? []).find((x) => String(x._id) === a.addOnId);
      if (!addOn) {
        throw new AppError(422, 'ADDON_NOT_FOUND', 'One of the selected add-ons is not available for this service', {
          addOnId: a.addOnId,
        });
      }
      lines.push({
        kind: 'ADDON',
        refId: String(addOn._id),
        name: addOn.name,
        unitPrice: addOn.price,
        quantity: a.quantity,
        amount: addOn.price * a.quantity,
      });
    }

    // Coupon: validated by the coupons module against the order value priced above (rule price + add-ons).
    let coupon: PriceQuote['coupon'] = null;
    let couponError: PriceQuote['couponError'];
    if (input.couponCode) {
      const orderValue = lines.reduce((sum, l) => sum + l.amount, 0);
      try {
        coupon = await couponsService.validate(
          { serviceId: input.serviceId, quantity: input.quantity, addOns: input.addOns, date: input.date, slot: input.slot, couponCode: input.couponCode },
          userId,
          { orderValue },
        );
      } catch (err) {
        // A bad coupon never fails the quote: the price is returned without it, plus the reason.
        if (!(err instanceof HttpError) || !err.code?.startsWith('COUPON_')) throw err;
        const minOrder = err.details?.find((d) => d.field === 'minOrder');
        couponError = { code: toQuoteCouponCode(err.code), ...(minOrder ? { minOrder: Number(minOrder.message) } : {}) };
      }
    }

    const now = new Date();
    return {
      quoteId: randomUUID(),
      expiresAt: new Date(now.getTime() + QUOTE_TTL_MINUTES * 60_000).toISOString(),
      currency: 'INR',
      mode: rule?.mode ?? 'FIXED',
      cancellationFee: rule?.cancellationFee ?? 0,
      lines,
      ...calculatePricing({ lines, slot: input.slot, discount: coupon?.discount ?? 0, rule }),
      coupon,
      ...(couponError ? { couponError } : {}),
      computedAt: now.toISOString(),
    };
  },
};

export class PricingService {}