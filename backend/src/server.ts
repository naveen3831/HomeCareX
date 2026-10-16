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
import { startReferralWorker } from './modules/referrals/referrals.worker';
import { ReferralCodeModel, ReferralModel } from './modules/referrals/referrals.model';
import { WalletLedgerModel, WalletModel } from './models/Wallet';

/** Temporary: logs how long each startup step takes. Remove once the slow step is found. */
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
const PORT = process.env.PORT || 5000;
let stopReferralWorker = () => {};

const connectDB = async () => {
  try {
    await timed("mongo connect", () =>
      mongoose.connect(process.env.DATABASE_URL as string),
    );
    console.log("Connected to MongoDB");

    const added = await timed("seed settings", seedDefaultSettings);
    if (added) console.log(`Seeded ${added} default setting(s)`);
    await timed("seed designations", seedDefaultDesignations);

    const freshCatalog =
      (await timed("count services", () =>
        ServiceModel.estimatedDocumentCount(),
      )) === 0;
    await timed("seed categories", seedDefaultCategories);
    await timed("seed services", seedDefaultServices);
    if (freshCatalog) await timed("catalog seed", upsertCatalogSeed);
    // Referral and wallet unique indexes must exist before awarding any money.
    await Promise.all([ReferralCodeModel.init(), ReferralModel.init(), WalletModel.init(), WalletLedgerModel.init()]);
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    process.exit(1);
  }
};

connectDB().then(() => {
  stopReferralWorker = startReferralWorker(error => console.error('[referrals] Reward reconciliation failed; it will retry.', error instanceof Error ? error.message : 'Unknown error'));
  registerEarningsListeners();
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
  console.log("Stopping server gracefully...");
  server.close(async () => {
    await mongoose.connection.close();
    console.log("Database connection closed.");
    process.exit(0);
  });
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
