
import assert from 'node:assert/strict';
import test from 'node:test';

import { AppError } from '../../utils/AppError';
import { PayoutsService, escapeCsv } from './payouts.service';

const validAdminId = '507f1f77bcf86cd799439011';
const mockBatchId = '507f1f77bcf86cd799439013';

const mockBatch = {
  _id: mockBatchId,
  periodStart: new Date('2026-10-01T00:00:00.000Z'),
  periodEnd: new Date('2026-10-08T00:00:00.000Z'),
  gross: 3000,
  commission: 300,
  net: 2700,
  status: 'pending',
};

let generateBatchCalls = 0;
let auditCalls = 0;

const mockRepository = {
  generateBatch: async (_input: {
    periodStart: Date;
    periodEnd: Date;
    adminId: string;
  }) => {
    generateBatchCalls += 1;
    return mockBatch;
  },

  listBatches: async (_input: {
    page: number;
    limit: number;
    status?: string;
  }) => ({
    items: [],
    pagination: {
      page: 1,
      limit: 20,
      total: 0,
      pages: 0,
    },
  }),

  findBatchById: async (_batchId: string) => null,

  listPayouts: async (_batchId: string) => [],
};

const mockAudit = {
  recordAudit: async (_input: unknown) => {
    auditCalls += 1;
  },
};

const service = new PayoutsService(
  mockRepository,
  mockAudit as never,
);

async function assertAppError(
  action: () => Promise<unknown>,
  expectedStatus: number,
  expectedCode: string,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.statusCode, expectedStatus);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

// --------------------------------------------------
// Generate payout batch validation
// --------------------------------------------------

test('generateBatch rejects an invalid admin ID', async () => {
  await assertAppError(
    () =>
      service.generateBatch({
        periodStart: '2026-10-01T00:00:00.000Z',
        periodEnd: '2026-10-08T00:00:00.000Z',
        adminId: 'invalid-id',
        ip: '127.0.0.1',
      }),
    401,
    'INVALID_ADMIN_ID',
  );
});

test('generateBatch rejects an invalid start date', async () => {
  await assertAppError(
    () =>
      service.generateBatch({
        periodStart: 'not-a-date',
        periodEnd: '2026-10-08T00:00:00.000Z',
        adminId: validAdminId,
        ip: '127.0.0.1',
      }),
    400,
    'INVALID_PAYOUT_PERIOD',
  );
});

test('generateBatch rejects an invalid end date', async () => {
  await assertAppError(
    () =>
      service.generateBatch({
        periodStart: '2026-10-01T00:00:00.000Z',
        periodEnd: 'not-a-date',
        adminId: validAdminId,
        ip: '127.0.0.1',
      }),
    400,
    'INVALID_PAYOUT_PERIOD',
  );
});

test('generateBatch rejects a period whose start is after its end', async () => {
  await assertAppError(
    () =>
      service.generateBatch({
        periodStart: '2026-10-09T00:00:00.000Z',
        periodEnd: '2026-10-08T00:00:00.000Z',
        adminId: validAdminId,
        ip: '127.0.0.1',
      }),
    400,
    'INVALID_PAYOUT_PERIOD',
  );
});

test('generateBatch rejects a period with equal start and end', async () => {
  await assertAppError(
    () =>
      service.generateBatch({
        periodStart: '2026-10-08T00:00:00.000Z',
        periodEnd: '2026-10-08T00:00:00.000Z',
        adminId: validAdminId,
        ip: '127.0.0.1',
      }),
    400,
    'INVALID_PAYOUT_PERIOD',
  );
});

// --------------------------------------------------
// Mock-based successful batch generation
// --------------------------------------------------

test('generateBatch returns a batch with calculated totals', async () => {
  generateBatchCalls = 0;
  auditCalls = 0;

  const batch: unknown = await service.generateBatch({
    periodStart: '2026-10-01T00:00:00.000Z',
    periodEnd: '2026-10-08T00:00:00.000Z',
    adminId: validAdminId,
    ip: '127.0.0.1',
  });

  assert.ok(batch && typeof batch === 'object');

  const result = batch as {
    gross: number;
    commission: number;
    net: number;
    status: string;
  };

  assert.equal(result.gross, 3000);
  assert.equal(result.commission, 300);
  assert.equal(result.net, 2700);
  assert.equal(result.status, 'pending');
  assert.equal(generateBatchCalls, 1);
  assert.equal(auditCalls, 1);
});

