import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import express from "express";
import jwt from "jsonwebtoken";
import { Query } from "mingo";
import { Types } from "mongoose";
import { ticketsRoutes } from "./tickets.routes";
import { adminTicketsRoutes } from "../admin-tickets/admin-tickets.routes";
import {
  ticketsRepository,
  type TicketsRepository,
} from "./tickets.repository";
import { createTicketsService } from "./tickets.service";
import { validateEvidence, MAX_ATTACHMENT_BYTES } from "./tickets.upload";
import { createTicketSchema } from "./tickets.validation";
import { errorHandler } from "../../middleware/error.middleware";
import type {
  TicketLean,
  TicketMessageLean,
} from "../admin-tickets/admin-tickets.repository";

const A = new Types.ObjectId();
const B = new Types.ObjectId();
const ADMIN = new Types.ObjectId();
const BOOKING = new Types.ObjectId();
const PRIVATE_BOOKING = new Types.ObjectId();
const rows: TicketLean[] = [];
const messages: TicketMessageLean[] = [];
const evidence = new Map<
  string,
  {
    ticketId: string;
    name: string;
    mimeType: string;
    sizeBytes: number;
    data: Buffer;
  }
>();
const input = {
  category: "payment",
  subject: "Payment needs checking",
  body: "Please check this payment for me.",
  priority: "normal",
} as const;
const png = Buffer.from("89504e470d0a1a0a00000000", "hex");
const matches = (filter: object) =>
  rows.filter((row) => new Query(filter).test(row as never));
const fake: TicketsRepository = {
  list: async (filter, skip, limit) =>
    matches(filter).slice(skip, skip + limit),
  count: async (filter) => matches(filter).length,
  get: async (filter) => matches(filter)[0] ?? null,
  ownsBooking: async (id, userId) =>
    id === String(BOOKING) && userId === String(A),
  async create(customerId, data, files) {
    const ticket: TicketLean = {
      _id: new Types.ObjectId(),
      createdBy: new Types.ObjectId(customerId),
      createdByRole: "customer",
      bookingId: data.bookingId ? new Types.ObjectId(data.bookingId) : null,
      category: data.category,
      subject: data.subject,
      status: "open",
      priority: data.priority,
      assignedTo: null,
      lastMessageAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    rows.push(ticket);
    await fake.append(
      ticket,
      { id: customerId, role: "customer" },
      data.body,
      files,
    );
    return ticket;
  },
  messages: async (id, beforeId) =>
    messages
      .filter(
        (m) =>
          String(m.ticketId) === id && (!beforeId || String(m._id) < beforeId),
      )
      .sort((a, b) => String(b._id).localeCompare(String(a._id)))
      .slice(0, 101),
  async append(ticket, actor, body, files) {
    const id = new Types.ObjectId();
    const attachments = files.map((file) => {
      const fileId = String(new Types.ObjectId());
      evidence.set(fileId, { ...file, ticketId: String(ticket._id) });
      return {
        name: file.name,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        url: `/api/v1/tickets/${ticket._id}/attachments/${fileId}`,
      };
    });
    const message: TicketMessageLean = {
      _id: id,
      ticketId: ticket._id,
      senderId: new Types.ObjectId(actor.id),
      senderRole: actor.role,
      body,
      attachments,
      readAt: null,
      createdAt: new Date(),
    };
    messages.push(message);
    return message;
  },
  async status(ticket, status) {
    ticket.status = status;
    return ticket;
  },
  async evidence(ticketId, fileId) {
    const file = evidence.get(fileId);
    return file?.ticketId === ticketId ? { ...file, id: fileId } : null;
  },
};
const original = { ...ticketsRepository };
const app = express();
app.use(express.json());
app.use("/tickets", ticketsRoutes);
app.use("/admin/tickets", adminTicketsRoutes);
app.use(errorHandler);
let server: ReturnType<typeof app.listen>;
let origin: string;
let own: string;
let other: string;
let fileUrl: string;
const httpProof: {
  method: string;
  path: string;
  status: number;
  response: unknown;
}[] = [];
const token = (role: "customer" | "partner" | "admin", id = A) =>
  jwt.sign(
    { sub: String(id), role },
    process.env.JWT_SECRET || "dev_access_secret_change_me",
  );
async function call(
  path: string,
  options: RequestInit = {},
  auth: string | null = token("customer"),
) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: {
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
      ...options.headers,
    },
  });
  if (process.env.TR_D14_HTTP_PROOF)
    httpProof.push({
      method: options.method ?? "GET",
      path,
      status: response.status,
      response: response.headers
        .get("content-type")
        ?.includes("application/json")
        ? ((await response.clone().json()) as unknown)
        : { contentType: response.headers.get("content-type") },
    });
  return response;
}
const json = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
function form(
  fields: Record<string, string>,
  file?: { bytes: Buffer; type: string; name?: string },
  count = 1,
) {
  const data = new FormData();
  Object.entries(fields).forEach(([key, value]) => data.append(key, value));
  if (file)
    for (let i = 0; i < count; i++)
      data.append(
        "attachments",
        new Blob([new Uint8Array(file.bytes)], { type: file.type }),
        file.name ?? "proof.png",
      );
  return { method: "POST", body: data };
}

