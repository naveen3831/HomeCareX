import assert from "node:assert/strict";
import { test } from "node:test";
import { Query } from "mingo";
import { Types } from "mongoose";
import {
  BOOKING_TABS,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  TAB_STATUSES,
  buildBookingFilter,
  listBookingsQuerySchema,
} from "./bookings.query";
import { BOOKING_STATUSES } from "./bookings.constants";

const parse = (q: Record<string, unknown>) =>
  listBookingsQuerySchema.safeParse(q);
const NOW = new Date("2026-10-08T10:00:00.000Z");
const later = new Date(NOW.getTime() + 60_000);
const earlier = new Date(NOW.getTime() - 60_000);

const A = new Types.ObjectId();
const B = new Types.ObjectId();

interface Row {
  /** Hex string: mingo cannot run $toString on an ObjectId, and MongoDB's $toString yields exactly this. */
  _id: string;
  customerId: Types.ObjectId;
  status: string;
  serviceName: string;
  serviceId?: Types.ObjectId;
  date?: string;
  slot?: string;
  scheduledAt?: Date;
  holdExpiresAt?: Date;
}

const AC = new Types.ObjectId();
const row = (
  customerId: Types.ObjectId,
  status: string,
  extra: Partial<Row> = {},
): Row => ({
  _id: String(new Types.ObjectId()),
  customerId,
  status,
  serviceName: "Deep Home Cleaning",
  ...extra,
});

const rows: Row[] = [
  row(A, "confirmed", { date: "2026-10-10" }),
  row(A, "pending_payment", {
    holdExpiresAt: later,
    serviceName: "AC Service",
    serviceId: AC,
  }),
  row(A, "pending_payment", {
    holdExpiresAt: earlier,
    serviceName: "Expired hold",
  }),
  row(A, "pending_payment", { serviceName: "No hold date" }),
  row(A, "en_route"),
  row(A, "in_progress"),
  row(A, "completed", { date: "2026-10-01" }),
  row(A, "disputed"),
  row(A, "cancelled_by_customer"),
  row(A, "no_show"),
  row(B, "confirmed", { serviceName: "B private booking" }),
  row(B, "en_route"),
  row(B, "completed"),
  row(B, "cancelled_by_customer"),
];

const run = (customerId: Types.ObjectId, q: Record<string, unknown>): Row[] => {
  const parsed = listBookingsQuerySchema.parse(q);
  const filter = buildBookingFilter(String(customerId), parsed, NOW);
  return new Query(filter).find(rows).all() as Row[];
};

/* ---------------- tabs ---------------- */

test("every status belongs to one lifecycle group; schedule splits Upcoming from Overdue", () => {
  const all = BOOKING_TABS.filter((t) => t !== "overdue").flatMap((t) => [
    ...TAB_STATUSES[t],
  ]);
  assert.equal(new Set(all).size, all.length, "no status in two tabs");
  assert.deepEqual(
    [...all].sort(),
    [...BOOKING_STATUSES].sort(),
    "no status left out",
  );
  assert.deepEqual(TAB_STATUSES.overdue, TAB_STATUSES.upcoming);
});

test("each tab returns only its own statuses", () => {
  assert.deepEqual(
    run(A, { status: "live" })
      .map((r) => r.status)
      .sort(),
    ["en_route", "in_progress"],
  );
  assert.deepEqual(
    run(A, { status: "completed" })
      .map((r) => r.status)
      .sort(),
    ["completed", "disputed"],
  );
  assert.deepEqual(
    run(A, { status: "cancelled" })
      .map((r) => r.status)
      .sort(),
    [
      "cancelled_by_customer",
      "no_show",
      "pending_payment", // the expired hold
    ],
  );
});

test("upcoming keeps live and undated holds, drops expired holds", () => {
  const names = run(A, { status: "upcoming" })
    .map((r) => r.serviceName)
    .sort();
  assert.deepEqual(names, ["AC Service", "Deep Home Cleaning", "No hold date"]);
  assert.ok(!names.includes("Expired hold"));
});

