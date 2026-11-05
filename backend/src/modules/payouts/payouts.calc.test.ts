import assert from 'node:assert/strict';
import test from 'node:test';
import { computeBatchStatus, groupEarningsByPartner, parseAnchorDate, resolvePayoutPeriod } from './payouts.calc';

test('groupEarningsByPartner sums per partner without floating point drift', () => {
  const out = groupEarningsByPartner([
    { partnerId: 'p1', gross: 0.1, commission: 0.02, net: 0.08 },
    { partnerId: 'p1', gross: 0.2, commission: 0.04, net: 0.16 },
    { partnerId: 'p2', gross: 1000, commission: 200, net: 800 },
  ]);
  const p1 = out.find((g) => g.partnerId === 'p1')!;
  assert.deepEqual({ gross: p1.gross, commission: p1.commission, net: p1.net, count: p1.count }, { gross: 0.3, commission: 0.06, net: 0.24, count: 2 });
  assert.equal(out.find((g) => g.partnerId === 'p2')!.net, 800);
});

test('computeBatchStatus follows the payouts in the batch', () => {
  assert.equal(computeBatchStatus([]), 'pending');
  assert.equal(computeBatchStatus(['pending', 'pending']), 'pending');
  assert.equal(computeBatchStatus(['paid', 'pending']), 'processing');
  assert.equal(computeBatchStatus(['processing', 'pending']), 'processing');
  assert.equal(computeBatchStatus(['failed', 'pending']), 'failed');
  assert.equal(computeBatchStatus(['paid', 'paid']), 'completed');
});

const IST = 330;

test('daily period covers exactly the IST day, so work finished today is payable today', () => {
  // 5 Nov 2026, 12:20 pm IST
  const now = new Date('2026-11-05T06:50:00.000Z');
  const { start, end } = resolvePayoutPeriod('daily', now, IST);
  assert.equal(start.toISOString(), '2026-11-04T18:30:00.000Z');
  assert.equal(end.toISOString(), '2026-11-05T18:30:00.000Z');
  assert.ok(now >= start && now < end);
});

test('weekly period runs Monday to next Monday (IST)', () => {
  const { start, end } = resolvePayoutPeriod('weekly', new Date('2026-11-05T06:50:00.000Z'), IST); // Thursday
  assert.equal(start.toISOString(), '2026-11-01T18:30:00.000Z'); // Mon 2 Nov 00:00 IST
  assert.equal(end.toISOString(), '2026-11-08T18:30:00.000Z'); // Mon 9 Nov 00:00 IST
});

test('monthly period runs from the 1st to the 1st of next month, including December rollover', () => {
  const nov = resolvePayoutPeriod('monthly', new Date('2026-11-05T06:50:00.000Z'), IST);
  assert.equal(nov.start.toISOString(), '2026-10-31T18:30:00.000Z');
  assert.equal(nov.end.toISOString(), '2026-11-30T18:30:00.000Z');
  const dec = resolvePayoutPeriod('monthly', new Date('2026-12-15T06:50:00.000Z'), IST);
  assert.equal(dec.end.toISOString(), '2026-12-31T18:30:00.000Z');
});

test('parseAnchorDate accepts real YYYY-MM-DD dates only', () => {
  assert.ok(parseAnchorDate('2026-11-05'));
  assert.equal(parseAnchorDate('2026-02-30'), null);
  assert.equal(parseAnchorDate('05-11-2026'), null);
  assert.ok(parseAnchorDate(undefined));
});
