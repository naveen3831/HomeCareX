import sharp from "sharp";
import { mkdirSync, readdirSync, statSync } from "fs";
import path from "path";

const dir = "public/images";
const out = path.join(dir, "card");
mkdirSync(out, { recursive: true });

let before = 0;
let after = 0;

for (const file of readdirSync(dir)) {
  if (!file.toLowerCase().endsWith(".webp")) continue;

  const src = path.join(dir, file);
  const dst = path.join(out, file);

  await sharp(src)
    .resize(640, 480, { fit: "cover", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(dst);

  before += statSync(src).size;
  after += statSync(dst).size;
}

console.log(
  `Done. ${(before / 1024).toFixed(0)} KB -> ${(after / 1024).toFixed(0)} KB (in public/images/card)`
);