import { Types } from 'mongoose';
import { SettingModel } from '../../models/Settings';
import { Errors } from '../../utils/errors';
import { auditService } from '../audit/audit.service';
import {
  SETTING_DEFAULTS,
  SETTING_KEYS,
  SETTING_META,
  SETTING_SECTION_IDS,
  SETTING_SECTION_LABELS,
  SETTINGS_AUDIT,
  type SettingKey,
  type SettingValue,
} from './settings.constants';
import { checkSetting, sameValue } from './settings.validation';

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { value: unknown; at: number }>();

const isKey = (k: string): k is SettingKey => (SETTING_KEYS as string[]).includes(k);

/** Inserts any missing defaults. Never overwrites values an admin already changed. Safe to run on every boot. */
export async function seedDefaultSettings(): Promise<number> {
  const existing = new Set((await SettingModel.find({}, 'key').lean()).map((s) => s.key));
  const missing = SETTING_KEYS.filter((k) => !existing.has(k));
  if (missing.length) {
    await SettingModel.insertMany(
      missing.map((key) => ({ key, value: SETTING_DEFAULTS[key].value, description: SETTING_DEFAULTS[key].description })),
    );
  }
  return missing.length;
}

/** Read one setting. Falls back to the built-in default if the DB has no row (or is unreachable). */
export async function getSetting<K extends SettingKey>(key: K): Promise<SettingValue<K>> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value as SettingValue<K>;
  let value: unknown = SETTING_DEFAULTS[key].value;
  try {
    const row = await SettingModel.findOne({ key }).lean();
    if (row) value = row.value;
  } catch {
    /* use default */
  }
  cache.set(key, { value, at: Date.now() });
  return value as SettingValue<K>;
}

/** Drops the cached value so the next getSetting() reads the database (all keys when none is given). */
export function clearSettingsCache(key?: string): void {
  if (key) cache.delete(key);
  else cache.clear();
}

export interface SettingActor {
  id: string;
  ip: string;
}

async function currentValues(): Promise<Map<SettingKey, { value: unknown; updatedAt?: Date }>> {
  const rows = await SettingModel.find().lean();
  const byKey = new Map(rows.map((r) => [r.key, r]));
  return new Map(
    SETTING_KEYS.map((key) => [
      key,
      { value: byKey.get(key)?.value ?? SETTING_DEFAULTS[key].value, updatedAt: (byKey.get(key) as { updatedAt?: Date } | undefined)?.updatedAt },
    ]),
  );
}

export const settingsService = {
  /** Settings grouped by section, each with label / value / description / validation, ready for the admin page. */
  async list() {
    const values = await currentValues();
    return {
      sections: SETTING_SECTION_IDS.map((id) => ({
        id,
        ...SETTING_SECTION_LABELS[id],
        settings: SETTING_KEYS.filter((k) => SETTING_META[k].section === id).map((key) => {
          const { section: _section, ...meta } = SETTING_META[key];
          return {
            key,
            ...meta,
            description: SETTING_DEFAULTS[key].description,
            default: SETTING_DEFAULTS[key].value,
            value: values.get(key)!.value,
            updatedAt: values.get(key)!.updatedAt ?? null,
          };
        }),
      })),
    };
  },

  /**
   * Saves several settings at once. Every value is validated first; if ANY is invalid nothing is written and the
   * response lists each bad field. Only values that really changed are written, and each one gets an audit row
   * (before / after, who, from which IP).
   */
  async updateMany(input: unknown, actor: SettingActor) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0) {
      throw Errors.badRequest('Send at least one setting to update');
    }

    const cleaned = new Map<SettingKey, unknown>();
    const problems: { field: string; message: string }[] = [];
    for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
      if (!isKey(key)) {
        problems.push({ field: key, message: `Unknown setting: ${key}` });
        continue;
      }
      const checked = checkSetting(key, raw);
      if (checked.ok) cleaned.set(key, checked.value);
      else problems.push({ field: key, message: checked.message });
    }
    if (problems.length) throw Errors.validation(problems);

    const before = await currentValues();
    const changes = [...cleaned].filter(([key, value]) => !sameValue(before.get(key)!.value, value));

    if (changes.length) {
      await SettingModel.bulkWrite(
        changes.map(([key, value]) => ({
          updateOne: {
            filter: { key },
            update: {
              $set: {
                value,
                description: SETTING_DEFAULTS[key].description,
                updatedBy: new Types.ObjectId(actor.id),
              },
            },
            upsert: true,
          },
        })),
      );
      for (const [key] of changes) cache.delete(key);

      for (const [key, value] of changes) {
        try {
          await auditService.recordAudit({
            actor: actor.id,
            action: SETTINGS_AUDIT.action,
            entity: SETTINGS_AUDIT.entity,
            entityId: key,
            before: { value: before.get(key)!.value },
            after: { value },
            ip: actor.ip,
            result: 'Success',
          });
        } catch (err) {
          console.error(`[settings] audit write failed for ${key} (by ${actor.id})`, err);
        }
      }
    }

    return { changed: changes.map(([key]) => key), ...(await this.list()) };
  },

  /** Single-key update (kept for older callers). Same validation and audit as updateMany. */
  async update(key: string, value: unknown, actor: SettingActor) {
    if (!isKey(key)) throw Errors.badRequest(`Unknown setting: ${key}`);
    await this.updateMany({ [key]: value }, actor);
    const saved = checkSetting(key, value);
    return { key, value: saved.ok ? saved.value : value };
  },
};
