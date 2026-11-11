import { SETTING_META, type SettingKey, type SettingMeta } from './settings.constants';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[0-9][0-9 -]{6,18}$/;
const PINCODE = /^\d{6}$/;
// Opened in a new tab from the footer, so only web links: anything else (javascript:, data:) is refused.
const URL_LINK = /^https?:\/\/[^\s/$.?#][^\s]*$/i;

const FORMATS = {
  email: { re: EMAIL, message: 'must be a valid email address' },
  phone: { re: PHONE, message: 'must be a valid phone number' },
  pincode: { re: PINCODE, message: 'must be a 6-digit pincode' },
  url: { re: URL_LINK, message: 'must be a full link starting with https://' },
} as const;

export type Checked = { ok: true; value: unknown } | { ok: false; message: string };

const fail = (message: string): Checked => ({ ok: false, message });

/** Checks one value against its meta and returns the cleaned value (trimmed strings, de-duplicated lists). Pure: no DB. */
export function checkSetting(key: SettingKey, raw: unknown): Checked {
  const meta: SettingMeta = SETTING_META[key];
  const label = meta.label;

  switch (meta.type) {
    case 'boolean':
      return typeof raw === 'boolean' ? { ok: true, value: raw } : fail(`${label} must be on or off`);

    case 'number':
    case 'integer': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) return fail(`${label} must be a number`);
      if (meta.type === 'integer' && !Number.isInteger(raw)) return fail(`${label} must be a whole number`);
      if (meta.min !== undefined && raw < meta.min) return fail(`${label} cannot be less than ${meta.min}`);
      if (meta.max !== undefined && raw > meta.max) return fail(`${label} cannot be more than ${meta.max}`);
      return { ok: true, value: raw };
    }

    case 'string': {
      if (typeof raw !== 'string') return fail(`${label} must be text`);
      const value = raw.trim();
      if (!value) return meta.optional ? { ok: true, value: '' } : fail(`${label} is required`);
      if (meta.maxLength && value.length > meta.maxLength) return fail(`${label} cannot be longer than ${meta.maxLength} characters`);
      if (meta.format && !FORMATS[meta.format].re.test(value)) return fail(`${label} ${FORMATS[meta.format].message}`);
      return { ok: true, value };
    }

    case 'list': {
      if (!Array.isArray(raw)) return fail(`${label} must be a list`);
      const items = raw.map((v) => (typeof v === 'string' ? v.trim() : v));
      if (items.length === 0) return fail(`${label} needs at least one entry`);
      for (const item of items) {
        if (typeof item !== 'string' || !item) return fail(`${label} cannot contain empty entries`);
        if (meta.format && !FORMATS[meta.format].re.test(item)) return fail(`${label}: "${item}" ${FORMATS[meta.format].message}`);
      }
      return { ok: true, value: [...new Set(items as string[])] };
    }
  }
}

export const sameValue = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);