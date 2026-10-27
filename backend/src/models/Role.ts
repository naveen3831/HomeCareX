import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * Admin-panel roles. System roles (the 6 the app ships with) use fixed ids like `role_super_admin`
 * and are rewritten from rbac.constants.ts at start-up, so code is their source of truth.
 * Custom roles get `role_<random>` ids. Staff.roleId points at `_id`.
 */
const RoleSchema = new Schema(
  {
    _id: { type: String, required: true },
    key: { type: String },
    name: { type: String, required: true, trim: true, unique: true, collation: { locale: 'en', strength: 2 } },
    description: { type: String, default: '', trim: true },
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true, _id: false },
);

export type Role = InferSchemaType<typeof RoleSchema>;
export const RoleModel = model('Role', RoleSchema);
export default RoleModel;
