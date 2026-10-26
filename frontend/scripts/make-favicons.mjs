import sharp from "sharp";

// Crop the house icon from the full logo (the logo is 2001x786)
const icon = sharp("public/logo.png").extract({ left: 110, top: 150, width: 500, height: 500 });

await icon.clone().resize(48, 48).png({ compressionLevel: 9 }).toFile("public/favicon-48.png");
await icon.clone().resize(192, 192).png({ compressionLevel: 9 }).toFile("public/favicon-192.png");
await icon.clone().resize(180, 180).png({ compressionLevel: 9 }).toFile("public/apple-touch-icon.png");

console.log("Favicons created");