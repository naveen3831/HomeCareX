import { UserModel } from '../../models/User';
import type { ProfileDoc } from './customer-profile.types';

/** Thin Mongo layer so the service can be tested against an in-memory fake. */
export const customerProfileRepository = {
  /** Includes the avatar, which is `select: false` on the schema. */
  findById: (id: string) => UserModel.findById(id).select('+avatar').lean() as unknown as Promise<ProfileDoc | null>,
  findByEmail: (email: string) => UserModel.findOne({ email }).select('_id').lean() as unknown as Promise<{ _id: unknown } | null>,
  findByPhone: (phone: string) => UserModel.findOne({ phone }).select('_id').lean() as unknown as Promise<{ _id: unknown } | null>,
  update: (id: string, upd: { $set?: Record<string, unknown>; $unset?: Record<string, ''> }) =>
    UserModel.findByIdAndUpdate(id, upd, { new: true, runValidators: true }).select('+avatar').lean() as unknown as Promise<ProfileDoc | null>,
};
export type CustomerProfileRepository = typeof customerProfileRepository;
