import PartnerSettingsModel, { type PartnerSettingsValues } from '../../models/PartnerSettings';

export interface SettingsRow {
  language?: PartnerSettingsValues['language'];
  notifications?: Partial<PartnerSettingsValues['notifications']>;
  privacy?: Partial<PartnerSettingsValues['privacy']>;
  security?: Partial<PartnerSettingsValues['security']>;
  updatedAt?: Date;
}

/** Only layer that talks to Mongo for partner settings. Tests swap these methods for in-memory versions. */
export const partnerSettingsRepository = {
  findByUserId(userId: string): Promise<SettingsRow | null> {
    return PartnerSettingsModel.findOne({ userId }).lean<SettingsRow | null>().exec();
  },

  /** Sets only the given dotted paths (e.g. 'notifications.sms'), creating the document on first save. */
  upsert(userId: string, set: Record<string, unknown>): Promise<SettingsRow> {
    return PartnerSettingsModel.findOneAndUpdate(
      { userId },
      { $set: set },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true },
    )
      .lean<SettingsRow>()
      .exec() as Promise<SettingsRow>;
  },
};