test("upcoming + cancelled together cover the expired hold exactly once", () => {
  const hits = run(A, { status: "upcoming,cancelled" }).filter(
    (r) => r.serviceName === "Expired hold",
  );
  assert.equal(hits.length, 1);
});

test("a raw status works as a filter", () => {
  assert.deepEqual(
    run(A, { status: "no_show" }).map((r) => r.status),
    ["no_show"],
  );
});

test("the five views partition the customer, nothing is lost or duplicated", () => {
  const total = BOOKING_TABS.flatMap((t) => run(A, { status: t })).length;
  assert.equal(total, rows.filter((r) => r.customerId.equals(A)).length);
});

/* ---------------- customer isolation ---------------- */

test("customer A never sees customer B rows, with or without filters", () => {
  for (const q of [
    {},
    { status: "upcoming" },
    { search: "private" },
    { service: "B private" },
    { status: "live,completed" },
  ]) {
    const out = run(A, q);
    assert.ok(
      out.every((r) => r.customerId.equals(A)),
      `leak for ${JSON.stringify(q)}`,
    );
  }
  assert.equal(run(A, { search: "private" }).length, 0);
  assert.equal(run(B, { search: "private" }).length, 1);
});

test("a customerId in the query string is ignored by validation", () => {
  const parsed = parse({ customerId: String(B), status: "live" });
  assert.ok(parsed.success);
  assert.ok(!("customerId" in parsed.data));
  assert.ok(
    run(A, { customerId: String(B) }).every((r) => r.customerId.equals(A)),
  );
});

/* ---------------- search / service / date ---------------- */

test("search matches the service name case-insensitively", () => {
  assert.deepEqual(
    run(A, { search: "ac serv" }).map((r) => r.serviceName),
    ["AC Service"],
  );
});

test("search matches the booking id, full or as the BK- code shown on the card", () => {
  const target = rows[0];
  const id = String(target._id);
  assert.deepEqual(
    run(A, { search: id }).map((r) => r._id),
    [target._id],
  );
  assert.deepEqual(
    run(A, { search: `BK-${id.slice(-5).toUpperCase()}` }).map((r) => r._id),
    [target._id],
  );
  assert.deepEqual(
    run(A, { search: id.slice(-5) }).map((r) => r._id),
    [target._id],
  );
});

test("search cannot reach another customer's booking id", () => {
  assert.equal(
    run(A, { search: String(rows.find((r) => r.customerId.equals(B))!._id) })
      .length,
    0,
  );
});

test("search treats regex characters literally", () => {
  assert.equal(run(A, { search: ".*" }).length, 0);
  assert.equal(run(A, { search: "(" }).length, 0);
});

test("service filter accepts a name fragment or a service id", () => {
  assert.deepEqual(
    run(A, { service: "ac" }).map((r) => r.serviceName),
    ["AC Service"],
  );
  assert.deepEqual(
    run(A, { service: String(AC) }).map((r) => r.serviceName),
    ["AC Service"],
  );
});

test("date filter is an exact match on the service date", () => {
  assert.deepEqual(
    run(A, { date: "2026-10-01" }).map((r) => r.status),
    ["completed"],
  );
});

test("filters combine with AND", () => {
  assert.equal(run(A, { status: "upcoming", date: "2026-10-10" }).length, 1);
  assert.equal(run(A, { status: "completed", date: "2026-10-10" }).length, 0);
});

/* ---------------- validation ---------------- */

test("defaults: page 1, limit 10, newest first", () => {
  const p = listBookingsQuerySchema.parse({});
  assert.equal(p.page, 1);
  assert.equal(p.limit, DEFAULT_LIMIT);
  assert.equal(p.sort, "newest");
});

test("page and limit are coerced from strings and bounded", () => {
  const p = listBookingsQuerySchema.parse({ page: "3", limit: "25" });
  assert.equal(p.page, 3);
  assert.equal(p.limit, 25);
  assert.ok(!parse({ page: "0" }).success);
  assert.ok(!parse({ page: "-1" }).success);
  assert.ok(!parse({ page: "1.5" }).success);
  assert.ok(!parse({ limit: "0" }).success);
  assert.ok(!parse({ limit: String(MAX_LIMIT + 1) }).success);
  assert.ok(!parse({ page: "abc" }).success);
});

