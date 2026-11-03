
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Types } from 'mongoose';

import BookingModel from '../../models/Booking';
import CategoryModel from '../../models/Category';
import { NotificationModel } from '../../models/Notification';
import PartnerModel from '../../models/Partner';
import PayoutModel from '../../models/Payout';
import ReviewModel from '../../models/Review';
import ServiceAreaModel from '../../models/ServiceArea';
import TicketModel from '../../models/Ticket';
import { ServiceModel } from '../../models/Service';
import { UserModel } from '../../models/User';

import { Errors } from '../../utils/errors';
import { HttpError } from '../auth/auth.types';
import { designationsService } from '../designations/designations.service';
import { mailService } from '../../services/mail.service';
import { auditService } from '../audit/audit.service';
import { readKycDocument } from './kyc-storage';

/** The set-password link in the approval email works this long. */
const APPROVAL_LINK_HOURS = 72;

import type {
  CreatePartnerInput,
  UpdatePartnerInput,
} from './partners.validation';

interface AuditActor {
  id: string;
  ip: string;
}

/**
 * Safe audit snapshot.
 * Never include password hashes or tokens.
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
 * Partner audit helper.
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
 * Canonical designation.
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
 * Find a partner's User record by User ID.
 *
 * The directory's `id` is the User ID.
 */
