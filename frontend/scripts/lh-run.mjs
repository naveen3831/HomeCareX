// Finds a REAL service slug from your running backend, then runs Lighthouse CI with it.
//   node scripts/lh-run.mjs            -> run Lighthouse on all 6 pages (expects a built app)
//   node scripts/lh-run.mjs --print    -> only print the slug it found
// Optional: LH_API_URL=http://localhost:5000/api/v1  (default shown here)
import { spawnSync } from "node:child_process";

const API = (process.env.LH_API_URL || "http://localhost:5000/api/v1").replace(/\/$/, "");

function findSlug(value) {
  if (!value || typeof value !== "object") return null;
  if (typeof value.slug === "string" && value.slug) return value.slug;
  for (const v of Object.values(value)) {
    const found = findSlug(v);
    if (found) return found;
  }
  return null;
}

let slug = process.env.LH_SERVICE_SLUG;
if (!slug || /[<>\s]|PASTE/i.test(slug)) {
  try {
    const res = await fetch(`${API}/services?limit=1`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    slug = findSlug(await res.json());
    if (!slug) throw new Error("the response contains no slug");
  } catch (err) {
    console.error(`Could not read a service slug from ${API}/services (${err.message}).`);
    console.error("Is the backend running on port 5000? Start it, or set LH_SERVICE_SLUG yourself.");
    process.exit(1);
  }
}

console.log(`Using service slug: ${slug}`);
if (process.argv.includes("--print")) process.exit(0);

const result = spawnSync("npm", ["run", "lh"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, LH_SERVICE_SLUG: slug },
});
process.exit(result.status ?? 1);