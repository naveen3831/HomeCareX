import { DEFAULT_PARTNER_SETTINGS as D, type PartnerSettingsValues } from '../../models/PartnerSettings';
import { AppError } from '../../utils/AppError';
import { partnerSettingsRepository as repo, type SettingsRow } from './partner-settings.repository';
import type { NotificationsPatch, PrivacyPatch, SecurityPatch, SettingsPatch } from './partner-settings.validation';

export interface PartnerSettingsDto extends PartnerSettingsValues {
  updatedAt: string | null;
}

/** Saved values over the defaults, so a new partner (or a field added later) always gets a full object. */
export const toDto = (row: SettingsRow | null): PartnerSettingsDto => ({
  language: row?.language ?? D.language,
  notifications: { ...D.notifications, ...(row?.notifications ?? {}) },
  privacy: { ...D.privacy, ...(row?.privacy ?? {}) },
  security: { ...D.security, ...(row?.security ?? {}) },
  updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
});

const SECTIONS = ['notifications', 'privacy', 'security'] as const;

/** { notifications: { sms: false } } -> { 'notifications.sms': false }, so other fields are never overwritten. */
const toSetPaths = (patch: SettingsPatch): Record<string, unknown> => {
  const set: Record<string, unknown> = {};
  if (patch.language !== undefined) set.language = patch.language;
  for (const section of SECTIONS) {
    const values = patch[section];
    if (!values) continue;
    for (const [key, value] of Object.entries(values)) {
      if (value !== undefined) set[`${section}.${key}`] = value;
    }
  }
  return set;
};

/** `userId` is always the verified JWT subject. */
export const partnerSettingsService = {
  async get(userId: string): Promise<PartnerSettingsDto> {
    return toDto(await repo.findByUserId(userId));
  },

  async update(userId: string, patch: SettingsPatch): Promise<PartnerSettingsDto> {
    const set = toSetPaths(patch);
    if (Object.keys(set).length === 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Send at least one setting to change');
    }
    return toDto(await repo.upsert(userId, set));
  },

  updateNotifications: (userId: string, body: NotificationsPatch) => partnerSettingsService.update(userId, { notifications: body }),
  updatePrivacy: (userId: string, body: PrivacyPatch) => partnerSettingsService.update(userId, { privacy: body }),
  updateSecurity: (userId: string, body: SecurityPatch) => partnerSettingsService.update(userId, { security: body }),
};