test("bad status, sort and date are rejected", () => {
  assert.ok(!parse({ status: "nope" }).success);
  assert.ok(!parse({ status: "live,nope" }).success);
  assert.ok(!parse({ sort: "random" }).success);
  assert.ok(!parse({ date: "10/08/2026" }).success);
  assert.ok(!parse({ status: ["live", "completed"] }).success);
});

test("blank params are treated as not sent", () => {
  const p = listBookingsQuerySchema.parse({
    status: "",
    search: "  ",
    date: "",
    service: "",
    sort: "",
  });
  assert.equal(p.status, undefined);
  assert.equal(p.search, undefined);
  assert.equal(p.sort, "newest");
});

test("status is case-insensitive and tolerates spaces", () => {
  const p = listBookingsQuerySchema.parse({ status: " Live , COMPLETED " });
  assert.deepEqual(p.status, ["live", "completed"]);
});

test("Upcoming excludes the screenshot bookings after their scheduled windows pass", () => {
  const now = new Date("2026-10-21T07:00:00.000Z"); // 12:30 IST
  const sample = [
    row(A, "confirmed", { date: "2026-10-15", slot: "10:00-12:00" }),
    row(A, "assigned", { date: "2026-10-16", slot: "10:00-12:00" }),
    row(A, "searching_for_partner", {
      date: "2026-10-19",
      slot: "10:00-12:00",
    }),
    row(A, "confirmed", { date: "2026-10-21", slot: "10:00-12:00" }),
    row(A, "confirmed", { date: "2026-10-21", slot: "12:00-14:00" }),
    row(A, "confirmed", { date: "2026-10-22", slot: "10:00-12:00" }),
    row(A, "completed", { date: "2026-10-22", slot: "10:00-12:00" }),
  ];
  const filter = buildBookingFilter(
    String(A),
    listBookingsQuerySchema.parse({ status: "upcoming" }),
    now,
  );
  assert.deepEqual(new Query(filter).find(sample).all(), [
    sample[4],
    sample[5],
  ]);
});

const inView = (
  sample: Row[],
  q: Record<string, unknown>,
  now = new Date("2026-10-21T07:00:00Z"),
): Row[] =>
  new Query(
    buildBookingFilter(String(A), listBookingsQuerySchema.parse(q), now),
  )
    .find(sample)
    .all() as Row[];

test("old unstarted bookings stay visible in Overdue without becoming completed", () => {
  const sample = TAB_STATUSES.upcoming.map((status) =>
    row(A, status, { date: "2026-10-15", slot: "10:00-12:00" }),
  );
  assert.deepEqual(inView(sample, { status: "overdue" }), sample);
  assert.deepEqual(inView(sample, { status: "completed" }), []);
  assert.ok(sample.every((r) => r.status !== "completed"));
});

test("a raw status filter narrows Upcoming instead of bringing back past bookings", () => {
  const sample = [
    row(A, "confirmed", { date: "2026-10-15", slot: "10:00-12:00" }),
    row(A, "confirmed", { date: "2026-10-22", slot: "10:00-12:00" }),
    row(A, "assigned", { date: "2026-10-22", slot: "10:00-12:00" }),
  ];
  assert.deepEqual(
    inView(sample, { tab: "upcoming", status: "confirmed,created" }),
    [sample[1]],
  );
  assert.deepEqual(
    inView(sample, { tab: "overdue", status: "confirmed,created" }),
    [sample[0]],
  );
  assert.deepEqual(inView(sample, { status: "confirmed" }), sample.slice(0, 2)); // historical API remains available
});

