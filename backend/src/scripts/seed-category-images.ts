/**
 * Puts the photos and icons the customer app and the public site used to hard-code INTO the database,
 * so the admin Categories page shows them and every site reads the same data from the API.
 *
 *   - Cover photo: the default photo becomes the Primary image. Images the admin already has stay in the
 *     category as extra (non-primary) images, so nothing is lost.
 *   - Icon: the default 3D icon is set only when the category has no uploaded icon yet.
 *
 * Safe to re-run: a category that already contains its default photo is not touched again, so a
 * different Primary chosen later in the admin panel is never overwritten.
 *
 *   npx ts-node --transpile-only src/scripts/seed-category-images.ts
 *
 * The urls are files in the FRONTEND's public folder (served from the site's own origin).
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { CategoryModel } from '../models/Category';
import { DEFAULT_CATEGORY_MEDIA } from '../modules/categories/categories.constants';

dotenv.config();

/** Older slugs the sites used before the catalog slugs were finalised. */
const ALIASES: Record<string, string> = {
  'appliance-repair': 'appliance-repair-service',
  painting: 'painting-waterproofing',
  carpentry: 'carpentry-furniture-assembly',
};

const MAX_IMAGES = 10; // same cap as the admin API

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set (see backend/.env.example).');
  await mongoose.connect(url);

  const categories = await CategoryModel.find({}).select('name slug images iconUrl');
  let updated = 0;
  for (const c of categories) {
    const media = DEFAULT_CATEGORY_MEDIA[ALIASES[c.slug] ?? c.slug];
    if (!media) {
      console.log(`  [skip] ${c.slug}: no default photo listed (upload one in the admin panel)`);
      continue;
    }

    let changed = false;

    if (!c.images.some((i) => i.url === media.image)) {
      const extras = c.images.map((i) => ({ url: i.url, alt: i.alt ?? '', isPrimary: false }));
      c.set('images', [{ url: media.image, alt: c.name, isPrimary: true }, ...extras].slice(0, MAX_IMAGES));
      changed = true;
    }
    if (!c.iconUrl) {
      c.set('iconUrl', media.iconUrl);
      changed = true;
    }

    if (!changed) {
      console.log(`  [keep] ${c.slug}: already has its default photo and an icon`);
      continue;
    }
    await c.save();
    updated++;
    console.log(`  [set ] ${c.slug} -> ${media.image} + ${c.iconUrl}`);
  }
  console.log(`\nDone. ${updated} categories updated.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
