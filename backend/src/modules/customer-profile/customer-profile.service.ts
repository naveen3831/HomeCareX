import { AppError } from '../../utils/AppError';
import { customerProfileRepository } from './customer-profile.repository';
import {
  AVATAR_MAX_BYTES,
  DEFAULT_LANGUAGE,
  DEFAULT_NOTIFICATIONS,
  LANGUAGES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_TOPICS,
  type AvatarType,
  type Language,
  type NotificationMatrix,
} from './customer-profile.constants';
import type { PreferencesPatch, PreferencesView, ProfileDoc, ProfilePatch, ProfileView } from './customer-profile.types';

const isDuplicateKey = (err: unknown): boolean => (err as { code?: number })?.code === 11000;

const EMAIL_TAKEN = () => new AppError(409, 'EMAIL_ALREADY_EXISTS', 'That email is already used by another account.', [{ field: 'email', message: 'That email is already in use' }]);
const PHONE_TAKEN = () => new AppError(409, 'PHONE_ALREADY_EXISTS', 'That phone number is already used by another account.', [{ field: 'phone', message: 'That phone number is already in use' }]);

/** What the file starts with, per type. Checked against the bytes, so a renamed .exe can't pass as a .png. */
function sniffImageType(buf: Buffer): AvatarType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function toProfileView(d: ProfileDoc): ProfileView {
  return {
    id: String(d._id),
    name: d.name,
    email: d.email,
    ...(d.phone ? { phone: d.phone } : {}),
    ...(d.avatar ? { avatarUrl: d.avatar } : {}),
  };
}

/** Stored prefs merged over the defaults, so a new topic or channel never comes back undefined. */
export function resolveNotifications(stored: unknown): NotificationMatrix {
  const src = (stored && typeof stored === 'object' ? stored : {}) as Record<string, Record<string, unknown> | undefined>;
  const out = {} as NotificationMatrix;
  for (const topic of NOTIFICATION_TOPICS) {
    out[topic] = { ...DEFAULT_NOTIFICATIONS[topic] };
    for (const ch of NOTIFICATION_CHANNELS) {
      const v = src[topic]?.[ch];
      if (typeof v === 'boolean') out[topic][ch] = v;
    }
  }
  return out;
}

function toPreferencesView(d: ProfileDoc): PreferencesView {
  const language = (LANGUAGES as readonly string[]).includes(d.language ?? '') ? (d.language as Language) : DEFAULT_LANGUAGE;
  return { language, notifications: resolveNotifications(d.notificationPrefs) };
}

export class CustomerProfileService {
  constructor(private repo: typeof customerProfileRepository = customerProfileRepository) {}

  private async mustFind(userId: string): Promise<ProfileDoc> {
    const user = await this.repo.findById(userId);
    if (!user) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Your account was not found.');
    return user;
  }

  async getProfile(userId: string): Promise<ProfileView> {
    return toProfileView(await this.mustFind(userId));
  }

  async updateProfile(userId: string, patch: ProfilePatch): Promise<ProfileView> {
    const current = await this.mustFind(userId);
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ''> = {};

    if (patch.name !== undefined) $set.name = patch.name;

    if (patch.email !== undefined && patch.email !== current.email) {
      const owner = await this.repo.findByEmail(patch.email);
      if (owner && String(owner._id) !== userId) throw EMAIL_TAKEN();
      $set.email = patch.email;
    }

    if (patch.phone !== undefined) {
      if (patch.phone === null) {
        if (current.phone) $unset.phone = '';
      } else if (patch.phone !== current.phone) {
        const owner = await this.repo.findByPhone(patch.phone);
        if (owner && String(owner._id) !== userId) throw PHONE_TAKEN();
        $set.phone = patch.phone;
      }
    }

    if (!Object.keys($set).length && !Object.keys($unset).length) return toProfileView(current);

    try {
      const updated = await this.repo.update(userId, {
        ...(Object.keys($set).length ? { $set } : {}),
        ...(Object.keys($unset).length ? { $unset } : {}),
      });
      if (!updated) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Your account was not found.');
      return toProfileView(updated);
    } catch (err) {
      // Two people claiming the same email/phone at the same instant: the unique index decides.
      if (isDuplicateKey(err)) {
        const text = String((err as { message?: string }).message ?? '');
        throw text.includes('phone') ? PHONE_TAKEN() : EMAIL_TAKEN();
      }
      throw err;
    }
  }

  /** Validates the raw upload (type by content, size) and stores it as a data URL. Returns the new profile. */
  async setAvatar(userId: string, body: unknown, declaredType: string | undefined): Promise<ProfileView> {
    await this.mustFind(userId);
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new AppError(400, 'AVATAR_REQUIRED', 'Choose a JPG, PNG or WebP image to upload.');
    }
    if (body.length > AVATAR_MAX_BYTES) {
      throw new AppError(413, 'AVATAR_TOO_LARGE', 'The image must be 2 MB or smaller.');
    }
    const actual = sniffImageType(body);
    if (!actual || (declaredType && declaredType !== actual)) {
      throw new AppError(415, 'AVATAR_UNSUPPORTED_TYPE', 'Only JPG, PNG and WebP images are allowed.');
    }
    const avatar = `data:${actual};base64,${body.toString('base64')}`;
    const updated = await this.repo.update(userId, { $set: { avatar } });
    if (!updated) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Your account was not found.');
    return toProfileView(updated);
  }

  async removeAvatar(userId: string): Promise<ProfileView> {
    await this.mustFind(userId);
    const updated = await this.repo.update(userId, { $unset: { avatar: '' } });
    if (!updated) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Your account was not found.');
    return toProfileView(updated);
  }

  async getPreferences(userId: string): Promise<PreferencesView> {
    return toPreferencesView(await this.mustFind(userId));
  }

  async updatePreferences(userId: string, patch: PreferencesPatch): Promise<PreferencesView> {
    const current = await this.mustFind(userId);
    const $set: Record<string, unknown> = {};
    if (patch.language !== undefined) $set.language = patch.language;
    if (patch.notifications) {
      const merged = resolveNotifications(current.notificationPrefs);
      for (const topic of NOTIFICATION_TOPICS) {
        const channels = patch.notifications[topic];
        if (!channels) continue;
        for (const ch of NOTIFICATION_CHANNELS) {
          if (typeof channels[ch] === 'boolean') merged[topic][ch] = channels[ch] as boolean;
        }
      }
      $set.notificationPrefs = merged;
    }
    const updated = await this.repo.update(userId, { $set });
    if (!updated) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Your account was not found.');
    return toPreferencesView(updated);
  }

  /**
   * Permanently deletes the customer's own account (the token's user, nobody else's). Refused while a booking is still
   * in flight or the wallet still holds money, so nobody loses a service or a balance by accident.
   */
  async deleteAccount(userId: string): Promise<{ deleted: true }> {
    await this.mustFind(userId);
    if ((await this.repo.countOpenBookings(userId)) > 0) {
      throw new AppError(409, 'ACCOUNT_HAS_OPEN_BOOKINGS', 'You still have a booking in progress. Finish or cancel it, then delete your account.');
    }
    if ((await this.repo.walletBalance(userId)) > 0) {
      throw new AppError(409, 'ACCOUNT_HAS_WALLET_BALANCE', 'Your wallet still has a balance. Use it up before deleting your account.');
    }
    if (!(await this.repo.deleteAccount(userId))) throw new AppError(404, 'CUSTOMER_NOT_FOUND', 'Your account was not found.');
    return { deleted: true };
  }
}

export const customerProfileService = new CustomerProfileService();
