
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

const server = http.createServer(app);

// Initialize Socket.IO once for this HTTP server.
initSockets(server);

const PORT = Number(process.env.PORT) || 5000;

let stopReferralWorker: (() => void) | undefined;
let isShuttingDown = false;

/**
 * Non-critical default data.
 * A failure here is logged but does not stop the server.
 */
const seedDefaults = async (): Promise<void> => {
  try {
    const added = await seedDefaultSettings();

    if (added) {
      console.log(`Seeded ${added} default setting(s)`);
    }

    await seedDefaultDesignations();

    const freshCatalog =
      (await ServiceModel.estimatedDocumentCount()) === 0;

    await seedDefaultCategories();
    await seedDefaultServices();

    if (freshCatalog) {
      await upsertCatalogSeed();
    }
  } catch (error) {
    console.error('[seed] Default seeding failed:', error);
  }
};

/**
 * Connects to MongoDB and starts the HTTP server exactly once.
 */
const startServer = async (): Promise<void> => {
  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured');
    }

    await mongoose.connect(databaseUrl);
    console.log('Connected to MongoDB');

    // Register application listeners after MongoDB is ready.
    console.log('[earnings] Registering earnings listeners...');
    registerEarningsListeners();
    console.log('[earnings] Earnings listener registration completed.');

    // Start the referral reconciliation worker.
    stopReferralWorker = startReferralWorker((error) => {
      console.error(
        '[referrals] Reward reconciliation failed; it will retry.',
        error instanceof Error ? error.message : 'Unknown error',
      );
    });

    // Start the HTTP server exactly once.
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => {
        server.removeListener('listening', onListening);
        reject(error);
      };

      const onListening = () => {
        server.removeListener('error', onError);
        resolve();
      };

      server.once('error', onError);
      server.once('listening', onListening);

      server.listen(PORT);
    });

    console.log(`HomeCareX server running on port ${PORT}`);

    // Seed default data without blocking the running server.
    void seedDefaults();
  } catch (error) {
    console.error('[startup] Failed to start HomeCareX:', error);

    stopReferralWorker?.();
    stopReferralWorker = undefined;

    if (server.listening) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close().catch((closeError) => {
        console.error(
          '[startup] Failed to close MongoDB connection:',
          closeError,
        );
      });
    }

    process.exitCode = 1;
  }
};

/**
 * Gracefully shuts down the worker, HTTP server, and database.
 */
const shutdown = async (): Promise<void> => {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log('Stopping server gracefully...');

  stopReferralWorker?.();
  stopReferralWorker = undefined;

  try {
    if (server.listening) {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    }

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    console.log('Database connection closed.');
    process.exitCode = 0;
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exitCode = 1;
  }
};

process.once('SIGTERM', () => {
  void shutdown();
});

process.once('SIGINT', () => {
  void shutdown();
});

void startServer();
