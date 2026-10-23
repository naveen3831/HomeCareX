import "dotenv/config";
import http from "http";
import mongoose from "mongoose";
import app from "./app";
import { initSockets } from "./sockets";
import { registerEarningsListeners } from "./modules/earnings/earnings.listener";
import { seedDefaultSettings } from "./modules/settings/settings.service";
import { seedDefaultDesignations } from "./modules/designations/designations.service";
import { seedDefaultCategories } from "./modules/categories/categories.service";
import { seedDefaultServices } from "./modules/services/services.service";
import { upsertCatalogSeed } from "./modules/catalog/catalog.seed";
import { ServiceModel } from "./models/Service";
import { startSlaSweep } from './modules/admin-tickets/admin-tickets.sla-sweep';
import 'dotenv/config';
import http from 'http';
import mongoose from 'mongoose';

import app from './app';
import { initSockets } from './sockets';
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

const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    console.log(`[timing] ${label}: ${Date.now() - start} ms`);
  }
};

const server = http.createServer(app);

// Initialize Socket.IO once for this HTTP server.
initSockets(server);
const PORT = process.env.PORT || 5000;
let stopReferralWorker = () => {};
let stopSlaSweep = () => {};

const PORT = Number(process.env.PORT) || 5000;
let stopReferralWorker: (() => void) | undefined;
let shuttingDown = false;

/**
 * Non-critical default data.
 * A failure here is logged but does not stop the server.
 */
const seedDefaults = async (): Promise<void> => {
  try {
    const added = await timed('seed settings', seedDefaultSettings);
    if (added) {
      console.log(`Seeded ${added} default setting(s)`);
    }

    await timed('seed designations', seedDefaultDesignations);

    const freshCatalog = await timed('count services', async () => {
      return (await ServiceModel.estimatedDocumentCount()) === 0;
    });

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

/**
 * Connects to MongoDB and starts the HTTP server exactly once.
 */
const startServer = async (): Promise<void> => {
  try {
    await timed('mongo connect', async () => {
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is missing from your environment.');
      }
      await mongoose.connect(process.env.DATABASE_URL);
    });

    console.log('Connected to MongoDB');

    // Create required indexes before the server accepts requests that
    // could award referral rewards or modify wallet balances.
    await timed('initialize critical indexes', async () => {
      await Promise.all([
        ReferralCodeModel.init(),
        ReferralModel.init(),
        WalletModel.init(),
        WalletLedgerModel.init(),
      ]);
    });

    // Start the HTTP server exactly once.
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(PORT, () => {
        server.removeListener('error', reject);
        resolve();
      };

      server.once('error', onError);
      server.once('listening', onListening);

    console.log(`HomeCareX server running on port ${PORT}`);
    console.log(
      `[timing] process uptime at listen: ${Math.round(
        process.uptime() * 1000,
      )} ms`,
    );

    stopReferralWorker = startReferralWorker((error) =>
      console.error(
        '[referral-worker] Background referral processing failed:',
        error,
      ),
    );

    registerEarningsListeners();
    void seedDefaults();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

connectDB().then(() => {
  stopReferralWorker = startReferralWorker(error => console.error('[referrals] Reward reconciliation failed; it will retry.', error instanceof Error ? error.message : 'Unknown error'));
  registerEarningsListeners();
  stopSlaSweep = startSlaSweep();
  server.listen(PORT, () => {
    console.log(`HomeCareX server running on port ${PORT}`);
    // Seconds since the node process started, including loading all modules.
    console.log(
      `[timing] total startup: ${Math.round(process.uptime() * 1000)} ms`,
    );
  });
});

// Graceful shutdown
const shutdown = async () => {
  stopReferralWorker();
  stopSlaSweep();
  console.log("Stopping server gracefully...");
const shutdown = async (): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('Stopping server gracefully...');

  stopReferralWorker?.();

  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('Database connection closed.');
      process.exit(0);
    } catch (error) {
      console.error('Error closing database connection:', error);
      process.exit(1);
    }

    console.log('Database connection closed.');
    process.exitCode = 0;
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exitCode = 1;
  }
};

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

void startServer();
