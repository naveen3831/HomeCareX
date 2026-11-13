import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculatePricing, toQuoteCouponCode } from './pricing.service';

const lines = (...amounts: number[]) => amounts.map((amount) => ({ amount }));

// base 1000 + add-on 200 = 1200; evening surge 10% = 120 -> subtotal 1320
// coupon 100 -> taxable = 1320 - 100 + 29 (fee) = 1249; GST 18% = 225; total = 1320 - 100 + 29 + 225 = 1474
test('quote maths: base + add-ons + surge - coupon + GST = total', () => {
  const p = calculatePricing({ lines: lines(1000, 200), slot: '18:00-20:00', discount: 100 });
  assert.equal(p.addOnsTotal, 200);
  assert.equal(p.surge, 120);
  assert.equal(p.subtotal, 1320);
  assert.equal(p.discount, 100);
  assert.equal(p.gst, 225);
  assert.equal(p.total, 1474);
});

test('a coupon lowers GST too (GST is charged on the discounted amount)', () => {
  const without = calculatePricing({ lines: lines(1000), slot: '08:00-10:00' });
  const withCoupon = calculatePricing({ lines: lines(1000), slot: '08:00-10:00', discount: 200 });
  assert.ok(withCoupon.gst < without.gst);
  assert.equal(withCoupon.total, withCoupon.subtotal - 200 + withCoupon.convenienceFee + withCoupon.gst);
});

test('a PricingRule surge window replaces the built-in evening surge', () => {
  const rule = { surgeWindows: [{ label: 'Morning rush', startTime: '08:00', endTime: '10:00', percent: 20 }] };
  const morning = calculatePricing({ lines: lines(500), slot: '08:00-10:00', rule });
  assert.equal(morning.surge, 100);
  assert.equal(morning.surgeLabel, 'Morning rush');
  const evening = calculatePricing({ lines: lines(500), slot: '18:00-20:00', rule });
  assert.equal(evening.surge, 0); // the rule has no evening window, so no built-in surge either
});

test('referral discount is combined with coupon and reduces taxable amount', () => {
  // base 799; referral discount 160 (20%) -> subtotal 799; discount 160; fee 29; GST (799 - 160 + 29)*0.18 = 120; total = 788
  const p = calculatePricing({ lines: lines(799), slot: '14:00-16:00', discount: 160 });
  assert.equal(p.subtotal, 799);
  assert.equal(p.discount, 160);
  assert.equal(p.convenienceFee, 29);
  assert.equal(p.gst, 120);
  assert.equal(p.total, 788);
});

test('coupon module error codes fold into the codes the frontend knows', () => {
  assert.equal(toQuoteCouponCode('COUPON_EXPIRED'), 'COUPON_EXPIRED');
  assert.equal(toQuoteCouponCode('COUPON_MIN_ORDER'), 'COUPON_MIN_ORDER');
  assert.equal(toQuoteCouponCode('COUPON_PER_USER_LIMIT'), 'COUPON_USAGE_LIMIT');
  assert.equal(toQuoteCouponCode('COUPON_INACTIVE'), 'COUPON_INVALID');
  assert.equal(toQuoteCouponCode('COUPON_NOT_STARTED'), 'COUPON_INVALID');
});
