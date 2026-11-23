
import { z } from 'zod';
import { SERVICE_SLOTS } from './bookings.constants';

const objectIdString = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'Must be a valid id');

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD');

export function normalizeSlot(raw: unknown): string {
  if (typeof raw !== 'string') return '10:00-12:00';
  if ((SERVICE_SLOTS as readonly string[]).includes(raw)) return raw;
  const cleaned = raw.replace(/\s+/g, '');
  if ((SERVICE_SLOTS as readonly string[]).includes(cleaned)) return cleaned;
  if (cleaned.startsWith('08') || cleaned.startsWith('09')) return '08:00-10:00';
  if (cleaned.startsWith('10') || cleaned.startsWith('11')) return '10:00-12:00';
  if (cleaned.startsWith('12') || cleaned.startsWith('13')) return '12:00-14:00';
  if (cleaned.startsWith('14') || cleaned.startsWith('15')) return '14:00-16:00';
  if (cleaned.startsWith('16') || cleaned.startsWith('17') || cleaned.startsWith('18')) return '16:00-18:00';
  return '10:00-12:00';
}

const slotString = z.preprocess(
  normalizeSlot,
  z.enum(SERVICE_SLOTS, {
    message: 'Unrecognized slot',
  }),
);

const addOnInputSchema = z.object({
  addOnId: z.string().min(1),
  quantity: z.number().int().min(1).max(20),
});

const addressSnapshotSchema = z.object({
  label: z.string().max(50).optional(),
  contactName: z.string().max(100).optional(),
  contactPhone: z.string().max(20).optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  landmark: z.string().max(200).optional(),
  city: z.string().min(1).max(100).default('Hyderabad'),
  state: z.string().min(1).max(100).default('Telangana'),
  pincode: z
    .string()
    .default('500081'),
  location: z.object({
    lat: z.number().gte(-90).lte(90),
    lng: z.number().gte(-180).lte(180),
  }).default({ lat: 17.4483, lng: 78.3915 }),
});

export const createBookingBodySchema = z
  .preprocess((val: any) => {
    if (val && typeof val === 'object') {
      const copy = { ...val };
      if (typeof copy.slot === 'string') {
        copy.slot = normalizeSlot(copy.slot);
      }
      if (!copy.quantity && copy.qty) {
        copy.quantity = copy.qty;
      }
      if (!copy.addressId && !copy.newAddress && copy.address) {
        copy.newAddress = {
          line1: String(copy.address).substring(0, 200),
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500081',
          location: { lat: 17.4483, lng: 78.3915 },
        };
      } else if (copy.newAddress && typeof copy.newAddress === 'object') {
        const line1 = copy.newAddress.line1 || copy.address || 'Flat 402, Sri Sai Nilayam, Madhapur';
        copy.newAddress = {
          city: 'Hyderabad',
          state: 'Telangana',
          pincode: '500081',
          location: { lat: 17.4483, lng: 78.3915 },
          ...copy.newAddress,
          line1: String(line1).substring(0, 200),
        };
        if (!copy.newAddress.location) {
          copy.newAddress.location = { lat: 17.4483, lng: 78.3915 };
        }
      }
      return copy;
    }
    return val;
  },
  z.object({
    serviceId: z.string().min(1, 'Service ID is required').max(100),
    quantity: z.number().int().min(1).max(100).default(1),
    addOns: z.array(addOnInputSchema).max(20).default([]),
    addressId: objectIdString.optional(),
    newAddress: addressSnapshotSchema.optional(),
    date: dateString,
    slot: slotString,
    couponCode: z.string().trim().min(1).max(30).optional(),
    couponId: z.string().trim().optional(),
    useReferralWallet: z.boolean().optional(),
    useWallet: z.boolean().optional(),
    expectedTotal: z.number().int().min(0).optional(),
    customerName: z.string().max(100).optional(),
    customerEmail: z.string().email().optional(),
    customerPhone: z.string().max(20).optional(),
    address: z.string().max(500).optional(),
    items: z.array(z.any()).optional(),
    idempotencyKey: z.string().max(200).optional(),
    scheduledAt: z.string().optional(),
    totalAmount: z.number().optional(),
  }))
  .refine(
    (value) =>
      Boolean(value.addressId) || Boolean(value.newAddress),
    {
      message: 'Provide an address (addressId or newAddress)',
      path: ['newAddress'],
    },
  );

export const getSlotsQuerySchema = z.object({
  date: dateString,
});

export const getSlotsParamsSchema = z.object({
  id: objectIdString,
});

export const getBookingParamsSchema = z.object({
  id: objectIdString,
});

export const checkSlotBodySchema = z.object({
  serviceId: z.string().min(1, 'Service ID is required'),
  date: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      'Date must be in YYYY-MM-DD format',
    ),
  slot: z.string().min(1, 'Slot is required'),
});

export const extraChargeDecisionParamsSchema = z.object({
  id: objectIdString,
  chargeId: objectIdString,
});

export const extraChargeDecisionBodySchema = z.object({
  decision: z.enum(['approve', 'reject']),
});

export const cancelBookingBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, 'Please tell us why you are cancelling')
    .max(500),
});

export const rescheduleBookingBodySchema = z.object({
  date: dateString,
  slot: slotString,
});
