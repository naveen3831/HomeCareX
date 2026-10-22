// scripts/optimize.mjs
// Run from the frontend folder:  node scripts/optimize.mjs
// Requires:  npm i -D sharp
import sharp from "sharp";

// Header logo: displayed about 64px tall, so 128px is enough for sharp screens
await sharp("public/logo.png")
  .resize({ height: 128 })
  .webp({ quality: 85 })
  .toFile("public/logo.webp");

// Plumbing image: the original was 4284 x 5712
await sharp("public/images/plumbing.webp")
  .resize({ width: 1200 })
  .webp({ quality: 75 })
  .toFile("public/images/plumbing-1200.webp");

// Hero image for phones (the 1672px version stays for large screens)
await sharp("public/images/background.webp")
  .resize({ width: 800 })
  .webp({ quality: 75 })
  .toFile("public/images/background-800.webp");

console.log("Done");