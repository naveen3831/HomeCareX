import { z } from 'zod';
import { LOCATION_SHARING_MODES, SETTINGS_LANGUAGES } from '../../models/PartnerSettings';

const hasAnyValue = (o: Record<string, unknown>) => Object.values(o).some((v) => v !== undefined);
const NOTHING_TO_CHANGE = 'Send at least one setting to change';

/**
 * Every schema is strict: any field that is not listed (role, userId, passwordHash, email, tokenVersion...)
 * is a 400, so sensitive fields can never be written through settings.
 */
export const notificationsPatchSchema = z
  .object({
    push: z.boolean().optional(),
    sms: z.boolean().optional(),
    email: z.boolean().optional(),
    jobAlerts: z.boolean().optional(),
    promotions: z.boolean().optional(),
  })
  .strict()
  .refine(hasAnyValue, NOTHING_TO_CHANGE);

export const privacyPatchSchema = z
  .object({
    locationSharing: z.enum(LOCATION_SHARING_MODES).optional(),
    allowCalls: z.boolean().optional(),
    allowChat: z.boolean().optional(),
  })
  .strict()
  .refine(hasAnyValue, NOTHING_TO_CHANGE);

/** Password, sessions and logout-all live in central auth. 2FA is not offered until central auth supports it. */
export const securityPatchSchema = z
  .object({
    loginAlerts: z.boolean().optional(),
  })
  .strict()
  .refine(hasAnyValue, NOTHING_TO_CHANGE);

/** PATCH /partner/settings: language, or any section at once. */
export const settingsPatchSchema = z
  .object({
    language: z.enum(SETTINGS_LANGUAGES).optional(),
    notifications: notificationsPatchSchema.optional(),
    privacy: privacyPatchSchema.optional(),
    security: securityPatchSchema.optional(),
  })
  .strict()
  .refine(hasAnyValue, NOTHING_TO_CHANGE);

export type NotificationsPatch = z.infer<typeof notificationsPatchSchema>;
export type PrivacyPatch = z.infer<typeof privacyPatchSchema>;
export type SecurityPatch = z.infer<typeof securityPatchSchema>;
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;