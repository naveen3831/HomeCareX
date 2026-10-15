import assert from 'node:assert/strict';
import { afterEach, describe, test } from 'node:test';
import bcrypt from 'bcryptjs';
import { authRepository } from './auth.repository';
import { authService } from './auth.service';
import { changePasswordSchema } from './auth.validation';

const original = authRepository.findByIdWithPassword;
afterEach(() => {
  authRepository.findByIdWithPassword = original;
});

function stubUser(overrides: Record<string, unknown> = {}) {
  const user = { status: 'active', passwordHash: bcrypt.hashSync('Old@1234', 4), saves: 0, async save() { this.saves += 1; }, ...overrides };
  authRepository.findByIdWithPassword = (async () => user) as never;
  return user;
}

describe('authService.changePassword', () => {
  test('stores the new password (hashed) when the current one is right', async () => {
    const user = stubUser();
    assert.deepEqual(await authService.changePassword('u1', { currentPassword: 'Old@1234', newPassword: 'New@12345' }), { changed: true });
    assert.equal(user.saves, 1);
    assert.ok(await bcrypt.compare('New@12345', user.passwordHash));
    assert.ok(!(await bcrypt.compare('Old@1234', user.passwordHash)));
  });

  test('wrong current password -> 400 INVALID_CURRENT_PASSWORD (not 401), nothing saved', async () => {
    const user = stubUser();
    await assert.rejects(
      authService.changePassword('u1', { currentPassword: 'Wrong@123', newPassword: 'New@12345' }),
      (e: { status?: number; code?: string }) => e.status === 400 && e.code === 'INVALID_CURRENT_PASSWORD',
    );
    assert.equal(user.saves, 0);
  });

  test('unknown or blocked user -> 401', async () => {
    authRepository.findByIdWithPassword = (async () => null) as never;
    await assert.rejects(authService.changePassword('nope', { currentPassword: 'a', newPassword: 'b' }), (e: { status?: number }) => e.status === 401);
    stubUser({ status: 'blocked' });
    await assert.rejects(authService.changePassword('u1', { currentPassword: 'Old@1234', newPassword: 'New@12345' }), (e: { status?: number }) => e.status === 401);
  });
});

describe('changePasswordSchema', () => {
  const ok = { currentPassword: 'Old@1234', newPassword: 'New@12345', confirmPassword: 'New@12345' };
  test('accepts a strong, matching, different password', () => {
    assert.equal(changePasswordSchema.safeParse(ok).success, true);
  });
  test('rejects weak, mismatched and unchanged passwords', () => {
    assert.equal(changePasswordSchema.safeParse({ ...ok, newPassword: 'weak', confirmPassword: 'weak' }).success, false);
    assert.equal(changePasswordSchema.safeParse({ ...ok, confirmPassword: 'Other@12345' }).success, false);
    assert.equal(changePasswordSchema.safeParse({ ...ok, newPassword: 'Old@1234', confirmPassword: 'Old@1234' }).success, false);
    assert.equal(changePasswordSchema.safeParse({ newPassword: 'New@12345' }).success, false);
  });
});