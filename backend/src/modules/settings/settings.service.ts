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

const isKey = (key: string): key is SettingKey =>
  (SETTING_KEYS as readonly string[]).includes(key);

/**
 * Inserts missing defaults without overwriting values already changed
 * by an administrator.
 */
export async function seedDefaultSettings(): Promise<number> {
  const existingRows = await SettingModel.find({}, 'key').lean();

  const existing = new Set(existingRows.map((setting) => setting.key));

  const missing = SETTING_KEYS.filter((key) => !existing.has(key));

  if (missing.length > 0) {
    await SettingModel.insertMany(
      missing.map((key) => ({
        key,
        value: SETTING_DEFAULTS[key].value,
        description: SETTING_DEFAULTS[key].description,
      })),
    );
  }

  return missing.length;
}

/**
 * Reads one setting.
 * Uses the cached value when available and falls back to the default
 * if the database read fails or the setting does not exist.
 */
export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<SettingValue<K>> {
  const cached = cache.get(key);

  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.value as SettingValue<K>;
  }

  let value: unknown = SETTING_DEFAULTS[key].value;

  try {
    const row = await SettingModel.findOne({ key }).lean();

    if (row) {
      value = row.value;
    }
  } catch {
    // Use the built-in default if the database is unavailable.
  }

  cache.set(key, {
    value,
    at: Date.now(),
  });

  return value as SettingValue<K>;
}

/**
 * Clears one cached setting or the entire cache.
 */
export function clearSettingsCache(key?: string): void {
  if (key) {
    cache.delete(key);
    return;
  }

  cache.clear();
}

export interface SettingActor {
  id: string;
  ip: string;
}

/**
 * Returns the current value and last update time for every known setting.
 */
async function currentValues(): Promise<
  Map<SettingKey, { value: unknown; updatedAt?: Date }>
> {
  const rows = await SettingModel.find().lean();

  const byKey = new Map(rows.map((row) => [row.key, row]));

  return new Map(
    SETTING_KEYS.map((key) => {
      const row = byKey.get(key);

      return [
        key,
        {
          value: row?.value ?? SETTING_DEFAULTS[key].value,
          updatedAt: row?.updatedAt,
        },
      ];
    }),
  );
}

export const settingsService = {
  /**
   * Lists settings grouped by section for the admin settings page.
   */
  async list() {
    const values = await currentValues();

    return {
      sections: SETTING_SECTION_IDS.map((id) => ({
        id,
        ...SETTING_SECTION_LABELS[id],
        settings: SETTING_KEYS.filter(
          (key) => SETTING_META[key].section === id,
        ).map((key) => {
          const { section: _section, ...meta } = SETTING_META[key];
          const current = values.get(key)!;

          return {
            key,
            ...meta,
            description: SETTING_DEFAULTS[key].description,
            default: SETTING_DEFAULTS[key].value,
            value: current.value,
            updatedAt: current.updatedAt ?? null,
          };
        }),
      })),
    };
  },

  /**
   * Validates and updates multiple settings.
   *
   * If any value is invalid, nothing is written.
   * Only changed values are persisted and audited.
   */
  async updateMany(input: unknown, actor: SettingActor) {
    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).length === 0
    ) {
      throw Errors.badRequest('Send at least one setting to update');
    }

    const cleaned = new Map<SettingKey, unknown>();

    const problems: { field: string; message: string }[] = [];

    for (const [key, rawValue] of Object.entries(
      input as Record<string, unknown>,
    )) {
      if (!isKey(key)) {
        problems.push({
          field: key,
          message: `Unknown setting: ${key}`,
        });

        continue;
      }

      const checked = checkSetting(key, rawValue);

      if (checked.ok) {
        cleaned.set(key, checked.value);
      } else {
        problems.push({
          field: key,
          message: checked.message,
        });
      }
    }

    if (problems.length > 0) {
      throw Errors.validation(problems);
    }

    const before = await currentValues();

    const changes = [...cleaned].filter(([key, value]) => {
      return !sameValue(before.get(key)!.value, value);
    });

    if (changes.length > 0) {
      // SettingModel.updatedBy expects a MongoDB ObjectId.
      // Validate the actor ID before sending it to MongoDB.
      if (!Types.ObjectId.isValid(actor.id)) {
        throw Errors.badRequest('Invalid setting actor ID');
      }

      const updatedBy = new Types.ObjectId(actor.id);

      await SettingModel.bulkWrite(
        changes.map(([key, value]) => ({
          updateOne: {
            filter: { key },
            update: {
              $set: {
                value,
                description: SETTING_DEFAULTS[key].description,
                updatedBy,
              },
            },
            upsert: true,
          },
        })),
      );

      // Invalidate cached values after a successful database write.
      for (const [key] of changes) {
        cache.delete(key);
      }

      // Audit each changed setting independently.
      for (const [key, value] of changes) {
        try {
          await auditService.recordAudit({
            actor: actor.id,
            action: SETTINGS_AUDIT.action,
            entity: SETTINGS_AUDIT.entity,
            entityId: key,
            before: {
              value: before.get(key)!.value,
            },
            after: {
              value,
            },
            ip: actor.ip,
            result: 'Success',
          });
        } catch (error) {
          console.error(
            `[settings] Audit write failed for ${key} (by ${actor.id})`,
            error,
          );
        }
      }
    }

    return {
      changed: changes.map(([key]) => key),
      ...(await this.list()),
    };
  },

  /**
   * Updates one setting using the same validation and audit logic.
   */
  async update(key: string, value: unknown, actor: SettingActor) {
    if (!isKey(key)) {
      throw Errors.badRequest(`Unknown setting: ${key}`);
    }

    await this.updateMany(
      {
        [key]: value,
      },
      actor,
    );

    const checked = checkSetting(key, value);

    return {
      key,
      value: checked.ok ? checked.value : value,
    };
  },
};
