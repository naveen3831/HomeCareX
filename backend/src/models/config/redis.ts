// Backend Config: redis
import { createClient } from 'redis';
import { environmentConfig } from './environment';

export const redisConfig = {};

type RedisClient = ReturnType<typeof createClient>;

let clientPromise: Promise<RedisClient | null> | null = null;
/** After a failed connect, don't retry immediately; requests fall straight back to in-memory lock mode. */
let retryAfter = 0;
const INITIAL_COOLDOWN_MS = 60_000;
const MAX_COOLDOWN_MS = 300_000; // 5 minutes
let currentCooldown = INITIAL_COOLDOWN_MS;
let hasLoggedUnreachable = false;
let warned = false;

/**
 * Lazily connects one shared Redis client.
 * Resolves to `null` when REDIS_URL is unset or Redis is unreachable, so callers can degrade
 * gracefully (the booking module falls back to an in-process lock; MongoDB's unique index is
 * still the hard guarantee against double-booking). The first connect attempt fails fast
 * (it never hangs a request); once connected, dropped connections reconnect with backoff.
 */
export function getRedisClient(): Promise<RedisClient | null> {
  const url = environmentConfig.redisUrl;
  if (!url) return Promise.resolve(null);
  if (Date.now() < retryAfter) return Promise.resolve(null);

  if (!clientPromise) {
    clientPromise = (async () => {
      let everConnected = false;
      const client = createClient({
        url,
        // Fail fast instead of queueing commands while disconnected.
        disableOfflineQueue: true,
        socket: {
          connectTimeout: 2000,
          reconnectStrategy: (retries: number) => {
            // Never connected: give up immediately so connect() rejects and callers fall back.
            if (!everConnected) return new Error('Redis unreachable');
            return Math.min(retries * 200, 5000);
          },
        },
      });

      client.on('ready', () => {
        everConnected = true;
        warned = false;
        hasLoggedUnreachable = false;
        currentCooldown = INITIAL_COOLDOWN_MS;
      });

      client.on('error', (err: Error) => {
        // While establishing initial connection, the catch block handles unreachable state cleanly.
        if (!everConnected) return;
        if (warned) return;
        warned = true;
        const e = err as Error & { code?: string };
        console.warn('[redis]', e.message || e.code || e.name || 'connection error');
      });

      try {
        await client.connect();
        return client;
      } catch (err) {
        if (!hasLoggedUnreachable) {
          hasLoggedUnreachable = true;
          const e = err as Error & { code?: string };
          console.info(
            `[redis] Redis server unreachable (${e.message || e.code || 'ECONNREFUSED'}); continuing with in-memory lock.`,
          );
        }
        retryAfter = Date.now() + currentCooldown;
        currentCooldown = Math.min(currentCooldown * 2, MAX_COOLDOWN_MS);
        clientPromise = null; // allow a later retry (after the cooldown)
        try {
          client.removeAllListeners('error');
          await client.disconnect();
        } catch {
          // ignore disconnect errors on failed connect
        }
        return null;
      }
    })();
  }
  return clientPromise;
}
