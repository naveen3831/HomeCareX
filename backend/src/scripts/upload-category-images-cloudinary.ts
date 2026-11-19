import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
import mongoose from 'mongoose';
import { CategoryModel } from '../models/Category';
import { DEFAULT_CATEGORY_MEDIA } from '../modules/categories/categories.constants';
import { CloudinaryService } from '../services/cloudinary.service';

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is not set.');

  console.log('[cloudinary-transfer] Connecting to MongoDB...');
  await mongoose.connect(dbUrl);
  console.log('[cloudinary-transfer] MongoDB connected.');

  if (!CloudinaryService.isConfigured()) {
    throw new Error('Cloudinary credentials are not configured in environment.');
  }

  const frontendPublic = path.resolve(__dirname, '../../../frontend/public');
  const categories = await CategoryModel.find({});
  console.log(`[cloudinary-transfer] Found ${categories.length} categories to process.`);

  let updatedCount = 0;

  for (const cat of categories) {
    const defaultMedia = DEFAULT_CATEGORY_MEDIA[cat.slug];
    if (!defaultMedia) {
      console.log(`  [skip] ${cat.name} (${cat.slug}): no default media mapping`);
      continue;
    }

    console.log(`\nProcessing "${cat.name}"...`);

    // 1. Upload Cover Image to Cloudinary
    let cloudImageUrl: string | null = null;
    const localImagePath = path.join(frontendPublic, defaultMedia.image.replace(/^\//, ''));
    if (fs.existsSync(localImagePath)) {
      try {
        console.log(`  Uploading cover image: ${path.basename(localImagePath)}`);
        const uploadResult = await CloudinaryService.uploadImage(localImagePath, 'homecarex/categories', {
          public_id: `cat_${cat.slug}_cover`,
          overwrite: true,
        });
        cloudImageUrl = uploadResult.secureUrl;
        console.log(`  -> Cover uploaded: ${cloudImageUrl}`);
      } catch (err: unknown) {
        console.error(`  x Failed to upload cover image for ${cat.slug}:`, err instanceof Error ? err.message : err);
      }
    } else {
      console.log(`  Cover file not found at: ${localImagePath}`);
    }

    // 2. Upload Icon to Cloudinary
    let cloudIconUrl: string | null = null;
    const localIconPath = path.join(frontendPublic, defaultMedia.iconUrl.replace(/^\//, ''));
    if (fs.existsSync(localIconPath)) {
      try {
        console.log(`  Uploading icon: ${path.basename(localIconPath)}`);
        const uploadResult = await CloudinaryService.uploadImage(localIconPath, 'homecarex/icons', {
          public_id: `cat_${cat.slug}_icon`,
          overwrite: true,
        });
        cloudIconUrl = uploadResult.secureUrl;
        console.log(`  -> Icon uploaded: ${cloudIconUrl}`);
      } catch (err: unknown) {
        console.error(`  x Failed to upload icon for ${cat.slug}:`, err instanceof Error ? err.message : err);
      }
    } else {
      console.log(`  Icon file not found at: ${localIconPath}`);
    }

    // 3. Update Category in DB with the Cloudinary URLs
    const updatePatch: Record<string, unknown> = {};

    if (cloudImageUrl) {
      updatePatch.images = [{ url: cloudImageUrl, alt: cat.name, isPrimary: true }];
    }
    if (cloudIconUrl) {
      updatePatch.iconUrl = cloudIconUrl;
    }

    if (Object.keys(updatePatch).length > 0) {
      await CategoryModel.updateOne({ _id: cat._id }, { $set: updatePatch });
      console.log(`  -> Category "${cat.name}" updated in MongoDB with Cloudinary URLs.`);
      updatedCount++;
    }
  }

  console.log(`\n[cloudinary-transfer] Complete! Updated ${updatedCount} categories in MongoDB.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[cloudinary-transfer] Error:', err);
  await mongoose.disconnect();
  process.exit(1);
});
