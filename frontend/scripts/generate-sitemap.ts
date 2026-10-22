/**
 *   npm run sitemap   (also runs before `npm run build`)
 * Reads GET {API}/services (all pages) + GET {API}/categories
 * Writes public/sitemap.xml and the Sitemap: line in public/robots.txt
 * CI=true -> fail the build if the API is unreachable; otherwise keep old file.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSitemapXml,
  isActiveService,
  withSitemapLine,
  type SitemapCategory,
  type SitemapService,
} from "./sitemap-core.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const file of [".env.production.local", ".env.local", ".env.production", ".env"]) {
  const full = path.join(ROOT, file);
  if (existsSync(full)) process.loadEnvFile(full);
}

const SITE_URL = (process.env.VITE_SITE_URL || "http://localhost:3000").replace(/\/+$/, "");
const API_URL = (
  process.env.SITEMAP_API_URL ||
  process.env.VITE_API_BASE_URL ||
  "http://localhost:5000/api/v1"
).replace(/\/+$/, "");
const OUT_DIR = process.env.SITEMAP_OUT_DIR
  ? path.resolve(process.env.SITEMAP_OUT_DIR)
  : path.join(ROOT, "public");

const PAGE_SIZE = 50;
const MAX_PAGES = 500;
const TIMEOUT_MS = 15_000;

interface ListResponse<T> {
  data?: T[];
  meta?: { page?: number; totalPages?: number };
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`GET ${url} failed with ${res.status}`);
  return (await res.json()) as T;
}

async function fetchAllServices(): Promise<SitemapService[]> {
  const all: SitemapService[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const json = await getJson<ListResponse<SitemapService>>(
      `${API_URL}/services?page=${page}&limit=${PAGE_SIZE}`,
    );
    const items = Array.isArray(json.data) ? json.data : [];
    all.push(...items);
    const totalPages = json.meta?.totalPages ?? page;
    if (page >= totalPages || items.length === 0) break;
  }
  return all;
}

async function fetchCategories(): Promise<SitemapCategory[]> {
  const json = await getJson<ListResponse<SitemapCategory>>(`${API_URL}/categories`);
  return Array.isArray(json.data) ? json.data : [];
}

async function main() {
  if (/localhost|127\.0\.0\.1/.test(SITE_URL)) {
    console.warn(`[sitemap] WARNING: VITE_SITE_URL is "${SITE_URL}". Set the real domain before deploying.`);
  }

  const [services, categories] = await Promise.all([fetchAllServices(), fetchCategories()]);
  const active = services.filter(isActiveService);

  const sitemapPath = path.join(OUT_DIR, "sitemap.xml");
  writeFileSync(sitemapPath, buildSitemapXml(SITE_URL, services, categories), "utf8");

  const robotsPath = path.join(OUT_DIR, "robots.txt");
  if (existsSync(robotsPath)) {
    writeFileSync(robotsPath, withSitemapLine(readFileSync(robotsPath, "utf8"), SITE_URL), "utf8");
  }

  console.log(`[sitemap] ${active.length} service(s) + ${categories.length} categories -> ${sitemapPath}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.CI === "true") {
    console.error(`[sitemap] FAILED: ${message}`);
    process.exit(1);
  }
  console.warn(`[sitemap] Could not refresh sitemap.xml (${message}). Keeping the existing file. Start the backend, or set CI=true to make this an error.`);
});