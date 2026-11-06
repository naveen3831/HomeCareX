import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../utils/AppError';
import { PayoutsService } from './payouts.service';

const adminId = '507f1f77bcf86cd799439011';
const batchId = '507f1f77bcf86cd799439013';
const payoutId = '507f1f77bcf86cd799439014';

const baseRepo = {
  generateBatch: async () => ({}) as never,
  listBatches: async () => ({ items: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } }),
  findBatchById: async () => null,
  listPayouts: async () => [],
};

let audits: { action: string; result: string }[] = [];
const audit = {
  recordAudit: async (input: { action: string; result: string }) => {
    audits.push(input);
  },
};

test('confirmBatch passes the admin to the repository and audits a success', async () => {
  audits = [];
  let received: { batchId: string; adminId: string } | null = null;

  const service = new PayoutsService(
    {
      ...baseRepo,
      confirmBatch: async (input: { batchId: string; adminId: string }) => {
        received = input;
        return {
          batch: { _id: batchId, status: 'completed' } as never,
          confirmedCount: 4,
          confirmedAmount: 3200,
          failed: [],
        };
      },
    },
    audit as never,
  );

  const result = await service.confirmBatch({ batchId, adminId, ip: '127.0.0.1' });

  assert.deepEqual(received, { batchId, adminId });
  assert.equal(result?.confirmedCount, 4);
  assert.equal(result?.confirmedAmount, 3200);
  assert.deepEqual(audits.map((a) => [a.action, a.result]), [['PAYOUT_BATCH_CONFIRMED', 'Success']]);
});

test('confirmBatch audits partial failures as Failed', async () => {
  audits = [];

  const service = new PayoutsService(
    {
      ...baseRepo,
      confirmBatch: async () => ({
        batch: { _id: batchId, status: 'processing' } as never,
        confirmedCount: 1,
        confirmedAmount: 500,
        failed: [{ payoutId, message: 'boom' }],
      }),
    },
    audit as never,
  );

  await service.confirmBatch({ batchId, adminId, ip: '127.0.0.1' });
  assert.equal(audits[0].result, 'Failed');
});

test('confirmBatch rejects invalid ids', async () => {
  const service = new PayoutsService(baseRepo as never, audit as never);

  await assert.rejects(
    () => service.confirmBatch({ batchId: 'nope', adminId, ip: 'x' }),
    (e: unknown) => e instanceof AppError && e.code === 'INVALID_BATCH_ID',
  );
  await assert.rejects(
    () => service.confirmBatch({ batchId, adminId: 'nope', ip: 'x' }),
    (e: unknown) => e instanceof AppError && e.code === 'INVALID_ADMIN_ID',
  );
});

test('getPayoutDetails validates the id and returns the repository result', async () => {
  const details = { days: [{ date: '2026-11-02', servicesCount: 4 }] };
  const service = new PayoutsService(
    { ...baseRepo, getPayoutDetails: async () => details },
    audit as never,
  );

  assert.equal(await service.getPayoutDetails(payoutId), details);
  await assert.rejects(
    () => service.getPayoutDetails('bad'),
    (e: unknown) => e instanceof AppError && e.code === 'INVALID_PAYOUT_ID',
  );
});
