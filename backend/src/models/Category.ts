import { Schema, model } from 'mongoose';

const CategoryImageSchema = new Schema(
  {
    url: { type: String, required: true, trim: true, maxlength: 300_000 }, // https URL or a resized data: URL
    alt: { type: String, trim: true, default: '', maxlength: 160 },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false },
);

/** Service category (Home Cleaning, Appliance Repair...). Managed by admins; services and partners reference it. */
const CategorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, collation: { locale: 'en', strength: 2 } },
    slug: { type: String, required: true, trim: true, unique: true, index: true },
    description: { type: String, trim: true, default: '' },
    icon: { type: String, trim: true, default: '' },
    /** Uploaded icon image; wins over the emoji icon when set. */
    iconUrl: { type: String, trim: true, default: '', maxlength: 300_000 },
    /** Two-level tree: null = top-level category, otherwise the parent's id. */
    parentId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    images: { type: [CategoryImageSchema], default: [] },
    sortOrder: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const CategoryModel = model('Category', CategorySchema);
export default CategoryModel;
