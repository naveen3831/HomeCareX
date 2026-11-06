import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptSecret, encryptSecret } from './partner-withdrawals.crypto';
import { addBankAccountSchema, createWithdrawalSchema } from './partner-withdrawals.validation';

process.env.JWT_SECRET ||= 'test-secret';

const bank = {
  type: 'bank',
  accountHolder: 'Ravi Kumar',
  bankName: 'HDFC Bank',
  accountNumber: '123456789012',
  confirmAccountNumber: '123456789012',
  ifsc: 'hdfc0001234',
};

test('bank account: accepts valid details and upper-cases the IFSC', () => {
  const r = addBankAccountSchema.safeParse(bank);
  assert.ok(r.success);
  if (r.success && r.data.type === 'bank') assert.equal(r.data.ifsc, 'HDFC0001234');
});

test('bank account: rejects mismatched confirmation, short number and bad IFSC', () => {
  assert.equal(addBankAccountSchema.safeParse({ ...bank, confirmAccountNumber: '123456789013' }).success, false);
  assert.equal(addBankAccountSchema.safeParse({ ...bank, accountNumber: '1234', confirmAccountNumber: '1234' }).success, false);
  assert.equal(addBankAccountSchema.safeParse({ ...bank, ifsc: 'HDFC1001234' }).success, false);
});

test('upi: accepts name@bank, rejects junk', () => {
  assert.ok(addBankAccountSchema.safeParse({ type: 'upi', accountHolder: 'Ravi Kumar', upiId: 'ravi.k@okhdfcbank' }).success);
  assert.equal(addBankAccountSchema.safeParse({ type: 'upi', accountHolder: 'Ravi Kumar', upiId: 'ravi' }).success, false);
});

test('withdrawal: amount limits, decimals, unknown keys', () => {
  const id = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  assert.ok(createWithdrawalSchema.safeParse({ amount: 500, bankAccountId: id }).success);
  assert.ok(createWithdrawalSchema.safeParse({ amount: 500.5, bankAccountId: id }).success);
  assert.equal(createWithdrawalSchema.safeParse({ amount: 99, bankAccountId: id }).success, false);
  assert.equal(createWithdrawalSchema.safeParse({ amount: 500.123, bankAccountId: id }).success, false);
  assert.equal(createWithdrawalSchema.safeParse({ amount: '500', bankAccountId: id }).success, false);
  assert.equal(createWithdrawalSchema.safeParse({ amount: 500, bankAccountId: id, partnerId: id }).success, false);
});

test('account numbers round-trip through encryption and are not stored in clear', () => {
  const enc = encryptSecret('123456789012');
  assert.ok(!enc.includes('123456789012'));
  assert.equal(decryptSecret(enc), '123456789012');
  assert.notEqual(encryptSecret('123456789012'), enc); // fresh IV each time
});
