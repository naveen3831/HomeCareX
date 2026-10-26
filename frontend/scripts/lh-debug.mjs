import { readdirSync, readFileSync } from "fs";
import path from "path";

const dir = "lighthouse-report";
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".report.json"))
  .sort();

// Keep only the newest report for each URL
const latest = new Map();
for (const file of files) {
  const report = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  latest.set(report.finalDisplayedUrl || report.finalUrl, report);
}

for (const [url, report] of latest) {
  console.log("=".repeat(60));
  console.log(url);

  const a11yIds = new Set(report.categories.accessibility.auditRefs.map((ref) => ref.id));

  for (const [id, audit] of Object.entries(report.audits)) {
    if (audit.score === 0 && a11yIds.has(id) && audit.details?.items?.length) {
      console.log(`[accessibility] ${id}`);
      for (const item of audit.details.items.slice(0, 5)) {
        const selector = (item.node?.selector || "").slice(0, 100);
        const snippet = (item.node?.snippet || "").replace(/\s+/g, " ").slice(0, 170);
        console.log(`    ${selector} | ${snippet}`);
      }
    }
  }

  const requests = report.audits["network-requests"]?.details?.items ?? [];
  for (const request of requests.filter((item) => /appliance-repair/.test(item.url))) {
    console.log(
      `[request] ${request.url.replace(/^https?:\/\/[^/]+/, "")}` +
        ` | start ${Math.round(request.networkRequestTime)}ms` +
        ` | end ${Math.round(request.networkEndTime)}ms` +
        ` | priority ${request.priority}` +
        ` | cached ${request.transferSize === 0}`
    );
  }
}