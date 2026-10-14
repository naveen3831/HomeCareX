import { beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import { CustomerProfileService } from './customer-profile.service';
import { updatePreferencesBodySchema, updateProfileBodySchema } from './customer-profile.validation';
import { DEFAULT_NOTIFICATIONS } from './customer-profile.constants';
import type { ProfileDoc } from './customer-profile.types';

/* In-memory stand-in for the repository: same unique rules as the User collection's email / phone indexes. */
let users: ProfileDoc[] = [];
let openBookings: Record<string, number> = {};
let wallets: Record<string, number> = {};
const fake = {
  findById: async (id: string) => users.find((u) => String(u._id) === id) ?? null,
  findByEmail: async (email: string) => users.find((u) => u.email === email) ?? null,
  findByPhone: async (phone: string) => users.find((u) => u.phone === phone) ?? null,
  countOpenBookings: async (id: string) => openBookings[id] ?? 0,
  walletBalance: async (id: string) => wallets[id] ?? 0,
  deleteAccount: async (id: string) => {
    const before = users.length;
    users = users.filter((u) => String(u._id) !== id);
    return users.length < before;
  },
  update: async (id: string, upd: { $set?: Record<string, unknown>; $unset?: Record<string, ''> }) => {
    const u = users.find((x) => String(x._id) === id);
    if (!u) return null;
    Object.assign(u, upd.$set ?? {});
    for (const k of Object.keys(upd.$unset ?? {})) delete (u as unknown as Record<string, unknown>)[k];
    return u;
  },
};

const service = new CustomerProfileService(fake as never);
const A = new Types.ObjectId().toString();
const B = new Types.ObjectId().toString();

beforeEach(() => {
  openBookings = {};
  wallets = {};
  users = [
    { _id: A, name: 'Asha', email: 'asha@x.com', phone: '9876543210', role: 'customer' },
    { _id: B, name: 'Bala', email: 'bala@x.com', phone: '9123456780', role: 'customer' },
  ];
});

async function rejects(p: Promise<unknown>, status: number, code: string) {
  await assert.rejects(p, (e: { statusCode?: number; code?: string }) => {
    assert.equal(e.statusCode, status);
    assert.equal(e.code, code);
    return true;
  });
}

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(32)]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(16)]);

describe('GET / PATCH profile', () => {
  test('returns the signed-in customer only', async () => {
    const p = await service.getProfile(A);
    assert.deepEqual(p, { id: A, name: 'Asha', email: 'asha@x.com', phone: '9876543210' });
  });

  test('unknown user is a 404', async () => {
    await rejects(service.getProfile(new Types.ObjectId().toString()), 404, 'CUSTOMER_NOT_FOUND');
  });

  test('edits persist', async () => {
    await service.updateProfile(A, { name: 'Asha K', email: 'new@x.com', phone: '9000000001' });
    assert.deepEqual(await service.getProfile(A), { id: A, name: 'Asha K', email: 'new@x.com', phone: '9000000001' });
  });

  test('email already used by someone else -> 409 EMAIL_ALREADY_EXISTS', async () => {
    await rejects(service.updateProfile(A, { email: 'bala@x.com' }), 409, 'EMAIL_ALREADY_EXISTS');
    assert.equal((await service.getProfile(A)).email, 'asha@x.com');
  });

  test('phone already used by someone else -> 409 PHONE_ALREADY_EXISTS', async () => {
    await rejects(service.updateProfile(A, { phone: '9123456780' }), 409, 'PHONE_ALREADY_EXISTS');
  });

  test('re-sending your own email / phone is not a conflict', async () => {
    const p = await service.updateProfile(A, { email: 'asha@x.com', phone: '9876543210', name: 'Asha B' });
    assert.equal(p.name, 'Asha B');
  });

  test('a database duplicate-key race still comes back as 409', async () => {
    const racing = new CustomerProfileService({
      ...fake,
      findByEmail: async () => null,
      update: async () => {
        throw Object.assign(new Error('E11000 duplicate key index: email_1'), { code: 11000 });
      },
    } as never);
    await rejects(racing.updateProfile(A, { email: 'race@x.com' }), 409, 'EMAIL_ALREADY_EXISTS');
  });

  test('null removes the phone number', async () => {
    const p = await service.updateProfile(A, { phone: null });
    assert.equal(p.phone, undefined);
  });
});

