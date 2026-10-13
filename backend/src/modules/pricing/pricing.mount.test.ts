import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Router } from 'express';

// Importing the router pulls in the Razorpay SDK, which throws without keys; dummy values are enough here.
process.env.RAZORPAY_KEY_ID ||= 'test_key';
process.env.RAZORPAY_KEY_SECRET ||= 'test_secret';

// Regression test for the "Backend not reachable (server answered 404)" banner on /admin/pricing:
// the pricing routers existed but were never mounted in routes/index.ts.
type Layer = { name: string; regexp: RegExp; handle: Router & { stack?: Layer[] }; route?: { path: string; methods?: Record<string, boolean> } };

function mounted(root: Router, prefix: string): Layer | undefined {
  // Express turns '/admin/pricing' into /^\/admin\/pricing\/?(?=\/|$)/i; match on that exact source so unprefixed routers are skipped.
  const wanted = `^\\${prefix.replace(/\//g, '\\/').slice(1)}\\/?(?=\\/|$)`;
  return (root as unknown as { stack: Layer[] }).stack.find((l) => l.name === 'router' && l.regexp.source === wanted);
}
function endpoints(layer: Layer): string[] {
  return ((layer.handle as unknown as { stack?: Layer[] }).stack ?? []).filter((l) => l.route).map((l) => `${Object.keys(l.route!.methods ?? {})[0].toUpperCase()} ${l.route!.path}`);
}

test('POST /pricing/quote is mounted', async () => {
  const { rootRouter } = await import('../../routes');
  const layer = mounted(rootRouter, '/pricing');
  assert.ok(layer, '/pricing is not mounted in routes/index.ts');
  assert.deepEqual(endpoints(layer), ['POST /quote']);
});

test('GET / PUT / DELETE /admin/pricing are mounted', async () => {
  const { rootRouter } = await import('../../routes');
  const layer = mounted(rootRouter, '/admin/pricing');
  assert.ok(layer, '/admin/pricing is not mounted in routes/index.ts');
  assert.deepEqual(endpoints(layer).sort(), ['DELETE /:id', 'GET /', 'PUT /'].sort());
});