before(async () => {
  Object.assign(ticketsRepository, fake);
  own = String(
    (await fake.create(String(A), createTicketSchema.parse(input), []))._id,
  );
  other = String(
    (await fake.create(String(B), createTicketSchema.parse(input), []))._id,
  );
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  origin = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  Object.assign(ticketsRepository, original);
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (process.env.TR_D14_HTTP_PROOF)
    writeFileSync(
      process.env.TR_D14_HTTP_PROOF,
      JSON.stringify(httpProof, null, 2),
    );
});

describe("customer support HTTP boundaries", () => {
  test("no token is 401; partner role is 403 for reads and writes", async () => {
    assert.equal((await call("/tickets", {}, null)).status, 401);
    assert.equal((await call("/tickets", {}, token("partner"))).status, 403);
    assert.equal(
      (await call("/tickets", json(input), token("partner"))).status,
      403,
    );
  });
  test("listing and opening a ticket are scoped to the JWT customer", async () => {
    const response = await call("/tickets");
    assert.equal(response.status, 200);
    const payload = (await response.json()) as {
      data: { id: string; createdBy: string }[];
    };
    assert.ok(payload.data.some((t) => t.id === own));
    assert.ok(payload.data.every((t) => t.createdBy === String(A)));
    assert.equal((await call(`/tickets/${other}`)).status, 404);
    assert.equal(
      (
        await call(
          `/tickets/${other}/messages`,
          json({ body: "Do not allow this reply." }),
        )
      ).status,
      404,
    );
  });
  test("missing fields, invalid ids and forged ownership/attachment metadata fail", async () => {
    assert.equal((await call("/tickets", json({}))).status, 400);
    assert.equal((await call("/tickets/no-id")).status, 400);
    assert.equal(
      (await call("/tickets", json({ ...input, createdBy: String(B) }))).status,
      400,
    );
    assert.equal(
      (
        await call(
          "/tickets",
          json({
            ...input,
            attachments: [{ url: "https://example.com/private.pdf" }],
          }),
        )
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          "/tickets",
          json({ ...input, bookingId: String(PRIVATE_BOOKING) }),
        )
      ).status,
      404,
    );
  });
  test("creates a ticket linked to an owned booking with a real uploaded file", async () => {
    const response = await call(
      "/tickets",
      form(
        { ...input, bookingId: String(BOOKING) },
        { bytes: png, type: "image/png" },
      ),
    );
    assert.equal(response.status, 201);
    const payload = (await response.json()) as {
      data: { id: string; bookingId: string };
    };
    assert.equal(payload.data.bookingId, String(BOOKING));
    const detail = (await (
      await call(`/tickets/${payload.data.id}`)
    ).json()) as { data: { messages: { attachments: { url: string }[] }[] } };
    fileUrl = detail.data.messages[0].attachments[0].url.replace("/api/v1", "");
    assert.equal((await call(fileUrl)).status, 200);
    assert.equal((await call(fileUrl, {}, token("customer", B))).status, 404);
    assert.equal((await call(fileUrl, {}, null)).status, 401);
    const adminPath = fileUrl.replace("/tickets/", "/admin/tickets/");
    const downloaded = await call(adminPath, {}, token("admin", ADMIN));
    assert.equal(downloaded.status, 200);
    assert.match(downloaded.headers.get("cache-control") ?? "", /no-store/);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), png);
  });
  test("rejects forged image content, SVG, oversized files and too many files", async () => {
    for (const file of [
      { bytes: Buffer.from("<script>attack</script>"), type: "image/png" },
      { bytes: Buffer.from("<svg/>"), type: "image/svg+xml" },
      {
        bytes: Buffer.alloc(MAX_ATTACHMENT_BYTES + 1),
        type: "application/pdf",
      },
    ])
      assert.equal((await call("/tickets", form(input, file))).status, 400);
    assert.equal(
      (
        await call(
          "/tickets",
          form(input, { bytes: png, type: "image/png" }, 4),
        )
      ).status,
      400,
    );
  });
  test("accepts a PDF exactly 5 MB; rejects one byte over the limit", async () => {
    const pdf = Buffer.alloc(MAX_ATTACHMENT_BYTES);
    pdf.write("%PDF-1.7");
    assert.equal(
      (
        await call(
          "/tickets",
          form(input, {
            bytes: pdf,
            type: "application/pdf",
            name: "proof.pdf",
          }),
        )
      ).status,
      201,
    );
  });
  test("customer and support replies appear together; closed tickets reject replies", async () => {
    assert.equal(
      (
        await call(
          `/tickets/${own}/messages`,
          json({ body: "Please help with my payment." }),
        )
      ).status,
      201,
    );
    assert.equal(
      (
        await call(
          `/admin/tickets/${own}/messages`,
          json({ body: "We are checking this for you." }),
          token("admin", ADMIN),
        )
      ).status,
      201,
    );
    const detail = (await (await call(`/tickets/${own}`)).json()) as {
      data: { messages: { senderRole: string }[] };
    };
    assert.ok(detail.data.messages.some((m) => m.senderRole === "admin"));
    const service = createTicketsService(fake, () => {});
    await service.setStatus(own, "waiting", {
      id: String(ADMIN),
      role: "admin",
    });
    assert.equal((await call(`/tickets/${own}`)).status, 200);
    await service.setStatus(own, "closed", {
      id: String(ADMIN),
      role: "admin",
    });
    assert.equal(
      (
        await call(
          `/tickets/${own}/messages`,
          json({ body: "Cannot post on a closed ticket." }),
        )
      ).status,
      409,
    );
    await assert.rejects(
      service.setStatus(own, "open", { id: String(A), role: "customer" }),
      { status: 403 },
    );
  });
  test("message pagination keeps every message reachable", async () => {
    const service = createTicketsService(fake, () => {});
    const ticket = rows.find((row) => String(row._id) === other)!;
    for (let i = 0; i < 105; i++)
      await fake.append(
        ticket,
        { id: String(B), role: "customer" },
        `Reply ${i}`,
        [],
      );
    const latest = await service.get(other, {
      id: String(B),
      role: "customer",
    });
    assert.equal(latest.messages.length, 100);
    assert.ok(latest.nextBefore);
    const older = await service.get(
      other,
      { id: String(B), role: "customer" },
      latest.nextBefore!,
    );
    assert.equal(
      new Set([...older.messages, ...latest.messages].map((m) => m.id)).size,
      106,
    );
  });
  test("empty/oversized evidence is rejected before persistence", () => {
    assert.throws(
      () =>
        validateEvidence({
          originalname: "x.pdf",
          mimetype: "application/pdf",
          buffer: Buffer.alloc(0),
          size: 0,
        }),
      { status: 400 },
    );
    assert.throws(
      () =>
        validateEvidence({
          originalname: "x.pdf",
          mimetype: "application/pdf",
          buffer: Buffer.alloc(0),
          size: MAX_ATTACHMENT_BYTES + 1,
        }),
      { status: 400 },
    );
  });
});