test("a slot moves to Overdue at its end, while an ongoing scheduled window stays Upcoming", () => {
  const sample = [
    row(A, "confirmed", { date: "2026-10-21", slot: "10:00-12:00" }),
  ];
  assert.equal(
    inView(sample, { status: "upcoming" }, new Date("2026-10-21T06:29:59Z"))
      .length,
    1,
  );
  assert.equal(
    inView(sample, { status: "overdue" }, new Date("2026-10-21T06:30:00Z"))
      .length,
    1,
  );
  assert.equal(
    inView(sample, { status: "upcoming" }, new Date("2026-10-21T06:30:00Z"))
      .length,
    0,
  );
});

test("the date boundary is midnight in India, even when the UTC date is still yesterday", () => {
  const sample = [
    row(A, "confirmed", { date: "2026-10-20", slot: "18:00-20:00" }),
    row(A, "confirmed", { date: "2026-10-21", slot: "08:00-10:00" }),
  ];
  const midnight = new Date("2026-10-20T18:31:00Z");
  assert.deepEqual(inView(sample, { status: "overdue" }, midnight), [
    sample[0],
  ]);
  assert.deepEqual(inView(sample, { status: "upcoming" }, midnight), [
    sample[1],
  ]);
});

test("legacy bookings with only scheduledAt also leave Upcoming after their service date", () => {
  const sample = [
    row(A, "assigned", { scheduledAt: new Date("2026-10-15T04:30:00Z") }),
    row(A, "assigned", { scheduledAt: new Date("2026-10-22T04:30:00Z") }),
  ];
  assert.deepEqual(inView(sample, { status: "overdue" }), [sample[0]]);
  assert.deepEqual(inView(sample, { status: "upcoming" }), [sample[1]]);
});

test("live, completed and expired holds keep their actual lifecycle group regardless of an old date", () => {
  const sample = [
    row(A, "in_progress", { date: "2026-10-15", slot: "10:00-12:00" }),
    row(A, "completed", { date: "2026-10-15", slot: "10:00-12:00" }),
    row(A, "pending_payment", {
      date: "2026-10-15",
      holdExpiresAt: new Date("2026-10-15T05:00:00Z"),
    }),
    row(B, "confirmed", { date: "2026-10-15", slot: "10:00-12:00" }),
  ];
  assert.deepEqual(inView(sample, { status: "overdue" }), []);
  assert.deepEqual(inView(sample, { status: "live" }), [sample[0]]);
  assert.deepEqual(inView(sample, { status: "completed" }), [sample[1]]);
  assert.deepEqual(inView(sample, { status: "cancelled" }), [sample[2]]);
});

test("Overdue respects search, date, customer isolation and tab/status intersection", () => {
  const sample = [
    row(A, "confirmed", { date: "2026-10-15", serviceName: "AC Service" }),
    row(A, "assigned", { date: "2026-10-16", serviceName: "Cleaning" }),
    row(B, "confirmed", { date: "2026-10-15", serviceName: "AC Service" }),
  ];
  assert.deepEqual(
    inView(sample, { tab: "overdue", search: "AC", date: "2026-10-15" }),
    [sample[0]],
  );
  assert.deepEqual(
    inView(sample, { tab: "upcoming", status: "completed" }),
    [],
  );
  assert.equal(parse({ tab: "invalid" }).success, false);
});

test("all five views partition a mix of past and future bookings exactly once", () => {
  const sample = [
    row(A, "confirmed", { date: "2026-10-15", slot: "10:00-12:00" }),
    row(A, "assigned", { date: "2026-10-22", slot: "10:00-12:00" }),
    row(A, "in_progress", { date: "2026-10-15", slot: "10:00-12:00" }),
    row(A, "completed", { date: "2026-10-22", slot: "10:00-12:00" }),
    row(A, "cancelled_by_customer", {
      date: "2026-10-15",
      slot: "10:00-12:00",
    }),
    row(A, "pending_payment", {
      date: "2026-10-15",
      holdExpiresAt: new Date("2026-10-15T05:00:00Z"),
    }),
  ];
  const found = BOOKING_TABS.flatMap((status) => inView(sample, { status }));
  assert.equal(found.length, sample.length);
  assert.equal(new Set(found.map((r) => r._id)).size, sample.length);
});
