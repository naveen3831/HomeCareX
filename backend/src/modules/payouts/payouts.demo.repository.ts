import { Types } from 'mongoose';
import { promises as fs } from 'node:fs';
import path from 'node:path';

type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

type DemoPartner = {
  name: string;
  email: string;
};

type DemoBatch = {
  _id: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  gross: number;
  commission: number;
  net: number;
  status: string;
  createdBy: Types.ObjectId;
  earningIds: Types.ObjectId[];
  payoutIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
};

type DemoPayout = {
  _id: Types.ObjectId;
  partnerId: {
    _id: Types.ObjectId;
    name: string;
    email: string;
  };
  batchId: Types.ObjectId;
  amount: number;
  gross: number;
  commission: number;
  status: PayoutStatus;
  paidAt: Date | null;
  createdAt: Date;
};

type StoredData = {
  batches?: DemoBatch[];
  payouts?: DemoPayout[];
};

const dataFile = path.resolve(
  process.cwd(),
  'data',
  'payouts-demo.json',
);

const demoPartners: DemoPartner[] = [
  { name: 'Rahul Sharma', email: 'rahul.demo@example.com' },
  { name: 'Priya Reddy', email: 'priya.demo@example.com' },
  { name: 'Arjun Kumar', email: 'arjun.demo@example.com' },
  { name: 'Sneha Patel', email: 'sneha.demo@example.com' },
  { name: 'Vikram Rao', email: 'vikram.demo@example.com' },
  { name: 'Ananya Singh', email: 'ananya.demo@example.com' },
  { name: 'Kiran Reddy', email: 'kiran.demo@example.com' },
  { name: 'Meera Nair', email: 'meera.demo@example.com' },
];

const payoutAmounts = [
  { gross: 3000, commission: 300 },
  { gross: 2500, commission: 250 },
  { gross: 4200, commission: 420 },
  { gross: 1800, commission: 180 },
  { gross: 3500, commission: 350 },
  { gross: 2800, commission: 280 },
  { gross: 5000, commission: 500 },
  { gross: 2200, commission: 220 },
];

const allowedTransitions: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ['processing', 'failed', 'paid'],
  processing: ['failed', 'paid'],
  failed: ['processing'],
  paid: [],
};

let batches: DemoBatch[] = [];
let payouts: DemoPayout[] = [];
let loaded = false;
let writeQueue: Promise<void> = Promise.resolve();

