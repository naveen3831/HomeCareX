import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

// Same fonts and weights that index.html requests from Google today.
const CSS_URL =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Manrope:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&display=swap";

// A modern browser name makes Google send WOFF2 files.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

// Alphabets to keep. Browsers only download a file when the page uses its characters.
const KEEP_SUBSETS = new Set(["latin", "latin-ext", "devanagari"]);

const FONT_DIR = "public/fonts";
mkdirSync(FONT_DIR, { recursive: true });

const response = await fetch(CSS_URL, { headers: { "User-Agent": USER_AGENT } });
if (!response.ok) throw new Error(`Google Fonts request failed: ${response.status}`);
const googleCss = await response.text();

const slug = (text) =>
  text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const blocks = [...googleCss.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)];

const downloaded = new Map(); // remote url -> local file name
const cssBlocks = [];
let preloadFile = null;

for (const [, subset, block] of blocks) {
  if (!KEEP_SUBSETS.has(subset)) continue;

  const family = /font-family:\s*'([^']+)'/.exec(block)?.[1];
  const weight = /font-weight:\s*([^;]+);/.exec(block)?.[1]?.trim();
  const remote = /url\((https:[^)]+\.woff2)\)/.exec(block)?.[1];
  if (!family || !weight || !remote) continue;

  if (!downloaded.has(remote)) {
    const fileName = `${slug(family)}-${slug(weight)}-${subset}.woff2`;
    const fontResponse = await fetch(remote, { headers: { "User-Agent": USER_AGENT } });
    if (!fontResponse.ok) throw new Error(`Download failed (${fontResponse.status}): ${remote}`);
    writeFileSync(path.join(FONT_DIR, fileName), Buffer.from(await fontResponse.arrayBuffer()));
    downloaded.set(remote, fileName);
    console.log(`Saved ${fileName}`);
  }

  const localFile = downloaded.get(remote);
  if (family === "DM Sans" && subset === "latin" && !preloadFile) preloadFile = localFile;

  cssBlocks.push(
    block.replace(remote, `/fonts/${localFile}`).replace(/\s+/g, " ").trim()
  );
}

if (cssBlocks.length === 0) throw new Error("No font faces were found in the Google Fonts response.");

const fontCss = cssBlocks.join("\n");
writeFileSync(path.join(FONT_DIR, "fonts.css"), fontCss + "\n");

// ---- Update index.html (a backup is saved first) ----
const htmlPath = "index.html";
const html = readFileSync(htmlPath, "utf8");

if (html.includes("Self-hosted fonts")) {
  console.log("index.html already uses self-hosted fonts. Font files were refreshed only.");
  process.exit(0);
}

const start = html.indexOf("<!-- ONE font request");
const noscriptClose = start === -1 ? -1 : html.indexOf("</noscript>", start);

if (start === -1 || noscriptClose === -1) {
  console.error("Could not find the Google Fonts block in index.html. index.html was NOT changed.");
  process.exit(1);
}

mkdirSync("scripts/backup", { recursive: true });
if (!existsSync("scripts/backup/index.before-fonts.html")) {
  copyFileSync(htmlPath, "scripts/backup/index.before-fonts.html");
}

const preloadTag = preloadFile
  ? `<link rel="preload" as="font" type="font/woff2" crossorigin href="/fonts/${preloadFile}" />`
  : "";

const replacement = [
  "<!-- Self-hosted fonts (made by scripts/self-host-fonts.mjs): same families as before, no third-party requests. -->",
  preloadTag,
  "<style>",
  fontCss,
  "</style>",
]
  .filter(Boolean)
  .join("\n    ");

let patched = html.slice(0, start) + replacement + html.slice(noscriptClose + "</noscript>".length);

// The preconnect hints to Google are no longer needed.
patched = patched.replace(
  /[ \t]*<link rel="preconnect" href="https:\/\/fonts\.(?:googleapis|gstatic)\.com"[^>]*\/>\r?\n?/g,
  ""
);

writeFileSync(htmlPath, patched);
console.log("Done. index.html now uses fonts from /fonts. Backup: scripts/backup/index.before-fonts.html");