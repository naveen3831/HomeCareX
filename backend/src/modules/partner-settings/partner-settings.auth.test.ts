import * as assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import type { Server } from 'node:http';
import { authenticate } from '../../middleware/auth.middleware';
import { partnerSettingsRoutes } from './partner-settings.routes';

let server: Server;
let base = '';

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/partner/settings', partnerSettingsRoutes);
  // Fallback so any error thrown by the auth middleware becomes a status code.
  app.use(((err: { status?: number; statusCode?: number }, _req, res, _next) => {
    res.status(err.statusCode ?? err.status ?? 500).json({ error: true });
  }) as express.ErrorRequestHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/partner/settings`;
});

after(() => {
  server.close();
});

const ROUTES: [string, string][] = [
  ['GET', ''],
  ['PATCH', ''],
  ['PATCH', '/notifications'],
  ['PATCH', '/privacy'],
  ['PATCH', '/security'],
  ['GET', '/sessions'],
  ['POST', '/logout-all'],
];

for (const [method, path] of ROUTES) {
  test(`no token -> 401: ${method} /partner/settings${path}`, async () => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: method === 'GET' ? undefined : '{}',
    });
    assert.equal(res.status, 401);
  });

  test(`garbage token -> 401: ${method} /partner/settings${path}`, async () => {
    const res = await fetch(base + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer not-a-real-token' },
      body: method === 'GET' ? undefined : '{}',
    });
    assert.equal(res.status, 401);
  });
}

// Structural guard: every settings route must start with authenticate, so none can be added unprotected.
test('every settings route runs authenticate first and has role + permission checks', () => {
  const layers = (partnerSettingsRoutes as unknown as {
    stack: { route?: { path: string; stack: { handle: unknown }[] } }[];
  }).stack.filter((l) => l.route);
  assert.equal(layers.length, ROUTES.length);
  for (const l of layers) {
    const handlers = l.route!.stack.map((s) => s.handle);
    assert.equal(handlers[0], authenticate, `${l.route!.path} must start with authenticate`);
    assert.ok(handlers.length >= 4, `${l.route!.path} needs authenticate, role, permission and a handler`);
  }
});