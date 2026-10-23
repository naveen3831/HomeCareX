/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import { partnerPayoutsService } from "./partner-payouts.service";
import type { PartnerPayoutsRepository, PayoutRowRaw } from "./partner-payouts.repository";

const row = (over: Partial<PayoutRowRaw> = {}): PayoutRowRaw => ({
  id: "507f1f77bcf86cd799439021",
  amount: 2700,
  status: "pending",
  method: null,
  transactionId: null,
  batchId: null,
  paidAt: null,
  expectedDate: new Date("2026-10-30T00:00:00.000Z"),
  createdAt: new Date("2026-10-23T00:00:00.000Z"),
  ...over,
});

const repo = (over: Partial<PartnerPayoutsRepository> = {}): PartnerPayoutsRepository => ({
  findPartnerIdByUserId: async () => "p1",
  listHistory: async () => [row()],
  findNext: async () => row(),
  findById: async () => row(),
  ...over,
});

/** HttpError (utils/errors.ts) keeps the HTTP code in `status`. */
const status = (e: unknown) => (e as { status?: number }).status;

test("list returns next + history in the shape the Payouts page expects", async () => {
  const out = await partnerPayoutsService.list("u1", { limit: 50 }, repo());
  assert.equal(out.currency, "INR");
  assert.equal(out.next?.amount, 2700);
  assert.equal(out.next?.currency, "INR");
  assert.equal(out.history.length, 1);
  assert.equal(out.history[0].expectedDate, "2026-10-30T00:00:00.000Z");
});

test("list with no payouts returns next=null and empty history", async () => {
  const out = await partnerPayoutsService.list(
    "u1",
    { limit: 50 },
    repo({ findNext: async () => null, listHistory: async () => [] }),
  );
  assert.equal(out.next, null);
  assert.deepEqual(out.history, []);
});

test("list rejects an account with no partner profile (404)", async () => {
  await assert.rejects(
    partnerPayoutsService.list("u1", { limit: 50 }, repo({ findPartnerIdByUserId: async () => null })),
    (e: unknown) => status(e) === 404,
  );
});

test("getById answers 404 for another partner payout", async () => {
  await assert.rejects(
    partnerPayoutsService.getById("u1", "507f1f77bcf86cd799439021", repo({ findById: async () => null })),
    (e: unknown) => status(e) === 404,
  );
});