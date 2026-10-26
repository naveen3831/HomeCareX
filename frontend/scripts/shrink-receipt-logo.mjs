import sharp from "sharp";
import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "fs";

const file = "src/assets/image.png";
const backup = "scripts/backup/image.original.png"; // outside src, so it is never bundled

mkdirSync("scripts/backup", { recursive: true });

// Keep the original once, so you can always go back
if (!existsSync(backup)) copyFileSync(file, backup);

const before = statSync(backup).size;

const output = await sharp(backup)
  .resize({ width: 500, withoutEnlargement: true })
  .png({ palette: true, quality: 85, compressionLevel: 9 })
  .toBuffer();

writeFileSync(file, output);

console.log(
  `Done. ${(before / 1024).toFixed(0)} KB -> ${(output.length / 1024).toFixed(0)} KB (src/assets/image.png)`
);