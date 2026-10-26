// Run from /frontend after `npm run lh`:  node scripts/lh-summary.mjs
import fs from "node:fs";
import path from "node:path";

const byUrl = new Map();
for (const dir of [".lighthouseci", "lighthouse-report"]) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    let d;
    try {
      d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    } catch {
      continue;
    }
    if (!d.audits || !d.categories || !d.requestedUrl) continue;
    const list = byUrl.get(d.requestedUrl) ?? [];
    if (!list.some((x) => x.fetchTime === d.fetchTime)) list.push(d);
    byUrl.set(d.requestedUrl, list);
  }
}
if (byUrl.size === 0) {
  console.log("No Lighthouse reports found. Run `npm run lh` first.");
  process.exit(1);
}

const sec = (ms) => (ms == null ? "n/a" : (ms / 1000).toFixed(1) + "s");
const cut = (t, n = 130) => (t && t.length > n ? t.slice(0, n) + "…" : t);
function nodes(o, out = []) {
  if (!o || typeof o !== "object") return out;
  if (o.node && o.node.snippet) out.push(o.node);
  for (const v of Object.values(o)) nodes(v, out);
  return out;
}

for (const [url, all] of byUrl) {
  all.sort((a, b) => b.fetchTime.localeCompare(a.fetchTime)); // newest first
  const runs = all.slice(0, 3);
  runs.sort(
    (a, b) =>
      a.audits["largest-contentful-paint"].numericValue -
      b.audits["largest-contentful-paint"].numericValue
  );
  const l = runs[Math.floor(runs.length / 2)];
  const a = l.audits;
  console.log(`\n===== ${url}  (newest run ${all[0].fetchTime})`);
  console.log(
    `perf ${Math.round(l.categories.performance.score * 100)} | a11y ${Math.round(l.categories.accessibility.score * 100)} | seo ${Math.round(l.categories.seo.score * 100)} | FCP ${sec(a["first-contentful-paint"].numericValue)} | LCP ${sec(a["largest-contentful-paint"].numericValue)} | TBT ${Math.round(a["total-blocking-time"].numericValue)}ms | CLS ${a["cumulative-layout-shift"].numericValue.toFixed(3)}`
  );
  const n = nodes(a["largest-contentful-paint-element"]?.details)[0];
  if (n) console.log("LCP element:", cut(n.snippet, 200));
  for (const cat of ["performance", "accessibility", "seo"]) {
    for (const r of l.categories[cat].auditRefs) {
      const x = a[r.id];
      if (r.weight > 0 && x.score != null && x.score < 0.9) {
        console.log(`  FAIL [${cat}] ${x.title} (${r.id}) ${x.displayValue ?? ""}`);
      }
    }
  }
  for (const id of [
    "render-blocking-insight",
    "unused-javascript",
    "unused-css-rules",
    "image-delivery-insight",
    "mainthread-work-breakdown",
  ]) {
    const x = a[id];
    if (x && x.score != null && x.score < 1) {
      console.log(`  note ${id}: ${x.displayValue ?? ""} ${cut(JSON.stringify(x.details?.items?.slice(0, 3)), 260)}`);
    }
  }
  const reqs = (a["network-requests"]?.details?.items ?? [])
    .slice()
    .sort((p, q) => (q.transferSize ?? 0) - (p.transferSize ?? 0))
    .slice(0, 6);
  for (const r of reqs) {
    console.log(
      `  ${Math.round((r.transferSize ?? 0) / 1024)}KB end ${sec(r.networkEndTime)} ${cut(r.url.replace(/^https?:\/\/[^/]+/, ""), 80)}`
    );
  }
}