function toDate(value: Date | string | null | undefined): Date | null {
  if (value == null) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date in payout demo data: ${String(value)}`);
  }

  return date;
}

function serialize(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item: unknown) => {
      if (item instanceof Types.ObjectId) {
        return { __objectId: item.toString() };
      }

      return item;
    },
    2,
  );
}

function revive(_key: string, value: unknown): unknown {
  if (!value || typeof value !== 'object') {
    return value;
  }

  const item = value as Record<string, unknown>;

  if (typeof item.__objectId === 'string') {
    return new Types.ObjectId(item.__objectId);
  }

  if (typeof item.__date === 'string') {
    return new Date(item.__date);
  }

  return value;
}

async function ensureLoaded(): Promise<void> {
  if (loaded) {
    return;
  }

  await fs.mkdir(path.dirname(dataFile), { recursive: true });

  try {
    const content = await fs.readFile(dataFile, 'utf8');
    const stored = JSON.parse(content, revive) as StoredData;

    batches = (stored.batches ?? []).map((batch) => ({
      ...batch,
      periodStart: toDate(batch.periodStart)!,
      periodEnd: toDate(batch.periodEnd)!,
      createdAt: toDate(batch.createdAt)!,
      updatedAt: toDate(batch.updatedAt)!,
      _id: new Types.ObjectId(String(batch._id)),
      createdBy: new Types.ObjectId(String(batch.createdBy)),
      earningIds: (batch.earningIds ?? []).map(
        (id) => new Types.ObjectId(String(id)),
      ),
      payoutIds: (batch.payoutIds ?? []).map(
        (id) => new Types.ObjectId(String(id)),
      ),
    }));

    payouts = (stored.payouts ?? []).map((payout) => ({
      ...payout,
      _id: new Types.ObjectId(String(payout._id)),
      batchId: new Types.ObjectId(String(payout.batchId)),
      partnerId: {
        ...payout.partnerId,
        _id: new Types.ObjectId(String(payout.partnerId._id)),
      },
      createdAt: toDate(payout.createdAt)!,
      paidAt: toDate(payout.paidAt),
    }));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }

    batches = [];
    payouts = [];
  }

  loaded = true;
}

async function persist(): Promise<void> {
  const snapshot = serialize({ batches, payouts });

  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(dataFile), { recursive: true });

    const tempFile = `${dataFile}.tmp`;

    await fs.writeFile(tempFile, snapshot, 'utf8');
    await fs.rename(tempFile, dataFile);
  });

  await writeQueue;
}

function createRepositoryError(
  code: string,
  message: string,
): Error & { code: string } {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

function isPayoutStatus(value: unknown): value is PayoutStatus {
  return (
    value === 'pending' ||
    value === 'processing' ||
    value === 'paid' ||
    value === 'failed'
  );
}

function getBatchStatus(batchPayouts: DemoPayout[]): string {
  if (batchPayouts.length === 0) {
    return 'pending';
  }

  if (batchPayouts.every((payout) => payout.status === 'paid')) {
    return 'completed';
  }

  if (batchPayouts.some((payout) => payout.status === 'paid')) {
    return 'processing';
  }

  if (batchPayouts.some((payout) => payout.status === 'processing')) {
    return 'processing';
  }

  if (batchPayouts.some((payout) => payout.status === 'failed')) {
    return 'failed';
  }

  return 'pending';
}

function findPayout(payoutId: string): DemoPayout {
  if (!Types.ObjectId.isValid(payoutId)) {
    throw createRepositoryError(
      'INVALID_PAYOUT_ID',
      'A valid payout ID is required',
    );
  }

  const payout = payouts.find(
    (item) => String(item._id) === payoutId,
  );

  if (!payout) {
    throw createRepositoryError(
      'PAYOUT_NOT_FOUND',
      'Payout not found',
    );
  }

  return payout;
}

async function updatePayoutStatus(
  payoutId: string,
  status: PayoutStatus,
): Promise<DemoPayout> {
  await ensureLoaded();

  if (!isPayoutStatus(status)) {
    throw createRepositoryError(
      'INVALID_PAYOUT_STATUS',
      'A valid payout status is required',
    );
  }

  const payout = findPayout(payoutId);

  if (payout.status === status) {
    throw createRepositoryError(
      status === 'paid' ? 'PAYOUT_ALREADY_PAID' : 'PAYOUT_STATUS_CONFLICT',
      `Payout is already in ${status} status`,
    );
  }

  if (!allowedTransitions[payout.status].includes(status)) {
    throw createRepositoryError(
      'PAYOUT_STATUS_CONFLICT',
      `Cannot change payout status from ${payout.status} to ${status}`,
    );
  }

  const previousStatus = payout.status;
  const previousPaidAt = payout.paidAt;

  payout.status = status;
  payout.paidAt = status === 'paid' ? new Date() : null;

  const batch = batches.find(
    (item) => String(item._id) === String(payout.batchId),
  );

  if (batch) {
    const batchPayouts = payouts.filter(
      (item) => String(item.batchId) === String(batch._id),
    );

    batch.status = getBatchStatus(batchPayouts);
    batch.updatedAt = new Date();
  }

  try {
    await persist();
  } catch (error) {
    // Restore the in-memory payout if the local write fails.
    payout.status = previousStatus;
    payout.paidAt = previousPaidAt;

    if (batch) {
      const batchPayouts = payouts.filter(
        (item) => String(item.batchId) === String(batch._id),
      );

      batch.status = getBatchStatus(batchPayouts);
    }

    throw error;
  }

  return payout;
}

export const payoutsDemoRepository = {
  async generateBatch(input: {
    periodStart: Date;
    periodEnd: Date;
    adminId: string;
  }) {
    await ensureLoaded();

    const periodStart = toDate(input.periodStart)!;
    const periodEnd = toDate(input.periodEnd)!;

    if (periodStart.getTime() >= periodEnd.getTime()) {
      throw createRepositoryError(
        'INVALID_PAYOUT_PERIOD',
        'The period start must be before the period end',
      );
    }

    const existing = batches.find(
      (batch) =>
        toDate(batch.periodStart)!.getTime() === periodStart.getTime() &&
        toDate(batch.periodEnd)!.getTime() === periodEnd.getTime(),
    );

    if (existing) {
      throw createRepositoryError(
        'PAYOUT_BATCH_ALREADY_EXISTS',
        'A payout batch already exists for this period',
      );
    }

    if (!Types.ObjectId.isValid(input.adminId)) {
      throw createRepositoryError(
        'INVALID_ADMIN_ID',
        'A valid admin ID is required',
      );
    }

    const now = new Date();
    const batchId = new Types.ObjectId();

    // Illustrative local demo data only. No real earnings are read.
    const newPayouts: DemoPayout[] = demoPartners.map(
      (partner, index) => {
        const amounts = payoutAmounts[index];

        return {
          _id: new Types.ObjectId(),
          partnerId: {
            _id: new Types.ObjectId(),
            name: partner.name,
            email: partner.email,
          },
          batchId,
          gross: amounts.gross,
          commission: amounts.commission,
          amount: amounts.gross - amounts.commission,
          status: 'pending',
          paidAt: null,
          createdAt: now,
        };
      },
    );

    const gross = newPayouts.reduce(
      (total, payout) => total + payout.gross,
      0,
    );

    const commission = newPayouts.reduce(
      (total, payout) => total + payout.commission,
      0,
    );

    const net = newPayouts.reduce(
      (total, payout) => total + payout.amount,
      0,
    );

    const batch: DemoBatch = {
      _id: batchId,
      periodStart,
      periodEnd,
      gross,
      commission,
      net,
      status: 'pending',
      createdBy: new Types.ObjectId(input.adminId),
      earningIds: [],
      payoutIds: newPayouts.map((payout) => payout._id),
      createdAt: now,
      updatedAt: now,
    };

    batches.unshift(batch);
    payouts.unshift(...newPayouts);

    try {
      await persist();
    } catch (error) {
      batches = batches.filter(
        (item) => String(item._id) !== String(batchId),
      );

      const newPayoutIds = new Set(
        newPayouts.map((payout) => String(payout._id)),
      );

      payouts = payouts.filter(
        (payout) => !newPayoutIds.has(String(payout._id)),
      );

      throw error;
    }

    return batch;
  },

  async listBatches(input: {
    page: number;
    limit: number;
    status?: string;
  }) {
    await ensureLoaded();

    const filtered = input.status
      ? batches.filter((batch) => batch.status === input.status)
      : batches;

    const start = (input.page - 1) * input.limit;

    return {
      items: filtered.slice(start, start + input.limit),
      pagination: {
        page: input.page,
        limit: input.limit,
        total: filtered.length,
        pages: Math.ceil(filtered.length / input.limit),
      },
    };
  },

  async findBatchById(batchId: string) {
    await ensureLoaded();

    return (
      batches.find((batch) => String(batch._id) === batchId) ?? null
    );
  },

  async listPayouts(batchId: string) {
    await ensureLoaded();

    return payouts.filter(
      (payout) => String(payout.batchId) === batchId,
    );
  },

  async updateStatus(payoutId: string, status: PayoutStatus) {
    return updatePayoutStatus(payoutId, status);
  },

  async markPaid(payoutId: string) {
    return updatePayoutStatus(payoutId, 'paid');
  },

  async exportPayouts(batchId?: string) {
    await ensureLoaded();

    return payouts.filter(
      (payout) =>
        !batchId || String(payout.batchId) === batchId,
    );
  },
};

export default payoutsDemoRepository;