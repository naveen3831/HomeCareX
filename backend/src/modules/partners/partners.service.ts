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
import { ONBOARDING_TOTAL_STEPS } from '../partner-onboarding/partner-onboarding.service';

/** The set-password link in the approval email works this long. */
const APPROVAL_LINK_HOURS = 72;

/** Labels the admin UI expects (types/adminPartner.ts). */
const kycLabel = (status?: string | null): 'Approved' | 'Pending' | 'Rejected' =>
  status === 'approved' ? 'Approved' : status === 'rejected' || status === 'suspended' ? 'Rejected' : 'Pending';
const docLabel = (status?: string | null): 'Verified' | 'Pending' | 'Rejected' =>
  status === 'verified' ? 'Verified' : status === 'rejected' ? 'Rejected' : 'Pending';
const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

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
  const partners = await UserModel.find({ role: 'partner' })
    .sort({ createdAt: -1 })
    .limit(500);

  const kycByUser = new Map<string, string>();

  const profiles = await PartnerModel.find({
    userId: { $in: partners.map((p) => p._id) },
  }).select('userId kyc.status').lean();

  for (const profile of profiles) {
    const status = String(profile.kyc?.status ?? 'not_started');
    kycByUser.set(String(profile.userId), status === 'not_submitted' ? 'not_started' : status);
  }

  for (const partner of partners) {
    if (kycByUser.has(String(partner._id))) continue;
    try {
      const created = await ensurePartnerProfile(partner._id);
      kycByUser.set(String(partner._id), String(created.kyc?.status ?? 'not_started'));
    } catch (error) {
      console.error('[partners] Could not create profile for', String(partner._id), error);
      kycByUser.set(String(partner._id), 'not_started');
    }
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
          city: resolveCity(
            (partner as any).address?.city,
            cityByPartner.get(String(partner._id)),
          ),
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
   * KYC DECISION (admin).
   * approve: documents are marked verified, the partner is told to set a new password and gets an
   *          email with a single-use link (login stays blocked until they do).
   * reject:  needs a reason; the partner sees it when they try to sign in.
   */
  async reviewKyc(
    id: string,
    input: { decision: 'approve' | 'reject'; reason?: string },
    actor: AuditActor,
  ) {
    const user = await findPartnerUser(id);
    const profile = await PartnerModel.findOne({ userId: user._id });

    if (!profile) {
      throw new HttpError(404, 'Partner profile not found', 'PARTNER_PROFILE_NOT_FOUND');
    }

    const kyc = profile.kyc as any;
    const before = { kycStatus: String(kyc?.status ?? 'not_started') };
    let emailSent = false;

    if (input.decision === 'approve') {
      const alreadyApproved = kyc?.status === 'approved';
      // Approved and the partner already set a password: nothing to do. Approved but still waiting for the
      // set-password step (e.g. the first email failed): approving again sends a fresh link.
      if (alreadyApproved && !(user as any).passwordSetupRequired) {
        return { ...(await this.getById(id)), emailSent: false, passwordAlreadySet: true };
      }
      if (!alreadyApproved) {
        if (!Array.isArray(kyc?.documents) || kyc.documents.length === 0) {
          throw new HttpError(400, 'The partner has not uploaded any KYC documents yet.', 'KYC_DOCUMENTS_MISSING');
        }

        kyc.status = 'approved';
        kyc.reviewedAt = new Date();
        kyc.reviewedBy = actor.id;
        kyc.rejectionReason = undefined;
        kyc.suspensionReason = undefined;
        for (const document of kyc.documents) {
          document.status = 'verified';
          document.reviewNote = undefined;
        }
        await profile.save();
      }

      // Single-use set-password link. The login is blocked until the partner uses it.
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.passwordSetupRequired = true;
      (user as any).passwordResetTokenHash = sha256(rawToken);
      (user as any).passwordResetExpiresAt = new Date(Date.now() + APPROVAL_LINK_HOURS * 60 * 60 * 1000);
      await user.save();

      // Same base-URL rule as mail.service: FRONTEND_URL, else the origin of APP_LOGIN_URL, else the dev server (3000).
      const frontendUrl = (
        process.env.FRONTEND_URL ||
        (process.env.APP_LOGIN_URL ? new URL(process.env.APP_LOGIN_URL).origin : 'http://localhost:3000')
      ).replace(/\/$/, '');
      const setPasswordUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

      try {
        await mailService.sendPartnerApprovedEmail({
          name: user.name,
          email: user.email,
          setPasswordUrl,
          validHours: APPROVAL_LINK_HOURS,
        });
        emailSent = true;
        console.log(`[partners] set-password email sent to ${user.email}`);
      } catch (error) {
        const e = error as { code?: string; responseCode?: number; message?: string };
        console.error(`[partners] KYC approval email to ${user.email} FAILED: ${e.code ?? ''} ${e.responseCode ?? ''} ${e.message ?? error}`);
        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
          console.error('[partners] SMTP_HOST / SMTP_USER / SMTP_PASS are not all set in backend/.env, so no email can be sent.');
        }
        // Local testing only: the link is a one-time secret, so it is never printed in production.
        if (process.env.NODE_ENV !== 'production') {
          console.warn(`[partners] DEV ONLY set-password link for ${user.email}: ${setPasswordUrl}`);
        }
      }
    } else {
      const reason = (input.reason ?? '').trim();
      if (!reason) {
        throw new HttpError(400, 'Give a reason so the partner knows what to fix.', 'REJECTION_REASON_REQUIRED');
      }

      kyc.status = 'rejected';
      kyc.reviewedAt = new Date();
      kyc.reviewedBy = actor.id;
      kyc.rejectionReason = reason;
      for (const document of kyc.documents ?? []) {
        document.status = 'rejected';
      }
      await profile.save();
    }

    await recordPartnerAudit({
      actor,
      action: input.decision === 'approve' ? 'partner.kyc.approve' : 'partner.kyc.reject',
      entityId: id,
      before,
      after: { kycStatus: String(kyc.status), ...(input.reason ? { reason: input.reason } : {}) },
    });

    return { ...(await this.getById(id)), emailSent };
  }

  /** One stored KYC file for the admin preview. Legacy documents that only have an external URL are not served here. */
  async kycDocument(id: string, docId: string) {
    const user = await findPartnerUser(id);

    if (!Types.ObjectId.isValid(docId)) {
      throw new HttpError(404, 'Document not found', 'NOT_FOUND');
    }

    const profile = await PartnerModel.findOne({ userId: user._id }).select('kyc.documents').lean();
    const document = (profile?.kyc?.documents ?? []).find((d: any) => String(d._id) === docId) as any;

    if (!document) {
      throw new HttpError(404, 'Document not found', 'NOT_FOUND');
    }
    if (!document.storageKey) {
      throw new HttpError(404, 'This document was not stored on the server.', 'NOT_FOUND');
    }

    const buffer = await readKycDocument(String(document.storageKey));
    return { buffer, mimeType: String(document.mimeType || 'application/octet-stream') };
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

    const kycDocuments = Array.isArray(profile.kyc?.documents)
      ? profile.kyc.documents.map((document: any, index: number) => {
          const docId = String(document._id ?? document.id ?? index);
          // New uploads are stored on the server and streamed through the admin-only endpoint.
          const stored = Boolean(document.storageKey);
          const hint = String(document.mimeType ?? document.url ?? '').toLowerCase();
          return {
            id: docId,
            name: String(document.label ?? document.name ?? document.type ?? `Document ${index + 1}`),
            status: docLabel(document.status),
            url: stored ? `/admin/partners/${id}/kyc/documents/${docId}` : String(document.url ?? ''),
            secure: stored,
            type: hint.includes('pdf') ? 'pdf' : 'image',
          };
        })
      : [];

    // Checklist is derived from what the partner actually submitted: one check per uploaded
    // document (done once the document is verified) plus the optional bank details.
    const bank = (profile as any).bankDetails ?? {};
    const kycChecklist = [
      ...kycDocuments.map((document: { id: string; name: string; status: string }) => ({
        id: document.id,
        label: `${document.name} verified`,
        completed: document.status === 'Verified',
        required: true,
      })),
      {
        id: 'bank',
        label: 'Bank details provided',
        completed: Boolean(bank.accountLast4 || bank.upiId),
        required: false,
      },
    ];

    // Demo (training) progress. Submitted = all steps finished and waiting for the admin.
    const onboarding = ((profile as any).onboarding ?? {}) as {
      completedSteps?: number;
      completedAt?: Date;
      approvedAt?: Date;
    };
    const completedSteps = Math.min(Number(onboarding.completedSteps ?? 0), ONBOARDING_TOTAL_STEPS);
    const trainingFinished = completedSteps >= ONBOARDING_TOTAL_STEPS;
    const training = {
      status: onboarding.approvedAt && trainingFinished ? 'Approved' : trainingFinished ? 'Pending' : 'Not Submitted',
      submittedAt: onboarding.completedAt ? new Date(onboarding.completedAt).toISOString() : undefined,
      reviewedAt: onboarding.approvedAt ? new Date(onboarding.approvedAt).toISOString() : undefined,
      completedSteps,
      totalSteps: ONBOARDING_TOTAL_STEPS,
      items: [],
    };

    return {
      ...toDto(user),

      partnerId: String(profile._id),

      kycStatus: kycLabel(profile.kyc?.status),

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

      city: resolveCity((profile as any).address?.city),

      rating: Number(profile.ratingAvg ?? 0),

      ratingCount: Number(profile.ratingCount ?? 0),

      // Rates are derived from the counters the matching/booking services keep.
      acceptance: stats.offersReceived ? Math.round((Number(stats.offersAccepted ?? 0) / Number(stats.offersReceived)) * 100) : 0,
      completion: stats.jobsAssigned ? Math.round((Number(stats.jobsCompleted ?? 0) / Number(stats.jobsAssigned)) * 100) : 0,

      joined: user.createdAt
        ? new Date(user.createdAt).toISOString().slice(0, 10)
        : '',

      address: [(profile as any).address?.line1, (profile as any).address?.state, (profile as any).address?.pincode]
        .filter(Boolean)
        .join(', '),

      profile: {
        experience: Number((profile as any).experience ?? 0),
        bio: String((profile as any).bio ?? ''),
      },

      categories: categoryNames,

      kyc: {
        status: kycLabel(profile.kyc?.status),
        reviewedAt: (profile.kyc as any)?.reviewedAt
          ? new Date((profile.kyc as any).reviewedAt).toISOString()
          : undefined,
        submittedAt: (profile.kyc as any)?.submittedAt
          ? new Date(
              (profile.kyc as any).submittedAt,
            ).toISOString()
          : '',
        checklist: kycChecklist,
        documents: kycDocuments,
      },

      training,

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
function toDto(user: InstanceType<typeof UserModel>, kycStatus?: string) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    gender: user.gender,
    designation: user.designation,
    status: user.status,
    kycStatus,
    createdAt: user.createdAt,
  };
}

/**
 * Export service.
 */
export const partnersService = new PartnersService();