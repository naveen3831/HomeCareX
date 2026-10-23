/**
 * Pricing rules, in one place. POST /pricing/quote (what the customer sees) and POST /bookings
 * (what is stored and charged) both go through calculatePricing, so the two can never disagree.
 */
export const GST_RATE = 0.18;
/** Demand surge: a percentage of (base + add-ons) for slots starting at or after SURGE_FROM_MINUTES. */
export const SURGE_RATE = 0.1;
export const SURGE_FROM_MINUTES = 18 * 60; // 18:00
export const SURGE_LABEL = 'Evening demand';

export const AUDIT_ACTION = {
  created: 'pricing_rule.created',
  updated: 'pricing_rule.updated',
  deleted: 'pricing_rule.deleted',
} as const;
export const AUDIT_ENTITY = 'pricing_rule';

export const PRICING_CONSTANTS = { GST_RATE, SURGE_RATE, SURGE_FROM_MINUTES, SURGE_LABEL };