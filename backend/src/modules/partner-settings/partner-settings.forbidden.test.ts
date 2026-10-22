import * as assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';
import express from 'express';
import { authService } from '../auth/auth.service';
import { partnerSettingsRoutes } from './partner-settings.routes';

let server: Server;
let base = '';

// The test token is "<role>:<userId>". authenticate only needs verifyAccessToken to return a payload.
const original = authService.verifyAccessToken;
before(async () => {
  (authService as unknown as { verifyAccessToken: (t: string) => unknown }).verifyAccessToken = (token: string) => {
    const [role, sub] = token.split(':');
    if (!role || !sub) throw Object.assign(new Error('bad token'), { statusCode: 401 });
    return { sub, role };
  };

  const app = express();
  app.use(express.json());
  app.use('/partner/settings', partnerSettingsRoutes);
  app.use(((err: { status?: number; statusCode?: number; httpStatus?: number }, _req, res, _next) => {
    res.status(err.statusCode ?? err.status ?? err.httpStatus ?? 500).json({ error: true });
  }) as express.ErrorRequestHandler);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/partner/settings`;
});

after(() => {
  (authService as unknown as { verifyAccessToken: unknown }).verifyAccessToken = original;
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

for (const role of ['customer', 'admin']) {
  for (const [method, path] of ROUTES) {
    test(`${role} token -> 403: ${method} /partner/settings${path}`, async () => {
      const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${role}:${'c'.repeat(24)}` },
        body: method === 'GET' ? undefined : '{}',
      });
      assert.equal(res.status, 403);
    });
  }
}