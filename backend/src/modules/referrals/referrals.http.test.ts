import assert from "node:assert/strict";
import { after, before, describe, mock, test } from "node:test";
import { once } from "node:events";
import express from "express";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { referralsRoutes } from "./referrals.routes";
import { referralsService } from "./referrals.service";
import { errorHandler } from "../../middleware/error.middleware";

const CUSTOMER = new Types.ObjectId();
const app = express();
app.use(express.json());
app.use("/referrals", referralsRoutes);
app.use(errorHandler);
let server: ReturnType<typeof app.listen>;
let origin = "";
const token = (role: "customer" | "partner" | "admin", id = CUSTOMER) =>
  jwt.sign(
    { sub: String(id), role },
    process.env.JWT_SECRET || "dev_access_secret_change_me",
  );
const get = (path: string, auth: string | null = token("customer")) =>
  fetch(`${origin}${path}`, {
    headers: auth ? { Authorization: `Bearer ${auth}` } : {},
  });

const summary = {
  code: "HCXABCDEF1234",
  rewardPerReferralPaise: 5000,
  stats: { invited: 2, completed: 1, rewardsPaise: 5000 },
  entries: [],
  meta: { page: 1, pages: 1, total: 2 },
};

before(async () => {
  mock.method(referralsService, "summary", async () => summary);
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  mock.restoreAll();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("GET /referrals", () => {
  test("no token is 401", async () => {
    assert.equal((await get("/referrals", null)).status, 401);
  });
  test("partner and admin roles are 403", async () => {
    assert.equal((await get("/referrals", token("partner"))).status, 403);
    assert.equal((await get("/referrals", token("admin"))).status, 403);
  });
  test("customer gets own code, stats and a private no-store response", async () => {
    const response = await get("/referrals");
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    const body = (await response.json()) as { data: typeof summary };
    assert.equal(body.data.code, summary.code);
    assert.deepEqual(body.data.stats, summary.stats);
  });
  test("the customer id comes from the token: forged ids and unknown query keys are rejected", async () => {
    const other = new Types.ObjectId();
    assert.equal((await get(`/referrals?userId=${other}`)).status, 400);
    assert.equal((await get("/referrals?page=0")).status, 400);
    assert.equal((await get("/referrals?page=abc")).status, 400);
  });
  test("the service is called with the JWT user, never a client-supplied id", async () => {
    await get("/referrals?page=2");
    const calls = (
      referralsService.summary as unknown as ReturnType<typeof mock.fn>
    ).mock.calls;
    const last = calls[calls.length - 1].arguments as unknown[];
    assert.equal(last[0], String(CUSTOMER));
    assert.equal(last[1], 2);
  });
});