describe('profile validation', () => {
  test('rejects bad input', () => {
    assert.equal(updateProfileBodySchema.safeParse({}).success, false);
    assert.equal(updateProfileBodySchema.safeParse({ name: 'A' }).success, false);
    assert.equal(updateProfileBodySchema.safeParse({ email: 'nope' }).success, false);
    assert.equal(updateProfileBodySchema.safeParse({ phone: '12345' }).success, false);
    assert.equal(updateProfileBodySchema.safeParse({ role: 'admin' }).success, false, 'unknown fields (role) are refused');
  });

  test('normalises email and +91 phone, blank phone means remove', () => {
    const r = updateProfileBodySchema.parse({ email: '  A@X.com ', phone: '+91 98765-43210' });
    assert.equal(r.email, 'a@x.com');
    assert.equal(r.phone, '9876543210');
    assert.equal(updateProfileBodySchema.parse({ phone: '' }).phone, null);
  });
});

describe('avatar upload', () => {
  test('accepts jpg, png and webp (checked by content)', async () => {
    for (const [buf, type] of [[JPEG, 'image/jpeg'], [PNG, 'image/png'], [WEBP, 'image/webp']] as const) {
      const p = await service.setAvatar(A, buf, type);
      assert.ok(p.avatarUrl?.startsWith(`data:${type};base64,`));
    }
  });

  test('over 2 MB -> 413 AVATAR_TOO_LARGE', async () => {
    const big = Buffer.concat([PNG, Buffer.alloc(2 * 1024 * 1024)]);
    await rejects(service.setAvatar(A, big, 'image/png'), 413, 'AVATAR_TOO_LARGE');
  });

  test('wrong content -> 415 even when the header says image/png', async () => {
    await rejects(service.setAvatar(A, Buffer.from('MZ not an image at all'), 'image/png'), 415, 'AVATAR_UNSUPPORTED_TYPE');
  });

  test('header that disagrees with the bytes -> 415', async () => {
    await rejects(service.setAvatar(A, JPEG, 'image/png'), 415, 'AVATAR_UNSUPPORTED_TYPE');
  });

  test('empty body -> 400 AVATAR_REQUIRED', async () => {
    await rejects(service.setAvatar(A, {}, 'image/png'), 400, 'AVATAR_REQUIRED');
    await rejects(service.setAvatar(A, Buffer.alloc(0), 'image/png'), 400, 'AVATAR_REQUIRED');
  });

  test('remove clears it', async () => {
    await service.setAvatar(A, PNG, 'image/png');
    assert.equal((await service.removeAvatar(A)).avatarUrl, undefined);
  });
});

describe('preferences', () => {
  test('defaults when nothing is saved', async () => {
    assert.deepEqual(await service.getPreferences(A), { language: 'en', notifications: DEFAULT_NOTIFICATIONS });
  });

  test('a partial patch changes only what was sent and persists', async () => {
    await service.updatePreferences(A, { language: 'hi', notifications: { offers: { email: true } } });
    const p = await service.getPreferences(A);
    assert.equal(p.language, 'hi');
    assert.equal(p.notifications.offers.email, true);
    assert.equal(p.notifications.offers.push, DEFAULT_NOTIFICATIONS.offers.push);
    assert.deepEqual(p.notifications.booking, DEFAULT_NOTIFICATIONS.booking);
  });

  test("one customer's preferences never leak to another", async () => {
    await service.updatePreferences(A, { language: 'te' });
    assert.equal((await service.getPreferences(B)).language, 'en');
  });

  test('validation: unknown language / topic / channel refused', () => {
    assert.equal(updatePreferencesBodySchema.safeParse({ language: 'fr' }).success, false);
    assert.equal(updatePreferencesBodySchema.safeParse({ notifications: { spam: { push: true } } }).success, false);
    assert.equal(updatePreferencesBodySchema.safeParse({ notifications: { booking: { fax: true } } }).success, false);
    assert.equal(updatePreferencesBodySchema.safeParse({}).success, false);
  });
});

describe('deleteAccount', () => {
  test('removes the account and nobody else\'s', async () => {
    assert.deepEqual(await service.deleteAccount(A), { deleted: true });
    assert.equal(users.some((u) => String(u._id) === A), false);
    assert.equal(users.some((u) => String(u._id) === B), true);
    await rejects(service.getProfile(A), 404, 'CUSTOMER_NOT_FOUND');
  });
  test('is refused while a booking is still open', async () => {
    openBookings[A] = 1;
    await rejects(service.deleteAccount(A), 409, 'ACCOUNT_HAS_OPEN_BOOKINGS');
    assert.equal(users.length, 2);
  });
  test('is refused while the wallet holds money', async () => {
    wallets[A] = 5000;
    await rejects(service.deleteAccount(A), 409, 'ACCOUNT_HAS_WALLET_BALANCE');
    assert.equal(users.length, 2);
  });
  test('an unknown account is a 404', async () => {
    await rejects(service.deleteAccount(new Types.ObjectId().toString()), 404, 'CUSTOMER_NOT_FOUND');
  });
});