// --------------------------------------------------
// List payout batches validation
// --------------------------------------------------

test('listBatches rejects a page less than one', async () => {
  await assertAppError(
    () => service.listBatches({ page: 0 }),
    400,
    'INVALID_PAGE',
  );
});

test('listBatches rejects a non-integer page', async () => {
  await assertAppError(
    () => service.listBatches({ page: 1.5 }),
    400,
    'INVALID_PAGE',
  );
});

test('listBatches rejects a limit greater than 100', async () => {
  await assertAppError(
    () => service.listBatches({ limit: 101 }),
    400,
    'INVALID_LIMIT',
  );
});

test('listBatches rejects a limit less than one', async () => {
  await assertAppError(
    () => service.listBatches({ limit: 0 }),
    400,
    'INVALID_LIMIT',
  );
});

test('listBatches rejects an unsupported status', async () => {
  await assertAppError(
    () => service.listBatches({ status: 'unknown' }),
    400,
    'INVALID_BATCH_STATUS',
  );
});

// --------------------------------------------------
// Batch and payout ID validation
// --------------------------------------------------

test('getBatch rejects an invalid batch ID', async () => {
  await assertAppError(
    () => service.getBatch('invalid-id'),
    400,
    'INVALID_BATCH_ID',
  );
});

test('listPayouts rejects an invalid batch ID', async () => {
  await assertAppError(
    () => service.listPayouts('invalid-id'),
    400,
    'INVALID_BATCH_ID',
  );
});

test('markPaid rejects an invalid payout ID', async () => {
  await assertAppError(
    () =>
      service.markPaid({
        payoutId: 'invalid-id',
        adminId: validAdminId,
        ip: '127.0.0.1',
      }),
    400,
    'INVALID_PAYOUT_ID',
  );
});

test('markPaid rejects an invalid admin ID', async () => {
  await assertAppError(
    () =>
      service.markPaid({
        payoutId: '507f1f77bcf86cd799439012',
        adminId: 'invalid-id',
        ip: '127.0.0.1',
      }),
    401,
    'INVALID_ADMIN_ID',
  );
});

test('exportCsv rejects an invalid batch ID', async () => {
  await assertAppError(
    () => service.exportCsv('invalid-id'),
    400,
    'INVALID_BATCH_ID',
  );
});

// --------------------------------------------------
// CSV escaping validation
// --------------------------------------------------

test('escapeCsv wraps values in double quotes', () => {
  assert.equal(escapeCsv('Partner One'), '"Partner One"');
  assert.equal(escapeCsv(''), '""');
  assert.equal(escapeCsv(null), '""');
  assert.equal(escapeCsv(undefined), '""');
});

test('escapeCsv escapes commas and double quotes', () => {
  assert.equal(
    escapeCsv('Smith, Vaishnavi'),
    '"Smith, Vaishnavi"',
  );

  assert.equal(
    escapeCsv('Say "hello"'),
    '"Say ""hello"""',
  );
});

test('escapeCsv protects formula-like text', () => {
  assert.equal(escapeCsv('=1+1'), '"\'=1+1"');

  assert.equal(
    escapeCsv('+SUM(A1:A2)'),
    '"\'+SUM(A1:A2)"',
  );

  assert.equal(escapeCsv('@SUM(A1)'), '"\'@SUM(A1)"');
  assert.equal(escapeCsv('  =1+1'), '"\'  =1+1"');
});

test('escapeCsv preserves ordinary text and numeric values', () => {
  assert.equal(escapeCsv('Partner One'), '"Partner One"');
  assert.equal(escapeCsv(1250.5), '"1250.5"');
  assert.equal(escapeCsv(-5), '"-5"');
});