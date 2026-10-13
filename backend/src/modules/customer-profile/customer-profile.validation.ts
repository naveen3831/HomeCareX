import { z } from 'zod';
import { LANGUAGES, NOTIFICATION_CHANNELS, NOTIFICATION_TOPICS } from './customer-profile.constants';

/** Same phone rules as registration: +91 / 91 prefixes and separators are stripped, 10 digits starting 6-9. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((val) => {
    const cleaned = val.replace(/[\s()-]/g, '');
    if (cleaned.startsWith('+91')) return cleaned.slice(3);
    if (cleaned.startsWith('91') && cleaned.length === 12) return cleaned.slice(2);
    return cleaned;
  })
  .refine((v) => /^[6-9]\d{9}$/.test(v), { message: 'Enter a valid 10-digit mobile number' });

export const updateProfileBodySchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80, 'Name is too long').optional(),
    email: z.string().trim().toLowerCase().email('Enter a valid email').optional(),
    /** "" or null removes the phone number. */
    phone: z.union([phoneSchema, z.literal('').transform(() => null), z.null()]).optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Send at least one field to update' });

const channelShape = Object.fromEntries(NOTIFICATION_CHANNELS.map((c) => [c, z.boolean().optional()])) as Record<
  (typeof NOTIFICATION_CHANNELS)[number],
  z.ZodOptional<z.ZodBoolean>
>;
const topicShape = Object.fromEntries(
  NOTIFICATION_TOPICS.map((t) => [t, z.object(channelShape).strict().optional()]),
) as Record<(typeof NOTIFICATION_TOPICS)[number], z.ZodOptional<z.ZodObject<typeof channelShape, 'strict'>>>;

export const updatePreferencesBodySchema = z
  .object({
    language: z.enum(LANGUAGES, { errorMap: () => ({ message: 'Choose English, Hindi or Telugu' }) }).optional(),
    notifications: z.object(topicShape).strict().optional(),
  })
  .strict()
  .refine((v) => v.language !== undefined || v.notifications !== undefined, { message: 'Send at least one field to update' });
