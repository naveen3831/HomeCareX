
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

const server = http.createServer(app);
initSockets(server);

const PORT = Number(process.env.PORT) || 5000;

const seedDefaults = async (): Promise<void> => {
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
};

const startServer = async (): Promise<void> => {
  try {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not configured');
    }

    await mongoose.connect(databaseUrl);
    console.log('Connected to MongoDB');

    registerEarningsListeners();

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);

      server.listen(PORT, () => {
        server.removeListener('error', reject);
        console.log(`HomeCareX server running on port ${PORT}`);
        resolve();
      });
    });

    // Seed default data after the server starts.
    void seedDefaults().catch((error) => {
      console.error('[startup] Default seeding failed:', error);
    });
  } catch (error) {
    console.error('[startup] Failed to start HomeCareX:', error);

    server.close();

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close().catch(() => {});
    }

    process.exitCode = 1;
  }
};

const shutdown = async (): Promise<void> => {
  console.log('Stopping server gracefully...');

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

process.on('SIGTERM', () => {
  void shutdown();
});

process.on('SIGINT', () => {
  void shutdown();
});

void startServer();