async function findPartnerUser(id: string) {
  if (!Types.ObjectId.isValid(id)) {
    throw new HttpError(
      400,
      'Invalid partner ID',
      'INVALID_PARTNER_ID',
    );
  }

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
 * Ensure a partner profile exists.
 */
export async function ensurePartnerProfile(
  userId: string | Types.ObjectId,
) {
  const normalizedUserId =
    userId instanceof Types.ObjectId
      ? userId
      : new Types.ObjectId(userId);

  let partner = await PartnerModel.findOne({
    userId: normalizedUserId,
  });

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

  if (
    partner.kyc &&
    (partner.kyc as any).status === 'not_submitted'
  ) {
    partner.kyc.status = 'not_started';
  }

  const hasCategories =
    Array.isArray(partner.categories) &&
    partner.categories.length > 0;

  const hasServices =
    Array.isArray((partner as any).services) &&
    (partner as any).services.length > 0;

  if (!hasCategories || !hasServices) {
    let category = null;

    if (hasCategories) {
      category = await CategoryModel.findById(
        partner.categories[0],
      );
    }

    if (!category) {
      category = await CategoryModel.findOne({
        active: true,
      }).sort({
        sortOrder: 1,
        name: 1,
      });
    }

    if (category) {
      if (!hasCategories) {
        partner.categories = [
          category._id as Types.ObjectId,
        ];
      }

      if (!hasServices) {
        const services = await ServiceModel.find({
          categoryId: category._id,
          active: true,
        }).select('_id');

        (partner as any).services = services.map(
          (service: any) => service._id as Types.ObjectId,
        );
      }

      await partner.save();
    }
  }

  return partner;
}

/**
 * Partner service.
 */
/**
 * City shown on the admin Partners & KYC pages. Prefer what the partner gave at registration, then
 * their service area, then the city of their latest booking (older partners have nothing stored).
 */
function resolveCity(...candidates: Array<string | null | undefined>): string {
  for (const c of candidates) {
    const v = typeof c === 'string' ? c.trim() : '';
    if (v) return v;
  }
  return '';
}

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

    try {
      await ensurePartnerProfile(partner._id);
    } catch (error) {
      await partner.deleteOne();
      throw error;
    }

    await recordPartnerAudit({
      actor,
      action: 'partner.created',
      entityId: String(partner._id),
      before: null,
      after: partnerAuditSnapshot(partner),
    });

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
    } catch (error) {
      emailSent = false;
      console.error(
        'Partner credentials email failed:',
        error,
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

    for (const partner of partners) {
      const profile = await ensurePartnerProfile(partner._id);
      kycByUser.set(String(partner._id), String(profile.kyc?.status ?? 'not_started'));
    }

    return partners.map((p) => toDto(p, kycByUser.get(String(p._id))));
  }

  /**
   * PARTNERS & KYC DIRECTORY
   */
  async directory() {
    const partners = await PartnerModel.find({})
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    const userIds = partners.map((partner) => partner.userId);

    const [
      users,
      lastCities,
      categories,
    ] = await Promise.all([
      UserModel.find({
        _id: { $in: userIds },
        role: 'partner',
      })
        .select('name email phone status designation')
        .lean(),

      BookingModel.aggregate<{
        _id: unknown;
        city?: string;
      }>([
        {
          $match: {
            partnerId: {
              $in: partners.map((partner) => partner._id),
            },
            'address.city': {
              $exists: true,
              $ne: '',
            },
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $group: {
            _id: '$partnerId',
            city: { $first: '$address.city' },
          },
        },
      ]),

      CategoryModel.find({})
        .select('name')
        .lean(),
    ]);

    const userById = new Map(
      users.map((user) => [
        String(user._id),
        user,
      ]),
    );

    const cityByPartner = new Map(
      lastCities.map((row) => [
        String(row._id),
        row.city ?? '',
      ]),
    );

    const categoryName = new Map(
      categories.map((category) => [
        String(category._id),
        category.name as string,
      ]),
    );

    const percentage = (numerator: number, denominator: number) =>
      denominator > 0
        ? Math.round((numerator / denominator) * 100)
        : 0;

    return partners.flatMap((partner) => {
      const user = userById.get(String(partner.userId));

      if (!user) {
        return [];
      }

      const stats = partner.stats ?? {
        offersReceived: 0,
        offersAccepted: 0,
        jobsAssigned: 0,
        jobsCompleted: 0,
      };

      return [
        {
          id: String(user._id),
          partnerId: String(partner._id),
          name: user.name,
          email: user.email,
          phone: user.phone ?? '',
          kycStatus: partner.kyc?.status ?? 'not_started',
          accountStatus:
            user.status === 'blocked'
              ? 'blocked'
              : user.status === 'invited'
                ? 'invited'
                : 'active',
          category:
            (partner.categories ?? [])
              .map((categoryId) =>
                categoryName.get(String(categoryId)),
              )
              .filter(Boolean)
              .join(', ') ||
            user.designation ||
            '',
          city:
            cityByPartner.get(String(partner._id)) ?? '',
          rating:
            Math.round((partner.ratingAvg ?? 0) * 10) / 10,
          ratingCount: partner.ratingCount ?? 0,
          acceptance: percentage(
            stats.offersAccepted,
            stats.offersReceived,
          ),
          completion: percentage(
            stats.jobsCompleted,
            stats.jobsAssigned,
          ),
        },
      ];
    });
  }

  /**
   * GET ONE PARTNER BY USER ID
   *
   * The View URL contains the User ID, not the Partner
   * profile ID. Load the User and associated profile.
   */
  async getById(id: string) {
    const user = await findPartnerUser(id);

    const profile = await PartnerModel.findOne({
      userId: user._id,
    }).lean();

    if (!profile) {
      throw new HttpError(
        404,
        'Partner profile not found',
        'PARTNER_PROFILE_NOT_FOUND',
      );
    }

    const categoryIds = profile.categories ?? [];

    const [
      categories,
      bookings,
    ] = await Promise.all([
      categoryIds.length
        ? CategoryModel.find({
            _id: { $in: categoryIds },
          })
            .select('name')
            .lean()
        : Promise.resolve([]),

      BookingModel.find({
        partnerId: profile._id,
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    ]);

    const categoryNames = categories.map(
      (category: any) => String(category.name),
    );

    const normalizedBookings = bookings.map(
      (booking: any) => ({
        id: String(booking._id),
        customer:
          typeof booking.customerName === 'string'
            ? booking.customerName
            : typeof booking.customer === 'string'
              ? booking.customer
              : 'Customer',
        service:
          typeof booking.serviceName === 'string'
            ? booking.serviceName
            : typeof booking.service === 'string'
              ? booking.service
              : 'Home Service',
        date: booking.createdAt
          ? new Date(booking.createdAt).toISOString()
          : '',
        status: String(booking.status ?? 'unknown'),
        amount: Number(
          booking.amount ??
          booking.totalAmount ??
          0,
        ),
      }),
    );

    const stats = profile.stats ?? {
      jobsCompleted: 0,
      jobsAssigned: 0,
      offersReceived: 0,
      offersAccepted: 0,
    };

    return {
      ...toDto(user),

      partnerId: String(profile._id),

      kycStatus: profile.kyc?.status ?? 'not_started',

      accountStatus:
        user.status === 'blocked'
          ? 'blocked'
          : user.status === 'invited'
            ? 'invited'
            : 'active',

      category:
        categoryNames.join(', ') ||
        user.designation ||
        '',

      city: '',

      rating: Number(profile.ratingAvg ?? 0),

      ratingCount: Number(profile.ratingCount ?? 0),

      joined: user.createdAt
        ? new Date(user.createdAt).toISOString().slice(0, 10)
        : '',

      address: '',

      profile: {
        experience: Number((profile as any).experience ?? 0),
        bio: String((profile as any).bio ?? ''),
      },

      categories: categoryNames,

      kyc: {
        status: profile.kyc?.status ?? 'not_started',
        submittedAt: (profile.kyc as any)?.submittedAt
          ? new Date(
              (profile.kyc as any).submittedAt,
            ).toISOString()
          : '',
        checklist: [],
        documents: Array.isArray(profile.kyc?.documents)
          ? profile.kyc.documents.map(
              (document: any, index: number) => ({
                id: String(document._id ?? document.id ?? index),
                name: String(
                  document.name ??
                  document.type ??
                  `Document ${index + 1}`,
                ),
                status: String(
                  document.status ?? 'Pending',
                ),
                url: String(document.url ?? ''),
                type: String(
                  document.type ?? '',
                ).toLowerCase().includes('pdf')
                  ? 'pdf'
                  : 'image',
              }),
            )
          : [],
      },

      performance: {
        completedBookings: Number(stats.jobsCompleted ?? 0),
        cancelledBookings: 0,
        averageResponseTime: 'N/A',
        customerSatisfaction: 0,
      },

      bookings: normalizedBookings,
      earnings: [],
      payouts: [],
      reviews: [],
      support: [],
      activity: [],
    };
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
    const before = partnerAuditSnapshot(user);

    await ensurePartnerProfile(user._id);

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

    if (
      input.status !== undefined &&
      input.status !== user.status
    ) {
      user.status = input.status;

      if (input.status === 'blocked') {
        user.tokenVersion = (user.tokenVersion ?? 0) + 1;
      }
    }

    await user.save();

    await recordPartnerAudit({
      actor,
      action: 'partner.updated',
      entityId: String(user._id),
      before,
      after: partnerAuditSnapshot(user),
    });

    const profile = await PartnerModel.findOne({ userId: user._id }).select('kyc.status').lean();

    return toDto(user, String(profile?.kyc?.status ?? 'not_started'));
  }

  /**
   * REMOVE PARTNER
   */
  async remove(
    id: string,
    actor: AuditActor,
  ): Promise<void> {
    const user = await findPartnerUser(id);
    const before = partnerAuditSnapshot(user);

    const profile = await PartnerModel.findOne(
      { userId: user._id },
      '_id',
    ).lean();

    if (
      profile &&
      await BookingModel.exists({
        partnerId: profile._id,
      })
    ) {
      throw new HttpError(
        409,
        'This partner has booking history and cannot be deleted. Block the account instead.',
        'PARTNER_HAS_BOOKINGS',
      );
    }

    await Promise.all([
      profile
        ? PartnerModel.deleteOne({ _id: profile._id })
        : Promise.resolve(),

      NotificationModel.deleteMany({
        userId: user._id,
      }),
    ]);

    await user.deleteOne();

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
      UserModel.countDocuments({ role: 'partner' }),
      UserModel.countDocuments({ role: 'customer' }),
    ]);

    return {
      partners,
      customers,
    };
  }
}

/**
 * Safe User DTO.
 */
function toDto(
  user: InstanceType<typeof UserModel>,
) {
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
 * Export service.
 */
export const partnersService = new PartnersService();
