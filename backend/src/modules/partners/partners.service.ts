import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';

import BookingModel from '../../models/Booking';
import { CategoryModel } from '../../models/Category';
import { NotificationModel } from '../../models/Notification';
import PartnerModel from '../../models/Partner';
import { ServiceModel } from '../../models/Service';
import { UserModel } from '../../models/User';

import { Errors } from '../../utils/errors';
import { HttpError } from '../auth/auth.types';
import { designationsService } from '../designations/designations.service';
import { mailService } from '../../services/mail.service';
import { auditService } from '../audit/audit.service';

import type {
  CreatePartnerInput,
  UpdatePartnerInput,
} from './partners.validation';

interface AuditActor {
  id: string;
  ip: string;
}

/**
 * ---------------------------------------------------------
 * SAFE PARTNER AUDIT SNAPSHOT
 * ---------------------------------------------------------
 *
 * Nullable fields match the User model.
 * Never include passwords, password hashes, or tokens.
 */
function partnerAuditSnapshot(user: {
  _id: unknown;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  gender?: string | null;
  designation?: string | null;
  status?: string | null;
  createdAt?: Date | null;
}) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    designation: user.designation,
    status: user.status,
    createdAt: user.createdAt,
  };
}

/**
 * ---------------------------------------------------------
 * PARTNER AUDIT HELPER
 * ---------------------------------------------------------
 *
 * A failed audit insert must not undo a successful
 * partner operation. Log the failure for reconciliation.
 */
async function recordPartnerAudit(input: {
  actor: AuditActor;
  action: string;
  entityId: string;
  before: unknown;
  after: unknown;
}): Promise<void> {
  try {
    await auditService.recordAudit({
      actor: input.actor.id,
      action: input.action,
      entity: 'Partner',
      entityId: input.entityId,
      before: input.before,
      after: input.after,
      ip: input.actor.ip,
      result: 'Success',
    });
  } catch (error) {
    console.error(
      `[partners] Audit write failed: ${input.action}, partner ${input.entityId}, admin ${input.actor.id}`,
      error,
    );
  }
}

/**
 * ---------------------------------------------------------
 * CANONICAL DESIGNATION
 * ---------------------------------------------------------
 */
async function canonicalDesignation(
  name: string,
): Promise<string> {
  const found = await designationsService.canonical(name);

  if (!found) {
    throw Errors.validation([
      {
        field: 'designation',
        message: 'Select a designation from the list',
      },
    ]);
  }

  return found;
}

/**
 * ---------------------------------------------------------
 * FIND PARTNER USER
 * ---------------------------------------------------------
 */
async function findPartnerUser(id: string) {
  const user = await UserModel.findOne({
    _id: id,
    role: 'partner',
  });

  if (!user) {
    throw new HttpError(
      404,
      'Partner not found',
      'PARTNER_NOT_FOUND',
    );
  }

  return user;
}

/**
 * ---------------------------------------------------------
 * ENSURE PARTNER PROFILE
 * ---------------------------------------------------------
 */
