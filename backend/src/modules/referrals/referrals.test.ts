import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertNotSelfReferral,
  configuredRewardPaise,
} from './referrals.service';

test('self-referrals are rejected at the service boundary', () => {
  assert.throws(() => assertNotSelfReferral('customer-a', 'customer-a'), {
    status: 400,
    code: 'SELF_REFERRAL',
  });
  assert.doesNotThrow(() => assertNotSelfReferral('customer-a', 'customer-b'));
});
test('reward amounts are server configuration and must be integer paise', () => {
  const previous = process.env.REFERRAL_REWARD_PAISE;
  try {
    process.env.REFERRAL_REWARD_PAISE = '5000';
    assert.equal(configuredRewardPaise(), 5000);
    for (const invalid of ['-1', '2.5', 'NaN', '10000001']) {
      process.env.REFERRAL_REWARD_PAISE = invalid;
      assert.throws(configuredRewardPaise);
    }
    delete process.env.REFERRAL_REWARD_PAISE;
    assert.equal(configuredRewardPaise(), 0);
  } finally {
    if (previous === undefined) delete process.env.REFERRAL_REWARD_PAISE;
    else process.env.REFERRAL_REWARD_PAISE = previous;
  }
});
