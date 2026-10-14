import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { authService } from './auth.service';
import { authRepository } from './auth.repository';
import { registerSchema } from './auth.validation';

test('backend partner registration: validates role=partner and rejects privileged escalation', () => {
  // role: 'partner' is valid
  const partnerParsed = registerSchema.safeParse({
    name: 'Ramesh Kumar',
    email: 'ramesh@example.com',
    phone: '9876543210',
    password: 'Password123!',
    role: 'partner',
    gender: 'male',
  });
  assert.equal(partnerParsed.success, true);
  assert.equal(partnerParsed.data?.role, 'partner');
  assert.equal(partnerParsed.data?.gender, 'male');

  // role: 'admin' is rejected
  const adminParsed = registerSchema.safeParse({
    name: 'Hacker',
    email: 'hacker@example.com',
    password: 'Password123!',
    role: 'admin',
  });
  assert.equal(adminParsed.success, false);
});

test('backend partner registration: creates partner user with role partner and lands on /partner', async () => {
  const originalExists = authRepository.existsByEmailOrPhone;
  const originalCreate = authRepository.create;

  const createdUsers: any[] = [];
  (authRepository as any).existsByEmailOrPhone = async () => null;
  authRepository.create = (async (data: any) => {
    const user = {
      id: '507f1f77bcf86cd799439011',
      ...data,
      createdAt: new Date(),
      save: async function () { return this; },
    };
    createdUsers.push(user);
    return user;
  }) as any;

  try {
    const res = await authService.register({
      name: 'Ramesh Kumar',
      email: 'ramesh.partner@example.com',
      phone: '9876543210',
      password: 'SecurePassword123!',
      role: 'partner',
      gender: 'male',
      accountHolder: 'Ramesh Kumar',
      accountNumber: '1234567890123',
      ifsc: 'SBIN0001234',
      upiId: 'ramesh@upi',
      skills: ['Deep Home Cleaning', 'Kitchen Cleaning'],
    });

    assert.equal(res.user.role, 'partner');
    assert.equal(res.user.home, '/partner');
    assert.equal(createdUsers[0].gender, 'male');
    assert.ok(res.accessToken);
    assert.ok(res.refreshToken);

    // Password must be hashed with bcrypt
    assert.ok(createdUsers[0].passwordHash);
    assert.notEqual(createdUsers[0].passwordHash, 'SecurePassword123!');
    const match = await bcrypt.compare('SecurePassword123!', createdUsers[0].passwordHash);
    assert.equal(match, true);

    // Response must NOT contain passwordHash
    assert.equal((res.user as any).passwordHash, undefined);
  } finally {
    authRepository.existsByEmailOrPhone = originalExists;
    authRepository.create = originalCreate;
  }
});

test('backend partner registration: backward compatibility with customer registration', async () => {
  const originalExists = authRepository.existsByEmailOrPhone;
  const originalCreate = authRepository.create;

  (authRepository as any).existsByEmailOrPhone = async () => null;
  authRepository.create = (async (data: any) => {
    return {
      id: '507f1f77bcf86cd799439012',
      ...data,
      createdAt: new Date(),
      save: async function () { return this; },
    };
  }) as any;

  try {
    const res = await authService.register({
      name: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '9876543211',
      password: 'SecurePassword123!',
      role: 'customer',
    });

    assert.equal(res.user.role, 'customer');
    assert.equal(res.user.home, '/customer');
    assert.ok(res.accessToken);
  } finally {
    authRepository.existsByEmailOrPhone = originalExists;
    authRepository.create = originalCreate;
  }
});
