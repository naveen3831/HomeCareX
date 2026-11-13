/**
 * Shows why a partner's KYC document will not open, and can repair it when the file exists somewhere on this PC.
 *
 *   npm run seed -- kyc-check            (report only: one line per document)
 *   npm run seed -- kyc-check --fix      (copy a file that was found elsewhere into the KYC storage folder)
 *
 * For every document it prints the storageKey saved in MongoDB, the folder the server reads from, and whether the
 * file is there. "MISSING" means the database has a record but the file bytes are not on this server.
 * Dev / staging only.
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { PartnerModel } from "../models/Partner";

dotenv.config();

const FIX = process.argv.includes("--fix");
const storageDir = process.env.KYC_STORAGE_DIR || path.resolve(__dirname, "../../storage/kyc");

/** Looks for a file by name under a folder, skipping node_modules and .git. */
function findFile(root: string, name: string, depth = 0): string | null {
  if (depth > 6) return null;
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return null;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".git") continue;
    const full = path.join(root, e.name);
    if (e.isFile() && e.name === name) return full;
    if (e.isDirectory()) {
      const hit = findFile(full, name, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to run in production.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see backend/.env.example).");
  await mongoose.connect(url);

  console.log(`KYC storage folder: ${storageDir}`);
  const searchRoot = path.resolve(__dirname, "../../..");
  const partners = await PartnerModel.find({ "kyc.documents.0": { $exists: true } }).select("userId kyc.documents").lean();
  let missing = 0;

  for (const p of partners) {
    for (const d of p.kyc?.documents ?? []) {
      const key = d.storageKey;
      const tag = `partner ${String(p.userId)} | doc ${String(d._id)} | ${d.type}`;
      if (!key) {
        missing++;
        console.log(`NO storageKey  | ${tag} | url=${d.url ?? "(none)"}  -> old record, partner must upload again`);
        continue;
      }
      const here = path.join(storageDir, key);
      if (fs.existsSync(here)) {
        console.log(`OK             | ${tag} | ${key}`);
        continue;
      }
      missing++;
      const found = findFile(searchRoot, key);
      if (found && FIX) {
        fs.mkdirSync(storageDir, { recursive: true });
        fs.copyFileSync(found, here);
        console.log(`FIXED          | ${tag} | copied from ${found}`);
      } else if (found) {
        console.log(`MISSING (found elsewhere) | ${tag} | ${found}  -> run with --fix to copy it`);
      } else {
        console.log(`MISSING        | ${tag} | ${key}  -> file is not on this PC, partner must upload again`);
      }
    }
  }
  console.log(missing ? `\n${missing} document(s) have no usable file.` : "\nAll documents have their file.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
