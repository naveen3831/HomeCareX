import assert from 'node:assert/strict';
import test from 'node:test';
import { computeBatchStatus, groupEarningsByPartner } from './payouts.calc';

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
