import { z } from 'zod';
import { SERVICE_SLOTS } from '../bookings/bookings.constants';
import { PRICING_MODES } from '../../models/PricingRule';

const objectIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid id');

export const quoteBodySchema = z.object({
  serviceId: objectIdString,
  quantity: z.number().int().min(1).max(20),
  addOns: z
    .array(z.object({ addOnId: objectIdString, quantity: z.number().int().min(1).max(20) }))
    .max(20)
    .default([]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  slot: z.enum(SERVICE_SLOTS, { message: 'Unrecognized slot' }),
  couponCode: z.string().trim().min(1).max(30).optional(),
});

export const pricingValidation = { quoteBodySchema };

export const getPricingQuerySchema = z.object({
  categoryId: objectIdString.optional(),
  serviceId: objectIdString.optional(),
  city: z.string().trim().max(100).optional(),
});

const surgeWindowSchema = z.object({
  label: z.string().trim().min(1).max(40),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  percent: z.number().min(0).max(200),
});

export const putPricingBodySchema = z.object({
  categoryId: objectIdString,
  serviceId: objectIdString.nullable().optional(),
  city: z.string().trim().max(100).default(''),
  mode: z.enum(PRICING_MODES),
  basePrice: z.number().min(0),
  addOns: z.array(z.object({
    name: z.string().trim().min(1).max(60),
    price: z.number().min(0),
  })).default([]),
  durationMinutes: z.number().int().min(5).max(1440).default(60),
  surgeWindows: z.array(surgeWindowSchema).default([]),
  cancellationFee: z.number().min(0).default(0),
  active: z.boolean().default(true),
});

export type GetPricingQuery = z.infer<typeof getPricingQuerySchema>;
export type PutPricingBody = z.infer<typeof putPricingBodySchema>;