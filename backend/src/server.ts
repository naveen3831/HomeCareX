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
import { startReferralWorker } from './modules/referrals/referrals.worker';
import { ReferralCodeModel, ReferralModel } from './modules/referrals/referrals.model';
import { WalletLedgerModel, WalletModel } from './models/Wallet';

/** Logs how long each startup step takes. */
const timed = async <T>(label: string, fn: () => Promise<T>): Promise<T> => {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    console.log(`[timing] ${label}: ${Date.now() - start} ms`);
  }
};

const server = http.createServer(app);
initSockets(server);

const PORT = Number(process.env.PORT) || 5000;
let stopReferralWorker = () => {};
let stopSlaSweep = () => {};
let shuttingDown = false;

const seedDefaults = async (): Promise<void> => {
  try {
    const added = await timed('seed settings', seedDefaultSettings);
    if (added) console.log(`Seeded ${added} default setting(s)`);
    await timed('seed designations', seedDefaultDesignations);

    const freshCatalog =
      (await timed('count services', () => ServiceModel.estimatedDocumentCount())) === 0;
    await timed('seed categories', seedDefaultCategories);
    await timed('seed services', seedDefaultServices);
    if (freshCatalog) await timed('catalog seed', upsertCatalogSeed);

    // Referral and wallet unique indexes must exist before awarding any money.
    await Promise.all([
      ReferralCodeModel.init(),
      ReferralModel.init(),
      WalletModel.init(),
      WalletLedgerModel.init(),
    ]);
    console.log('[startup] Default seeding and critical indexes completed.');
  } catch (error) {
    console.error('[startup] Default seeding failed:', error);
  }
};

const connectDB = async (): Promise<void> => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is missing from your environment.');
    await mongoose.connect(process.env.DATABASE_URL as string);
    console.log('Connected to MongoDB');

    server.listen(PORT, () => {
      console.log(`HomeCareX server running on port ${PORT}`);
    });

    stopReferralWorker = startReferralWorker((error) =>
      console.error(
        '[referrals] Reward reconciliation failed; it will retry.',
        error instanceof Error ? error.message : 'Unknown error',
      ),
    );

    registerEarningsListeners();

    // Run non-critical default seeding after the server starts.
    void seedDefaults();
    // Start listening exactly once.
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);

      server.listen(PORT, () => {
        server.removeListener('error', reject);
        console.log(`HomeCareX server running on port ${PORT}`);
        resolve();
      });
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
    // Seed default data after the server starts.
    void seedDefaults().catch((error) => {
      console.error('[startup] Default seeding failed:', error);
    });
  } catch (error) {
    console.error('[startup] Failed to start HomeCareX:', error);
    process.exitCode = 1;

    stopReferralWorker?.();

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close().catch(() => {});
    }
    await timed('mongo connect', () =>
      mongoose.connect(process.env.DATABASE_URL as string),
    );
    console.log('Connected to MongoDB');
    await seedDefaults();
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const shutdown = async () => {
connectDB().then(() => {
  stopReferralWorker = startReferralWorker((error) =>
    console.error(
      '[referrals] Reward reconciliation failed; it will retry.',
      error instanceof Error ? error.message : 'Unknown error',
    ),
  );
  registerEarningsListeners();
  stopSlaSweep = startSlaSweep();

  server.listen(PORT, () => {
    console.log(`HomeCareX server running on port ${PORT}`);
    console.log(`[timing] total startup: ${Math.round(process.uptime() * 1000)} ms`);
  });
});

// Graceful shutdown
const shutdown = async (): Promise<void> => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('Stopping server gracefully...');
  stopReferralWorker();
  stopSlaSweep();

  server.close(async () => {
    await mongoose.connection.close();
    console.log('Database connection closed.');
    process.exit(0);
  });
    try {
      await mongoose.connection.close();
      console.log('Database connection closed.');
      process.exit(0);
    } catch (error) {
      console.error('Error closing database connection:', error);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());