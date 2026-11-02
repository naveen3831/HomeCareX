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
     * An admin created this account and emails the credentials themselves, so it counts as vetted:
     * mark KYC approved, otherwise the new login gate would lock the partner out.
     */
    await PartnerModel.findOneAndUpdate(
      { userId: partner._id },
      {
        $set: {
          'kyc.status': 'approved',
          'kyc.reviewedAt': new Date(),
          'kyc.reviewedBy': new Types.ObjectId(actor.id),
        },
      },
    );

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
    const kycByUser = new Map<string, string>();
    for (const partner of partners) {
      const profile = await ensurePartnerProfile(partner._id);
      kycByUser.set(String(partner._id), String(profile.kyc?.status ?? 'not_started'));
    }

    return partners.map((p) => toDto(p, kycByUser.get(String(p._id))));
  }

  /**
   * PARTNERS & KYC DIRECTORY
   * One row per partner with KYC state and performance, read from the Partner profile (real data).
   * Rates come from the counters kept by matching / booking services.
   */
  async directory() {
    const partners = await PartnerModel.find({}).sort({ createdAt: -1 }).limit(500).lean();
    const userIds = partners.map((p) => p.userId);

    const [users, lastCities, categories, serviceAreas] = await Promise.all([
      UserModel.find({ _id: { $in: userIds }, role: 'partner' }).select('name email phone status designation').lean(),
      // A partner has no address of their own: use the city of their most recent booking.
      BookingModel.aggregate<{ _id: unknown; city?: string }>([
        { $match: { partnerId: { $in: partners.map((p) => p._id) }, 'address.city': { $exists: true, $ne: '' } } },
        { $sort: { createdAt: -1 } },
        { $group: { _id: '$partnerId', city: { $first: '$address.city' } } },
      ]),
      CategoryModel.find({}).select('name').lean(),
      ServiceAreaModel.find({ partnerId: { $in: partners.map((p) => p._id) } }).select('partnerId cities').lean(),
    ]);

    const areaCityByPartner = new Map(serviceAreas.map((a) => [String(a.partnerId), a.cities?.[0] ?? '']));
    const userById = new Map(users.map((u) => [String(u._id), u]));
    const cityByPartner = new Map(lastCities.map((r) => [String(r._id), r.city ?? '']));
    const categoryName = new Map(categories.map((c) => [String(c._id), c.name as string]));
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);

    return partners.flatMap((p) => {
      const user = userById.get(String(p.userId));
      if (!user) return [];
      const stats = p.stats ?? { offersReceived: 0, offersAccepted: 0, jobsAssigned: 0, jobsCompleted: 0 };
      return [
        {
          id: String(user._id), // same id the other /admin/partners endpoints use (the login user id)
          partnerId: String(p._id),
          name: user.name,
          email: user.email,
          phone: user.phone ?? '',
          kycStatus: p.kyc?.status ?? 'not_started',
          accountStatus: user.status === 'blocked' ? 'blocked' : user.status === 'invited' ? 'invited' : 'active',
          category: (p.categories ?? []).map((c) => categoryName.get(String(c))).filter(Boolean).join(', ') || user.designation || '',
          city: resolveCity(p.address?.city, areaCityByPartner.get(String(p._id)), cityByPartner.get(String(p._id))),
          rating: Math.round((p.ratingAvg ?? 0) * 10) / 10,
          ratingCount: p.ratingCount ?? 0,
          acceptance: pct(stats.offersAccepted, stats.offersReceived),
          completion: pct(stats.jobsCompleted, stats.jobsAssigned),
        },
      ];
    });
  }

  /**
   * PARTNER DETAILS (admin)
   * Everything the Partner details page shows, read from real data. `id` is the partner's login user id,
   * the same id the directory returns. Sections with no source yet (activity, response time) are left empty.
   */
  async detail(id: string) {
    const user = await findPartnerUser(id);
    const profile = await ensurePartnerProfile(user._id);
    if (!profile) throw new HttpError(404, 'Partner not found', 'PARTNER_NOT_FOUND');

    const [categories, bookings, payouts, reviews, tickets, completedCount, cancelledCount] = await Promise.all([
      CategoryModel.find({ _id: { $in: profile.categories ?? [] } }).select('name').lean(),
      BookingModel.find({ partnerId: profile._id }).sort({ createdAt: -1 }).limit(200).lean(),
      PayoutModel.find({ partnerId: profile._id }).sort({ createdAt: -1 }).limit(20).lean(),
      ReviewModel.find({ partnerId: profile._id }).sort({ createdAt: -1 }).limit(20).lean(),
      TicketModel.find({ createdBy: user._id }).sort({ createdAt: -1 }).limit(20).lean(),
      BookingModel.countDocuments({ partnerId: profile._id, status: 'completed' }),
      BookingModel.countDocuments({ partnerId: profile._id, status: { $regex: /^cancelled/ } }),
    ]);

    const day = (d?: Date | string | null) =>
      d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';
    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
    const stats = profile.stats ?? { offersReceived: 0, offersAccepted: 0, jobsAssigned: 0, jobsCompleted: 0 };
    const kyc = profile.kyc ?? ({} as NonNullable<typeof profile.kyc>);
    const kycRaw = String(kyc.status ?? 'not_started');
    const docs = kyc.documents ?? [];
    const serviceArea = await ServiceAreaModel.findOne({ partnerId: profile._id }).select('cities').lean();
    const city = resolveCity(
      profile.address?.city,
      serviceArea?.cities?.[0],
      bookings.find((b) => b.address?.city)?.address?.city,
    );
    const address = [profile.address?.line1, profile.address?.city, profile.address?.state, profile.address?.pincode]
      .filter(Boolean)
      .join(', ');
    const categoryNames = categories.map((c) => String(c.name));

    // Earnings per month from completed bookings.
    const byMonth = new Map<string, { bookings: number; earnings: number }>();
    for (const b of bookings) {
      if (b.status !== 'completed') continue;
      const key = new Date(b.scheduledAt ?? b.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
      const row = byMonth.get(key) ?? { bookings: 0, earnings: 0 };
      row.bookings += 1;
      row.earnings += Number(b.partnerEarning ?? 0);
      byMonth.set(key, row);
    }

    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone ?? '',
      kycStatus: kycRaw === 'approved' ? 'Approved' : kycRaw === 'rejected' ? 'Rejected' : 'Pending',
      accountStatus: user.status === 'blocked' ? 'Suspended' : user.status === 'invited' ? 'Inactive' : 'Active',
      category: categoryNames[0] ?? user.designation ?? '',
      categories: categoryNames.length ? categoryNames : user.designation ? [user.designation] : [],
      city,
      address: address || city,
      rating: Math.round((profile.ratingAvg ?? 0) * 10) / 10,
      acceptance: pct(stats.offersAccepted, stats.offersReceived),
      completion: pct(stats.jobsCompleted, stats.jobsAssigned),
      joined: day(user.createdAt),
      profile: { experience: 0, bio: (profile.skills ?? []).join(', ') },
      kyc: {
        submittedAt: day(kyc.submittedAt),
        reviewedAt: kyc.reviewedAt ? day(kyc.reviewedAt) : undefined,
        documents: docs.map((d) => {
          const stored = Boolean(d.storageKey);
          const isPdf = d.mimeType ? d.mimeType === 'application/pdf' : /\.pdf(\?|$)/i.test(String(d.url ?? ''));
          return {
            id: String(d._id),
            name: d.label || String(d.type).replace(/_/g, ' '),
            type: isPdf ? 'pdf' : 'image',
            // Stored files are streamed by the admin-only endpoint; the UI fetches it with its auth token.
            url: stored ? `/admin/partners/${user._id}/kyc/documents/${d._id}` : String(d.url ?? ''),
            secure: stored,
            status: d.status === 'verified' ? 'Verified' : d.status === 'rejected' ? 'Rejected' : 'Pending',
          };
        }),
        checklist: [
          { id: 'docs', label: 'KYC documents uploaded', completed: docs.length > 0, required: true },
          { id: 'verified', label: 'Documents verified', completed: docs.length > 0 && docs.every((d) => d.status === 'verified'), required: true },
          { id: 'training', label: 'Training completed', completed: Boolean(profile.trainingCompleted), required: false },
        ],
      },
      performance: {
        completedBookings: completedCount,
        cancelledBookings: cancelledCount,
        averageResponseTime: '—',
        customerSatisfaction: Math.round(((profile.ratingAvg ?? 0) / 5) * 100),
      },
      bookings: bookings.slice(0, 20).map((b) => ({
        id: String(b._id),
        customer: b.customerName ?? 'Customer',
        service: b.serviceName,
        date: day(b.scheduledAt ?? b.createdAt),
        status: String(b.status),
        amount: Number(b.priceBreakdown?.total ?? 0),
      })),
      earnings: [...byMonth.entries()].map(([month, v]) => ({ month, bookings: v.bookings, earnings: v.earnings })),
      payouts: payouts.map((x) => ({
        id: String(x._id),
        date: day(x.paidAt ?? x.createdAt),
        amount: Number(x.amount ?? 0),
        status: String(x.status),
      })),
      reviews: reviews.map((r) => ({
        id: String(r._id),
        customer: r.customerName,
        rating: r.rating,
        comment: r.message ?? '',
        date: day(r.createdAt),
      })),
      support: tickets.map((t) => ({
        ticketId: `TCK-${String(t._id).slice(-6).toUpperCase()}`,
        subject: t.subject,
        status: String(t.status),
        createdAt: day(t.createdAt),
      })),
      activity: [],
    };
  }

  /**
   * KYC DECISION (admin): approve or reject the partner's submitted KYC.
   * Approve: documents become verified, the partner gets an email with a set-password link and
   * stays unable to log in until they use it. Reject: login stays blocked and the reason is shown at login.
   */
  async reviewKyc(
    id: string,
    input: { decision: 'approve' | 'reject'; reason?: string },
    actor: AuditActor,
  ) {
    const user = await findPartnerUser(id);
    const profile = await ensurePartnerProfile(user._id);
    if (!profile) throw new HttpError(404, 'Partner not found', 'PARTNER_NOT_FOUND');

    const reason = input.reason?.trim();
    if (input.decision === 'reject' && !reason) {
      throw new HttpError(400, 'Rejection reason is required.', 'VALIDATION_ERROR');
    }

    const docs = profile.kyc?.documents ?? [];
    const before = { kycStatus: profile.kyc?.status };

    if (input.decision === 'approve') {
      if (docs.length === 0) {
        throw new HttpError(400, 'This partner has not uploaded any KYC documents yet.', 'KYC_DOCUMENTS_MISSING');
      }
      if (profile.kyc?.status === 'approved') {
        return { ...(await this.detail(id)), emailSent: false };
      }

      await PartnerModel.updateOne(
        { _id: profile._id },
        {
          $set: {
            'kyc.status': 'approved',
            'kyc.reviewedAt': new Date(),
            'kyc.reviewedBy': new Types.ObjectId(actor.id),
          },
          $unset: { 'kyc.rejectionReason': '' },
        },
      );
      await PartnerModel.updateOne(
        { _id: profile._id },
        { $set: { 'kyc.documents.$[d].status': 'verified' } },
        { arrayFilters: [{ 'd.status': { $ne: 'verified' } }] },
      );

      // Single-use set-password token (only its SHA-256 hash is stored). Login is blocked until it is used.
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.passwordResetTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      user.passwordResetExpiresAt = new Date(Date.now() + APPROVAL_LINK_HOURS * 3_600_000);
      user.passwordSetupRequired = true;
      user.tokenVersion = (user.tokenVersion ?? 0) + 1; // drop any session opened before approval
      await user.save();

      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
      const setPasswordUrl = `${frontendUrl}/reset-password?token=${rawToken}`;
      let emailSent = true;
      try {
        await mailService.sendPartnerApprovedEmail({
          name: user.name,
          email: user.email,
          setPasswordUrl,
          validHours: APPROVAL_LINK_HOURS,
        });
      } catch (err) {
        emailSent = false;
        console.error('[partners] approval email failed', err);
      }
      if (!emailSent && process.env.NODE_ENV !== 'production') {
        console.info(`[DEV ONLY] Partner set-password link for ${user.email}: ${setPasswordUrl}`);
      }

      await recordPartnerAudit({
        actor,
        action: 'partner.kyc.approved',
        entityId: String(user._id),
        before,
        after: { kycStatus: 'approved', emailSent },
      });

      return { ...(await this.detail(id)), emailSent };
    }

    // reject
    await PartnerModel.updateOne(
      { _id: profile._id },
      {
        $set: {
          'kyc.status': 'rejected',
          'kyc.reviewedAt': new Date(),
          'kyc.reviewedBy': new Types.ObjectId(actor.id),
          'kyc.rejectionReason': reason,
        },
      },
    );
    await PartnerModel.updateOne(
      { _id: profile._id },
      { $set: { 'kyc.documents.$[d].status': 'rejected' } },
      { arrayFilters: [{ 'd.status': 'pending' }] },
    );
    user.passwordSetupRequired = false;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    await recordPartnerAudit({
      actor,
      action: 'partner.kyc.rejected',
      entityId: String(user._id),
      before,
      after: { kycStatus: 'rejected', reason },
    });

    return { ...(await this.detail(id)), emailSent: false };
  }

  /**
   * One stored KYC document for the admin viewer. Looked up through the partner's own profile,
   * so a document id from another partner never resolves.
   */
  async kycDocument(userId: string, docId: string) {
    const user = await findPartnerUser(userId);
    const profile = await PartnerModel.findOne({ userId: user._id }).select('kyc.documents').lean();
    const doc = (profile?.kyc?.documents ?? []).find((d) => String(d._id) === docId);
    if (!doc?.storageKey) throw new HttpError(404, 'Document not found', 'NOT_FOUND');

    return {
      buffer: await readKycDocument(doc.storageKey),
      mimeType: doc.mimeType || 'application/octet-stream',
      name: doc.label || String(doc.type),
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
  kycStatus?: string,
) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    gender: u.gender,
    designation: u.designation,
    status: u.status,
    /** From the Partner profile: the list shows this, since User.status alone is "active" for everyone not blocked. */
    kycStatus: kycStatus ?? 'not_started',
    createdAt: u.createdAt,
  };
}

/**
 * ---------------------------------------------------------
 * EXPORT SERVICE
 * ---------------------------------------------------------
 */
export const partnersService = new PartnersService();