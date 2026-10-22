import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

export const SETTINGS_LANGUAGES = ['en', 'hi', 'te'] as const;
export const LOCATION_SHARING_MODES = ['active_jobs', 'online'] as const;

export type SettingsLanguage = (typeof SETTINGS_LANGUAGES)[number];
export type LocationSharingMode = (typeof LOCATION_SHARING_MODES)[number];

export interface PartnerSettingsValues {
  language: SettingsLanguage;
  notifications: { push: boolean; sms: boolean; email: boolean; jobAlerts: boolean; promotions: boolean };
  privacy: { locationSharing: LocationSharingMode; allowCalls: boolean; allowChat: boolean };
  security: { loginAlerts: boolean };
}

/** What a partner sees before they have saved anything. Reading never creates a document. */
export const DEFAULT_PARTNER_SETTINGS: PartnerSettingsValues = {
  language: 'en',
  notifications: { push: true, sms: true, email: true, jobAlerts: true, promotions: false },
  privacy: { locationSharing: 'active_jobs', allowCalls: true, allowChat: true },
  security: { loginAlerts: true },
};

const D = DEFAULT_PARTNER_SETTINGS;

const PartnerSettingsSchema = new Schema(
  {
    /** One document per partner user. Always taken from the verified JWT, never from the request. */
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    language: { type: String, enum: SETTINGS_LANGUAGES, default: D.language },
    notifications: {
      push: { type: Boolean, default: D.notifications.push },
      sms: { type: Boolean, default: D.notifications.sms },
      email: { type: Boolean, default: D.notifications.email },
      jobAlerts: { type: Boolean, default: D.notifications.jobAlerts },
      promotions: { type: Boolean, default: D.notifications.promotions },
    },
    privacy: {
      locationSharing: { type: String, enum: LOCATION_SHARING_MODES, default: D.privacy.locationSharing },
      allowCalls: { type: Boolean, default: D.privacy.allowCalls },
      allowChat: { type: Boolean, default: D.privacy.allowChat },
    },
    security: {
      loginAlerts: { type: Boolean, default: D.security.loginAlerts },
    },
  },
  { timestamps: true },
);

export type PartnerSettings = InferSchemaType<typeof PartnerSettingsSchema> & { _id: Types.ObjectId };
export const PartnerSettingsModel = model('PartnerSettings', PartnerSettingsSchema);
export default PartnerSettingsModel;