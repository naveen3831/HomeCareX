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
// CHECK THIS PATH: if the server fails with "Cannot find module", search the
// backend for "startReferralWorker" and fix the path to the file that exports it.
import { startReferralWorker } from './modules/referrals/referrals.worker';

const server = http.createServer(app);
initSockets(server);

const PORT = Number(process.env.PORT) || 5000;

let stopReferralWorker: (() => void) | undefined;

/** Non-critical default data. A failure here is logged but must not stop the server. */
const seedDefaults = async (): Promise<void> => {
  try {
    const added = await seedDefaultSettings();
    if (added) console.log(`Seeded ${added} default setting(s)`);
    await seedDefaultDesignations();

    const freshCatalog = (await ServiceModel.estimatedDocumentCount()) === 0;
    await seedDefaultCategories();
    await seedDefaultServices();
    if (freshCatalog) await upsertCatalogSeed();
  } catch (error) {
    console.error('[seed] Default seeding failed:', error);
  }
};

const startServer = async (): Promise<void> => {
  try {
    await mongoose.connect(process.env.DATABASE_URL as string);
    console.log('Connected to MongoDB');

    // Resolve once the port is open; reject if it cannot be opened (e.g. port in use).
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);

      server.listen(PORT, () => {
        server.removeListener('error', reject);
        console.log(`HomeCareX server running on port ${PORT}`);
        resolve();
      });
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
  } catch (error) {
    console.error('[startup] Failed to start HomeCareX:', error);

    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.connection.close();
      } catch (closeError) {
        console.error(
          '[startup] Failed to close MongoDB connection:',
          closeError,
        );
      }
    }

    process.exit(1);
  }
};

const shutdown = async (): Promise<void> => {
  console.log('Stopping server gracefully...');
  stopReferralWorker?.();
  server.close(async () => {
    try {
      await mongoose.connection.close();
      console.log('Database connection closed.');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

void startServer();