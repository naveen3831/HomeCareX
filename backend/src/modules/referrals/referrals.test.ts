import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertNotSelfReferral,
  configuredRewardPaise,
  referralCodeBase,
  referralCodeCandidate,
} from "./referrals.service";

test("self-referrals are rejected at the service boundary", () => {
  assert.throws(() => assertNotSelfReferral("customer-a", "customer-a"), {
    status: 400,
    code: "SELF_REFERRAL",
  });
  assert.doesNotThrow(() => assertNotSelfReferral("customer-a", "customer-b"));
});
test("reward amounts are server configuration and must be integer paise", () => {
  const previous = process.env.REFERRAL_REWARD_PAISE;
  try {
    process.env.REFERRAL_REWARD_PAISE = "5000";
    assert.equal(configuredRewardPaise(), 5000);
    for (const invalid of ["-1", "2.5", "NaN", "10000001"]) {
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

// ---- Behaviour tests: models are stubbed, so these run without a database. ----
import { mock } from "node:test";
import mongoose, { Types } from "mongoose";
import { ReferralCodeModel, ReferralModel } from "./referrals.model";
import { referralsService } from "./referrals.service";
import BookingModel from "../../models/Booking";
import { WalletLedgerModel, WalletModel } from "../../models/Wallet";
import { UserModel } from "../../models/User";

type AnyFn = (...args: never[]) => unknown;
const stub = (target: object, name: string, impl: AnyFn) =>
  mock.method(target as Record<string, AnyFn>, name, impl);
const withReward = async (
  paise: string | undefined,
  run: () => Promise<void>,
) => {
  const previous = process.env.REFERRAL_REWARD_PAISE;
  if (paise === undefined) delete process.env.REFERRAL_REWARD_PAISE;
  else process.env.REFERRAL_REWARD_PAISE = paise;
  try {
    await run();
  } finally {
    mock.restoreAll();
    if (previous === undefined) delete process.env.REFERRAL_REWARD_PAISE;
    else process.env.REFERRAL_REWARD_PAISE = previous;
  }
};
const ids = () => ({
  referral: new Types.ObjectId(),
  referrer: new Types.ObjectId(),
  referee: new Types.ObjectId(),
  booking: new Types.ObjectId(),
});
const firstBooking = (_id: Types.ObjectId | null) => ({
  sort: () => ({ select: async () => (_id ? { _id } : null) }),
});

test("attach: self-referral never touches the database", async () => {
  const create = stub(ReferralModel, "create", async () => ({}));
  await assert.rejects(
    referralsService.attach("same-user", "HCXABC", "same-user"),
    { status: 400, code: "SELF_REFERRAL" },
  );
  assert.equal(create.mock.callCount(), 0);
  mock.restoreAll();
});

test("attach: a second, different referrer is rejected; the same referrer is idempotent", async () => {
  const duplicateKey = Object.assign(new Error("E11000"), { code: 11000 });
  stub(ReferralModel, "create", async () => {
    throw duplicateKey;
  });
  stub(ReferralModel, "findOne", async () => ({ referrerId: "referrer-1" }));
  await assert.rejects(
    referralsService.attach("referee", "HCXOTHER", "referrer-2"),
    { status: 409, code: "DUPLICATE_REFERRAL" },
  );
  await assert.doesNotReject(
    referralsService.attach("referee", "HCXFIRST", "referrer-1"),
  );
  mock.restoreAll();
});

test("reward: no referral, or no completed booking yet, credits nothing", async () => {
  await withReward("5000", async () => {
    const id = ids();
    const credit = stub(WalletModel, "findOneAndUpdate", async () => ({}));
    stub(ReferralModel, "findOne", async () => null);
    await referralsService.rewardForReferee(String(id.referee));
    mock.restoreAll();

    stub(ReferralModel, "findOne", async () => ({
      _id: id.referral,
      referrerId: id.referrer,
    }));
    stub(BookingModel, "findOne", () => firstBooking(null));
    const update = stub(ReferralModel, "updateOne", async () => ({}));
    const walletCredit = stub(
      WalletModel,
      "findOneAndUpdate",
      async () => ({}),
    );
    await referralsService.rewardForReferee(String(id.referee));
    assert.equal(update.mock.callCount(), 0);
    assert.equal(walletCredit.mock.callCount(), 0);
    assert.equal(credit.mock.callCount(), 0);
  });
});

test("reward: first completed booking credits the referrer wallet once, in rupees, with a unique reference", async () => {
  await withReward("5000", async () => {
    const id = ids();
    stub(ReferralModel, "findOne", async () => ({
      _id: id.referral,
      referrerId: id.referrer,
    }));
    stub(BookingModel, "findOne", () => firstBooking(id.booking));
    stub(ReferralModel, "updateOne", async () => ({}));
    stub(
      mongoose.connection,
      "transaction",
      async (run: (s: unknown) => Promise<void>) => run({}),
    );
    stub(ReferralModel, "findOneAndUpdate", async () => ({
      _id: id.referral,
      referrerId: id.referrer,
      refereeId: id.referee,
    }));
    const wallet = stub(WalletModel, "findOneAndUpdate", async () => ({
      _id: new Types.ObjectId(),
      balance: 50,
    }));
    const ledger = stub(WalletLedgerModel, "create", async () => []);

    await referralsService.rewardForReferee(String(id.referee));

    // Both referrer and referee (new customer) get credited
    assert.equal(wallet.mock.callCount(), 2);
    const [referrerFilter, referrerUpdate] = wallet.mock.calls[0].arguments as unknown as [
      { userId: string },
      { $inc: { balance: number } },
    ];
    assert.equal(referrerFilter.userId, String(id.referrer));
    assert.equal(referrerUpdate.$inc.balance, 50); // 5000 paise = ₹50

    const [refereeFilter, refereeUpdate] = wallet.mock.calls[1].arguments as unknown as [
      { userId: string },
      { $inc: { balance: number } },
    ];
    assert.equal(refereeFilter.userId, String(id.referee));
    assert.equal(refereeUpdate.$inc.balance, 50);

    const [[referrerEntry]] = ledger.mock.calls[0].arguments as unknown as [
      [{ type: string; amount: number; referenceId: string }],
    ];
    assert.equal(referrerEntry.type, "referral_reward");
    assert.equal(referrerEntry.amount, 50);
    assert.equal(referrerEntry.referenceId, `referral:${id.referral}:referrer`);

    const [[refereeEntry]] = ledger.mock.calls[1].arguments as unknown as [
      [{ type: string; amount: number; referenceId: string }],
    ];
    assert.equal(refereeEntry.type, "referral_reward");
    assert.equal(refereeEntry.amount, 50);
    assert.equal(refereeEntry.referenceId, `referral:${id.referral}:referee`);
  });
});

test("reward: an already-claimed referral (duplicate/concurrent run) does not credit again", async () => {
  await withReward("5000", async () => {
    const id = ids();
    stub(ReferralModel, "findOne", async () => ({
      _id: id.referral,
      referrerId: id.referrer,
    }));
    stub(BookingModel, "findOne", () => firstBooking(id.booking));
    stub(ReferralModel, "updateOne", async () => ({}));
    stub(
      mongoose.connection,
      "transaction",
      async (run: (s: unknown) => Promise<void>) => run({}),
    );
    stub(ReferralModel, "findOneAndUpdate", async () => null); // someone else already claimed it
    const wallet = stub(WalletModel, "findOneAndUpdate", async () => ({}));
    const ledger = stub(WalletLedgerModel, "create", async () => []);

    await referralsService.rewardForReferee(String(id.referee));

    assert.equal(wallet.mock.callCount(), 0);
    assert.equal(ledger.mock.callCount(), 0);
  });
});

test("reward: self-referral rows are refused even if one exists in the database", async () => {
  await withReward("5000", async () => {
    const same = new Types.ObjectId();
    stub(ReferralModel, "findOne", async () => ({
      _id: new Types.ObjectId(),
      referrerId: same,
    }));
    const wallet = stub(WalletModel, "findOneAndUpdate", async () => ({}));
    await assert.rejects(referralsService.rewardForReferee(String(same)), {
      code: "SELF_REFERRAL",
    });
    assert.equal(wallet.mock.callCount(), 0);
  });
});

test("reward: with no configured reward the referral is completed but the wallet is untouched", async () => {
  await withReward(undefined, async () => {
    const id = ids();
    stub(ReferralModel, "findOne", async () => ({
      _id: id.referral,
      referrerId: id.referrer,
    }));
    stub(BookingModel, "findOne", () => firstBooking(id.booking));
    const update = stub(ReferralModel, "updateOne", async () => ({}));
    const wallet = stub(WalletModel, "findOneAndUpdate", async () => ({}));
    await referralsService.rewardForReferee(String(id.referee));
    assert.equal(update.mock.callCount(), 1);
    assert.equal(wallet.mock.callCount(), 0);
  });
});

test("summary: a new customer gets a code and zeroed stats (empty state)", async () => {
  await withReward("5000", async () => {
    stub(referralsService, "code", async () => "HCXABCDEF1234");
    stub(ReferralModel, "aggregate", async () => []);
    stub(ReferralModel, "find", () => ({
      sort: () => ({
        skip: () => ({
          limit: () => ({
            populate: () => ({ lean: async () => [] }),
            lean: async () => [],
          }),
        }),
      }),
    }));
    stub(ReferralModel, "countDocuments", async () => 0);
    stub(ReferralModel, "findOne", () => ({
      populate: () => ({ lean: async () => null }),
      lean: async () => null,
    }));
    const result = await referralsService.summary(
      String(new Types.ObjectId()),
      1,
    );
    assert.equal(result.code, "HCXABCDEF1234");
    assert.deepEqual(result.stats, {
      invited: 0,
      completed: 0,
      rewardsPaise: 0,
    });
    assert.deepEqual(result.entries, []);
    assert.deepEqual(result.meta, { page: 1, pages: 1, total: 0 });
  });
});

test("code format: HCX + first name in capitals, letters only, max 8", () => {
  assert.equal(referralCodeBase("Charan"), "HCXCHARAN");
  assert.equal(referralCodeBase("Bharat Singh"), "HCXBHARAT");
  assert.equal(referralCodeBase("  ravi kumar  "), "HCXRAVI");
  assert.equal(referralCodeBase("Srinivasaraju"), "HCXSRINIVAS");
  assert.equal(referralCodeBase("José"), "HCXJOSE");
  assert.equal(referralCodeBase("O'Brien"), "HCXOBRIEN");
});
test("code candidates: plain first, then 2..5, then a random suffix; no letters gives a random code", () => {
  assert.equal(referralCodeCandidate("Charan", 0), "HCXCHARAN");
  assert.equal(referralCodeCandidate("Charan", 1), "HCXCHARAN2");
  assert.equal(referralCodeCandidate("Charan", 4), "HCXCHARAN5");
  assert.match(referralCodeCandidate("Charan", 5), /^HCXCHARAN[0-9A-F]{4}$/);
  assert.match(referralCodeCandidate("1234", 0), /^HCX[0-9A-F]{6}$/);
  assert.match(referralCodeCandidate(null, 0), /^HCX[0-9A-F]{6}$/);
});
test("code(): creates HCX+name, and moves to HCXNAME2 when the plain code is taken", async () => {
  const userId = String(new Types.ObjectId());
  stub(ReferralCodeModel, "findOne", async () => null);
  stub(UserModel, "findById", () => ({
    select: () => ({ lean: async () => ({ name: "Charan Kumar" }) }),
  }));
  const taken = Object.assign(new Error("E11000"), { code: 11000 });
  const create = stub(
    ReferralCodeModel,
    "create",
    async (row: { code: string }) => {
      if (row.code === "HCXCHARAN") throw taken;
      return row;
    },
  );
  assert.equal(await referralsService.code(userId), "HCXCHARAN2");
  assert.equal(create.mock.callCount(), 2);
  mock.restoreAll();
});
test("code(): an existing code is returned unchanged", async () => {
  stub(ReferralCodeModel, "findOne", async () => ({ code: "HCX81D8D13BA0" }));
  const create = stub(ReferralCodeModel, "create", async () => ({}));
  assert.equal(await referralsService.code("any"), "HCX81D8D13BA0");
  assert.equal(create.mock.callCount(), 0);
  mock.restoreAll();
});