export async function ensurePartnerProfile(
  userId: string | Types.ObjectId,
) {
  const normalizedUserId =
    userId instanceof Types.ObjectId
      ? userId
      : new Types.ObjectId(userId);

  let partner = await PartnerModel.findOne({ userId: normalizedUserId });
  if (!partner) {
    partner = await PartnerModel.create({
      userId: normalizedUserId,
      categories: [],
      skills: [],
      services: [],
      serviceRadiusKm: 15,
      ratingAvg: 0,
      ratingCount: 0,
      stats: {
        offersReceived: 0,
        offersAccepted: 0,
        jobsAssigned: 0,
        jobsCompleted: 0,
      },
      kyc: {
        status: 'not_started',
        documents: [],
      },
      trainingCompleted: false,
    });
  }

  if (partner.kyc && (partner.kyc as any).status === 'not_submitted') {
    partner.kyc.status = 'not_started';
  }

  // Auto-assign services if categories or services are empty
  const hasCategories = Array.isArray(partner.categories) && partner.categories.length > 0;
  const hasServices = Array.isArray((partner as any).services) && (partner as any).services.length > 0;

  if (!hasCategories || !hasServices) {
    let catDoc = null;
    if (hasCategories) {
      catDoc = await CategoryModel.findById(partner.categories[0]);
    }
    if (!catDoc) {
      catDoc = await CategoryModel.findOne({ active: true }).sort({ sortOrder: 1, name: 1 });
    }

    if (catDoc) {
      if (!hasCategories) {
        partner.categories = [catDoc._id as Types.ObjectId];
      }
      if (!hasServices) {
        const matched = await ServiceModel.find({ categoryId: catDoc._id, active: true }).select('_id');
        (partner as any).services = matched.map((s: any) => s._id as Types.ObjectId);
      }
      await partner.save();
    }
  }

  return partner;
  return PartnerModel.findOneAndUpdate(
    {
      userId: normalizedUserId,
    },
    {
      $setOnInsert: {
        userId: normalizedUserId,
        categories: [],
        skills: [],
        serviceRadiusKm: 10,
        ratingAvg: 0,
        ratingCount: 0,
        stats: {
          offersReceived: 0,
          offersAccepted: 0,
          jobsAssigned: 0,
          jobsCompleted: 0,
        },
        kyc: {
          status: 'not_started',
          documents: [],
        },
        trainingCompleted: false,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    },
  );
}

/**
 * ---------------------------------------------------------
 * PARTNERS SERVICE
 * ---------------------------------------------------------
 */
export class PartnersService {
  /**
   * CREATE PARTNER
   */
  async create(
    input: CreatePartnerInput,
    actor: AuditActor,
  ) {
    const duplicate = await UserModel.exists({
      $or: [
        { email: input.email },
        { phone: input.phone },
      ],
    });

    if (duplicate) {
      throw new HttpError(
        409,
        'A user with this email or phone already exists',
        'DUPLICATE_ACCOUNT',
      );
    }

    const designation = await canonicalDesignation(
      input.designation,
    );

    const partner = await UserModel.create({
      name: input.name,
      email: input.email,
      phone: input.phone,
      gender: input.gender,
      designation,
      passwordHash: await bcrypt.hash(input.password, 12),
      role: 'partner',
    });

    /**
     * Roll back User creation if profile creation fails.
     */
    try {
      await ensurePartnerProfile(partner._id);
    } catch (error) {
      await partner.deleteOne();
      throw error;
    }

    /**
     * Audit successful partner creation.
     */
    await recordPartnerAudit({
      actor,
      action: 'partner.created',
      entityId: String(partner._id),
      before: null,
      after: partnerAuditSnapshot(partner),
    });

    /**
     * Send partner credentials email.
     */
    let emailSent = true;

    try {
      await mailService.sendPartnerCredentials(
        {
          name: input.name,
          email: input.email,
          designation,
        },
        input.password,
      );
    } catch (err) {
      emailSent = false;

      console.error(
        'Partner credentials email failed:',
        err,
      );
    }

    return {
      partner: toDto(partner),
      emailSent,
    };
  }

  /**
   * LIST PARTNERS
   */
  async list() {
    const partners = await UserModel.find({
      role: 'partner',
    })
      .sort({ createdAt: -1 })
      .limit(500);

    /**
     * Repair old partner Users missing a Partner profile.
     */
    for (const partner of partners) {
      await ensurePartnerProfile(partner._id);
    }

    return partners.map(toDto);
  }

  /**
   * UPDATE PARTNER
   */
  async update(
    id: string,
    input: UpdatePartnerInput,
    actor: AuditActor,
  ) {
    const user = await findPartnerUser(id);

    /**
     * Capture the original state before modifications.
     */
    const before = partnerAuditSnapshot(user);

    await ensurePartnerProfile(user._id);

    /**
     * EMAIL
     */
    if (
      input.email !== undefined &&
      input.email !== user.email
    ) {
      const duplicate = await UserModel.exists({
        email: input.email,
        _id: { $ne: user._id },
      });

      if (duplicate) {
        throw new HttpError(
          409,
          'Another user already uses this email',
          'DUPLICATE_ACCOUNT',
        );
      }

      user.email = input.email;
    }

    /**
     * PHONE
     */
    if (
      input.phone !== undefined &&
      input.phone !== user.phone
    ) {
      const duplicate = await UserModel.exists({
        phone: input.phone,
        _id: { $ne: user._id },
      });

      if (duplicate) {
        throw new HttpError(
          409,
          'Another user already uses this phone number',
          'DUPLICATE_ACCOUNT',
        );
      }

      user.phone = input.phone;
    }

    /**
     * BASIC DETAILS
     */
    if (input.name !== undefined) {
      user.name = input.name;
    }

    if (input.gender !== undefined) {
      user.gender = input.gender;
    }

    if (input.designation !== undefined) {
      user.designation = await canonicalDesignation(
        input.designation,
      );
    }

    /**
     * ACCOUNT STATUS
     */
    if (
      input.status !== undefined &&
      input.status !== user.status
    ) {
      user.status = input.status;

      /**
       * Invalidate existing sessions when blocking a partner.
       */
      if (input.status === 'blocked') {
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      }
    }

    await user.save();

    /**
     * Audit the successful update with before/after snapshots.
     */
    await recordPartnerAudit({
      actor,
      action: 'partner.updated',
      entityId: String(user._id),
      before,
      after: partnerAuditSnapshot(user),
    });

    return toDto(user);
  }

  /**
   * REMOVE PARTNER
   */
  async remove(
    id: string,
    actor: AuditActor,
  ): Promise<void> {
    const user = await findPartnerUser(id);

    /**
     * Capture the original state before deletion.
     */
    const before = partnerAuditSnapshot(user);

    const profile = await PartnerModel.findOne(
      {
        userId: user._id,
      },
      '_id',
    ).lean();

    /**
     * Don't delete partners with booking history.
     */
    if (
      profile &&
      (await BookingModel.exists({
        partnerId: profile._id,
      }))
    ) {
      throw new HttpError(
        409,
        'This partner has booking history and cannot be deleted. Block the account instead.',
        'PARTNER_HAS_BOOKINGS',
      );
    }

    await Promise.all([
      profile
        ? PartnerModel.deleteOne({
            _id: profile._id,
          })
        : Promise.resolve(),

      NotificationModel.deleteMany({
        userId: user._id,
      }),
    ]);

    await user.deleteOne();

    /**
     * Audit the successful deletion.
     */
    await recordPartnerAudit({
      actor,
      action: 'partner.deleted',
      entityId: String(user._id),
      before,
      after: null,
    });
  }

  /**
   * STATS
   */
  async stats() {
    const [partners, customers] = await Promise.all([
      UserModel.countDocuments({
        role: 'partner',
      }),

      UserModel.countDocuments({
        role: 'customer',
      }),
    ]);

    return {
      partners,
      customers,
    };
  }
}

/**
 * ---------------------------------------------------------
 * PARTNER DTO
 * ---------------------------------------------------------
 */
function toDto(
  u: InstanceType<typeof UserModel>,
) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    gender: u.gender,
    designation: u.designation,
    status: u.status,
    createdAt: u.createdAt,
  };
}

/**
 * ---------------------------------------------------------
 * EXPORT SERVICE
 * ---------------------------------------------------------
 */
export const partnersService = new PartnersService();