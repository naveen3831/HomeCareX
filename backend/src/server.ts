import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';
import app from './app';
import { registerEarningsListeners } from './modules/earnings/earnings.listener';
import { seedDefaultSettings } from './modules/settings/settings.service';
import { seedDefaultDesignations } from './modules/designations/designations.service';
import { seedDefaultCategories } from './modules/categories/categories.service';
import { seedDefaultServices } from './modules/services/services.service';
import { upsertCatalogSeed } from './modules/catalog/catalog.seed';
import { ServiceModel } from './models/Service';
import { startReferralWorker } from './modules/referrals/referrals.worker';
import {
  ReferralCodeModel,
  ReferralModel,
} from './modules/referrals/referrals.model';
import { WalletLedgerModel, WalletModel } from './models/Wallet';
import { startSlaSweep } from './modules/admin-tickets/admin-tickets.sla-sweep';
 
const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    console.log(`[timing] ${label}: ${Date.now() - start} ms`);
  }
};
 
const server = http.createServer(app);
const PORT = Number(process.env.PORT) || 5000;
let stopReferralWorker: (() => void) | undefined;
let stopSlaSweep: (() => void) | undefined;
let shuttingDown = false;
 
/** Non-critical default data; failures do not stop the server. */
const seedDefaults = async (): Promise<void> => {
  try {
    const added = await timed('seed settings', seedDefaultSettings);
    if (added) {
      console.log(`Seeded ${added} default setting(s)`);
    }
 
    await timed('seed designations', seedDefaultDesignations);
    const freshCatalog = await timed('count services', async () =>
      (await ServiceModel.estimatedDocumentCount()) === 0,
    );
 
    await timed('seed categories', seedDefaultCategories);
    await timed('seed services', seedDefaultServices);
 
    if (freshCatalog) {
      await timed('catalog seed', upsertCatalogSeed);
    }
 
    console.log('[startup] Default seeding completed.');
  } catch (error) {
    console.error('[startup] Default seeding failed:', error);
  }
};
 
const startServer = async (): Promise<void> => {
  try {
    await timed('mongo connect', async () => {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is missing from your environment.');
      }
      await mongoose.connect(process.env.DATABASE_URL);
    });
    console.log('Connected to MongoDB');
 
    await timed('initialize critical indexes', async () => {
      await Promise.all([
        ReferralCodeModel.init(),
        ReferralModel.init(),
        WalletModel.init(),
        WalletLedgerModel.init(),
      ]);
    });
 
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        server.removeListener('listening', onListening);
        reject(error);
      };
      const onListening = (): void => {
        server.removeListener('error', onError);
        resolve();
      };
 
      server.once('error', onError);
      server.once('listening', onListening);
      server.listen(PORT);
    });
 
    console.log(`HomeCareX server running on port ${PORT}`);
    console.log(
      `[timing] process uptime at listen: ${Math.round(process.uptime() * 1000)} ms`,
    );
 
    stopReferralWorker = startReferralWorker((error) =>
      console.error(
        '[referral-worker] Background referral processing failed:',
        error instanceof Error ? error.message : 'Unknown error',
      ),
    );
    stopSlaSweep = startSlaSweep();
    registerEarningsListeners();
    void seedDefaults();
  } catch (error) {
    console.error('[startup] Failed to start HomeCareX:', error);
    process.exitCode = 1;
    stopReferralWorker?.();
    stopSlaSweep?.();
 
    if (server.listening) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close().catch(() => undefined);
    }
  }
};
 
const shutdown = async (): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;
 
  console.log('Stopping server gracefully...');
  stopReferralWorker?.();
  stopSlaSweep?.();
 
  try {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    console.log('Database connection closed.');
    process.exitCode = 0;
  } catch (error) {
    console.error('Error during graceful shutdown:', error);
    process.exitCode = 1;
  }
};
 
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
 
void startServer();
 
 