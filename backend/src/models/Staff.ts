import { Schema, model, type InferSchemaType } from 'mongoose';

export const STAFF_STATUSES = ['active', 'invited', 'deactivated'] as const;
export type StaffStatusValue = (typeof STAFF_STATUSES)[number];

/**
 * Admin-panel team members. Stored in the `staff` collection.
 * The login credentials (password hash, sessions, tokens) stay in `users` because that is what
 * /auth/login signs in; `userId` links the two. Role, status and invite info live here.
 */
const StaffSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    /** Role chosen in the UI (e.g. role_admin). Becomes a ref to the Role model once that exists. */
    roleId: { type: String, required: true },
    status: { type: String, enum: STAFF_STATUSES, default: 'invited', index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, collection: 'staff' },
);

export type Staff = InferSchemaType<typeof StaffSchema>;
export const StaffModel = model('Staff', StaffSchema);
export default StaffModel;
