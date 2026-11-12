import sharp from "sharp";

// Generates crisp favicons from the high-resolution brand icon
const icon = sharp("public/favicon-512.png");

await icon.clone().resize(32, 32).png({ compressionLevel: 9 }).toFile("public/favicon.png");
await icon.clone().resize(48, 48).png({ compressionLevel: 9 }).toFile("public/favicon-48.png");
await icon.clone().resize(192, 192).png({ compressionLevel: 9 }).toFile("public/favicon-192.png");
await icon.clone().resize(180, 180).png({ compressionLevel: 9 }).toFile("public/apple-touch-icon.png");

console.log("Favicons created");