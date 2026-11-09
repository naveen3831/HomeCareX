import { Types } from 'mongoose';
import type { Request, Response } from 'express';

import { BookingModel } from '../../models/Booking';
import { PartnerModel } from '../../models/Partner';
import { PaymentModel } from '../../models/Payment';
import { UserModel } from '../../models/User';
import { ServiceModel } from '../../models/Service';
import { ServiceAreaModel } from '../../models/ServiceArea';
import { CategoryModel } from '../../models/Category';

import Availability from '../availability/availability.model';
import { isAvailable } from '../availability/availability.service';

import { getAuthUser } from '../../middleware/auth.middleware';
import { HttpError } from '../auth/auth.types';

import {
  BOOKING_STATUSES,
  type BookingStatus,
} from '../bookings/bookings.constants';

import { applyTransition } from '../bookings/bookings.stateMachine';
import { getRazorpay } from '../../integrations/razorpay';
import { auditService } from '../audit/audit.service';
import { notify, alertCustomerPartnerAssigned } from '../notifications';
import { ONBOARDING_TOTAL_STEPS } from '../partner-onboarding/partner-onboarding.service';

type AdminPaymentStatus = 'Pending' | 'Paid' | 'Failed' | 'Refunded';
type TimelineActorType = 'Admin' | 'Customer' | 'Partner' | 'System';

interface RefundResult {
  eligible: boolean;
  amount: number;
  currency: string;
  status: 'none' | 'processed' | 'already_refunded';
  paymentId?: string;
}

interface AdminBookingSource {
  _id: { toString(): string };

  customerId?: { toString(): string };
  customerName?: string;
  categoryId?: { toString(): string };
  serviceId?: { toString(): string };
  serviceName?: string;
  partnerId?: { toString(): string } | null;
  address?: {
    line1?: string;
    line2?: string;
    area?: string;
    city?: string;
    state?: string;
    pincode?: string;
    location?: {
      type?: string;
      coordinates?: number[];
    };
  };
  addressSnapshot?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  scheduledAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  priceBreakdown?: {
    base?: number;
    addOns?: number;
    discount?: number;
    convenienceFee?: number;
    tax?: number;
    total?: number;
  };
  status: BookingStatus;
  statusHistory?: Array<{
    from?: BookingStatus;
    to: BookingStatus;
    at?: Date | string;
    actorId?: string;
    actorRole?: string;
    reason?: string;
  }>;
  date?: string;
  slot?: string;
}

interface PaymentLike {
  status?: string;
  amount?: number;
  currency?: string;
  method?: string;
  paidAt?: Date | string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  refund?: {
    status?: string;
    amount?: number;
    requestedAt?: Date | string;
  };
}

interface PartnerSource {
  _id: { toString(): string };
  userId: { toString(): string };
  categories?: Array<{ toString(): string }>;
  services?: Array<{ toString(): string }>;
  ratingAvg?: number;
  ratingCount?: number;
  trainingCompleted?: boolean;
  onboarding?: { completedSteps?: number; approvedAt?: Date | null } | null;
  serviceRadiusKm?: number;
  kyc?: { status?: string };
}


// Training counts as done when the legacy flag is set OR the admin approved the finished demo
// (the approve flow only writes onboarding.approvedAt, never trainingCompleted).
function isTrainingDone(partner: PartnerSource): boolean {
  return (
    partner.trainingCompleted === true ||
    ((partner.onboarding?.completedSteps ?? 0) >= ONBOARDING_TOTAL_STEPS &&
      !!partner.onboarding?.approvedAt)
  );
}

interface UserSource {
  _id: { toString(): string };
  name?: string;
  email?: string;
  phone?: string;
  status?: string;
}

interface BookingLookups {
  partnersById: Map<string, PartnerSource>;
  partnersByUserId: Map<string, PartnerSource>;
  users: Map<string, UserSource>;
}

interface Coordinates {
  lat: number;
  lng: number;
}

interface ServiceAreaSource {
  partnerId: { toString(): string };
  baseLocation?: Coordinates;
  radiusKm?: number;
  cities?: string[];
  areas?: string[];
}

const INACTIVE_BOOKING_STATUSES = [
  'cancelled_by_customer',
  'cancelled_by_partner',
  'cancelled_by_admin',
  'completed',
  'no_show',
];

export class AdminBookingsController {
  private assertAdmin(req: Request) {
    const user = getAuthUser(req);

    if (user.role !== 'admin') {
      throw new HttpError(
        403,
        'You do not have access to this resource',
        'FORBIDDEN',
      );
    }

    return user;
  }

  private async recordBookingAudit(
    action: string,
    bookingId: string,
    actorId: string,
    ip: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Promise<void> {
    try {
      await auditService.recordAudit({
        actor: actorId,
        action,
        entity: 'Booking',
        entityId: bookingId,
        ip,
        result: 'Success',
        before,
        after,
      });
    } catch (error) {
      console.error('[Audit] Failed to record booking action:', error);
    }
  }

  private normalizeAvailabilityTime(value: string): string {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);

    if (!match) return trimmed;

    let hour = Number(match[1]);
    const minute = match[2];
    const period = match[3].toUpperCase();

    if (period === 'AM') {
      if (hour === 12) hour = 0;
    } else if (hour !== 12) {
      hour += 12;
    }

    return `${hour.toString().padStart(2, '0')}:${minute}`;
  }

  private getSlotTimes(slot?: string): { start: string; end: string } {
    if (!slot || typeof slot !== 'string') {
      return { start: '', end: '' };
    }

    const parts = slot.split(/\s*-\s*/).map((part) => part.trim());

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return { start: '', end: '' };
    }

    const start = this.normalizeAvailabilityTime(parts[0]);
    const end = this.normalizeAvailabilityTime(parts[1]);

    const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

    if (!timeRegex.test(start) || !timeRegex.test(end)) {
      return { start: '', end: '' };
    }

    return { start, end };
  }

  private mapPaymentStatus(status?: string): AdminPaymentStatus {
    switch ((status ?? '').toUpperCase()) {
      case 'PAID': return 'Paid';
      case 'FAILED': return 'Failed';
      case 'REFUNDED': return 'Refunded';
      case 'PENDING':
      default: return 'Pending';
    }
  }

  private mapTimelineActorType(actorRole?: string): TimelineActorType {
    switch ((actorRole ?? '').toLowerCase()) {
      case 'admin': return 'Admin';
      case 'customer': return 'Customer';
      case 'partner': return 'Partner';
      case 'system':
      default: return 'System';
    }
  }

  private toISOString(value?: Date | string): string {
    if (!value) return '';

    const date = value instanceof Date ? value : new Date(value);

    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
  }

  private async getPaymentForBooking(
    bookingId: string,
  ): Promise<PaymentLike | null> {
    const payment = await PaymentModel.findOne({ bookingId })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return payment ? payment as unknown as PaymentLike : null;
  }

  private async getPaymentsForBookings(
    bookingIds: string[],
  ): Promise<Map<string, PaymentLike>> {
    const result = new Map<string, PaymentLike>();

    if (!bookingIds.length) return result;

    const payments = await PaymentModel.find({
      bookingId: { $in: bookingIds },
    })
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    for (const payment of payments) {
      const key = String(
        (payment as { bookingId?: unknown }).bookingId,
      );

      if (!result.has(key)) {
        result.set(key, payment as unknown as PaymentLike);
      }
    }

    return result;
  }

  private async prefetchLookups(
    bookings: AdminBookingSource[],
  ): Promise<BookingLookups> {
    const unique = (values: Array<string | undefined>): string[] => {
      return [
        ...new Set(
          values.filter((value): value is string => {
            if (typeof value !== 'string' || value.trim() === '') {
              return false;
            }

            return Types.ObjectId.isValid(value);
          }),
        ),
      ];
    };

    const partnerIds = unique(
      bookings.map((booking) => booking.partnerId?.toString()),
    );

    const customerIds = unique(
      bookings.map((booking) => booking.customerId?.toString()),
    );

    const partnersById = new Map<string, PartnerSource>();
    const partnersByUserId = new Map<string, PartnerSource>();
    const users = new Map<string, UserSource>();

    let partnerProfiles: PartnerSource[] = [];

    if (partnerIds.length) {
      const [byId, byUser] = await Promise.all([
        PartnerModel.find({ _id: { $in: partnerIds } }).lean().exec(),
        PartnerModel.find({ userId: { $in: partnerIds } }).lean().exec(),
      ]);

      for (const profile of byId as unknown as PartnerSource[]) {
        partnersById.set(profile._id.toString(), profile);
      }

      for (const profile of byUser as unknown as PartnerSource[]) {
        partnersByUserId.set(profile.userId.toString(), profile);
      }

      partnerProfiles = [
        ...byId,
        ...byUser,
      ] as unknown as PartnerSource[];
    }

    const userIds = unique([
      ...customerIds,
      ...partnerProfiles.map((profile) => profile.userId.toString()),
    ]);

    if (userIds.length) {
      const found = await UserModel.find({ _id: { $in: userIds } })
        .lean()
        .exec();

      for (const user of found as unknown as UserSource[]) {
        users.set(user._id.toString(), user);
      }
    }

    return { partnersById, partnersByUserId, users };
  }

  private async buildBookingResponse(
    booking: AdminBookingSource,
    payment: PaymentLike | null,
    prefetched?: BookingLookups,
  ) {
    const bookingId = booking._id.toString();
    const lookups = prefetched ?? await this.prefetchLookups([booking]);

    const customerUser =
      lookups.users.get(booking.customerId?.toString() ?? '') ?? null;

    const scheduledAt = this.toISOString(booking.scheduledAt);
    const createdAt = this.toISOString(booking.createdAt);
    const updatedAt = this.toISOString(booking.updatedAt ?? booking.createdAt);

    const address = booking.address;

    const customerName =
      booking.customerName?.trim() ||
      customerUser?.name?.trim() ||
      '';

    const databaseTotal = booking.priceBreakdown?.total ?? 0;
    const paymentAmount = payment?.amount ?? 0;
    const finalAmount = databaseTotal > 0 ? databaseTotal : paymentAmount;

    let partner: {
      id: string;
      name: string;
      email: string;
      phone: string;
      category: string;
    } | null = null;

    if (booking.partnerId) {
      const partnerId = booking.partnerId.toString();
      const profile =
        lookups.partnersById.get(partnerId) ??
        lookups.partnersByUserId.get(partnerId) ??
        null;

      if (profile) {
        const partnerUser =
          lookups.users.get(profile.userId.toString()) ?? null;

        partner = {
          id: partnerId,
          name: partnerUser?.name ?? 'Assigned Partner',
          email: partnerUser?.email ?? '',
          phone: partnerUser?.phone ?? '',
          category: 'Home Services',
        };
      } else {
        partner = {
          id: partnerId,
          name: 'Assigned Partner',
          email: '',
          phone: '',
          category: 'Home Services',
        };
      }
    }

    const timeline = (booking.statusHistory ?? []).map((item, index) => ({
      id: `${bookingId}-${index}`,
      timestamp: this.toISOString(item.at),
      actor: item.actorId ?? item.actorRole ?? 'System',
      actorType: this.mapTimelineActorType(item.actorRole),
      status: item.to,
      note: item.reason ?? '',
      location: address?.city
        ? `${address.city}${address.area ? `, ${address.area}` : ''}`
        : undefined,
    }));

    return {
      id: bookingId,
      customer: {
        id: booking.customerId?.toString() ?? '',
        name: customerName,
        phone: customerUser?.phone ?? '',
        email: customerUser?.email ?? '',
      },
      service: {
        id: booking.categoryId?.toString() ?? '',
        name: booking.serviceName ?? '',
        category: 'Home Services',
        durationMinutes: 60,
      },
      partner,
      city: address?.city ?? '',
      address: {
        line1: address?.line1 ?? '',
        line2: address?.line2 ?? '',
        area: address?.area ?? '',
        city: address?.city ?? '',
        state: address?.state ?? '',
        pincode: address?.pincode ?? '',
      },
      slot: {
        date: booking.date ?? scheduledAt,
        startTime: booking.slot ?? scheduledAt,
        endTime: scheduledAt,
      },
      pricing: {
        baseAmount: booking.priceBreakdown?.base ?? finalAmount,
        addOnAmount: booking.priceBreakdown?.addOns ?? 0,
        discountAmount: booking.priceBreakdown?.discount ?? 0,
        convenienceFee: booking.priceBreakdown?.convenienceFee ?? 0,
        taxAmount: booking.priceBreakdown?.tax ?? 0,
        totalAmount: finalAmount,
      },
      status: booking.status,
      payment: {
        paymentId: payment?.razorpayPaymentId ?? payment?.razorpayOrderId ?? '',
        method: payment?.method ?? '',
        status: this.mapPaymentStatus(payment?.status),
        amount: paymentAmount > 0 ? paymentAmount : finalAmount,
        paidAt: payment?.paidAt
          ? this.toISOString(payment.paidAt)
          : undefined,
      },
      createdAt,
      updatedAt,
      timeline,
    };
  }

  /**
   * Get booking coordinates.
   * GeoJSON coordinates are stored as [longitude, latitude].
   */
  private getBookingCoordinates(
    booking: AdminBookingSource,
  ): Coordinates | null {
    const coordinates = booking.address?.location?.coordinates;

    if (
      Array.isArray(coordinates) &&
      coordinates.length >= 2 &&
      Number.isFinite(coordinates[0]) &&
      Number.isFinite(coordinates[1])
    ) {
      return {
        lng: Number(coordinates[0]),
        lat: Number(coordinates[1]),
      };
    }

    const snapshot = booking.addressSnapshot?.location;

    if (
      snapshot &&
      Number.isFinite(snapshot.lat) &&
      Number.isFinite(snapshot.lng)
    ) {
      return {
        lat: Number(snapshot.lat),
        lng: Number(snapshot.lng),
      };
    }

    return null;
  }

  private calculateDistanceKm(
    origin: Coordinates,
    destination: Coordinates,
  ): number {
    const earthRadiusKm = 6371;
    const toRadians = (degrees: number) => degrees * Math.PI / 180;

    const lat1 = toRadians(origin.lat);
    const lat2 = toRadians(destination.lat);
    const deltaLat = toRadians(destination.lat - origin.lat);
    const deltaLng = toRadians(destination.lng - origin.lng);

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLng / 2) ** 2;

    return earthRadiusKm * 2 *
      Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private async resolveBookingCategory(
    booking: AdminBookingSource,
  ): Promise<string> {
    let categoryId = booking.categoryId?.toString() ?? '';

    if (!categoryId && booking.serviceId) {
      const service = await ServiceModel.findById(
        booking.serviceId,
        'categoryId',
      ).lean().exec();

      if (service?.categoryId) {
        categoryId = service.categoryId.toString();

        await BookingModel.updateOne(
          { _id: booking._id },
          { $set: { categoryId: service.categoryId } },
        ).exec();
      }
    }

    return categoryId;
  }

  private async partnerMatchesBooking(
    partner: PartnerSource,
    booking: AdminBookingSource,
    bookingCategoryId: string,
  ): Promise<boolean> {
    if (!bookingCategoryId) return false;

    const matchesCategory = (partner.categories ?? []).some(
      (id) => id.toString() === bookingCategoryId,
    );

    const matchesService = Boolean(
      booking.serviceId &&
      (partner.services ?? []).some(
        (id) => id.toString() === booking.serviceId?.toString(),
      ),
    );

    return matchesCategory || matchesService;
  }

  private async hasBookingConflict(
    booking: AdminBookingSource,
    partnerId: string,
  ): Promise<boolean> {
    if (!booking.scheduledAt) return true;

    const bookingStart = new Date(booking.scheduledAt);

    if (Number.isNaN(bookingStart.getTime())) return true;

    const bookingEnd = new Date(
      bookingStart.getTime() + 60 * 60 * 1000,
    );

    const conflict = await BookingModel.findOne({
      _id: { $ne: booking._id },
      partnerId: new Types.ObjectId(partnerId),
      scheduledAt: {
        $gte: new Date(bookingStart.getTime() - 60 * 60 * 1000),
        $lte: bookingEnd,
      },
      status: { $nin: INACTIVE_BOOKING_STATUSES },
    })
      .select({ _id: 1 })
      .lean()
      .exec();

    return Boolean(conflict);
  }

  async getBookings(req: Request, res: Response): Promise<void> {
    this.assertAdmin(req);

    const {
      search,
      status,
      city,
      category,
      customer,
      partner,
      date,
    } = req.query as Record<string, string | undefined>;

    const query: Record<string, unknown> = {};

    if (status) query.status = status;

    if (city?.trim()) {
      query['address.city'] = {
        $regex: city.trim(),
        $options: 'i',
      };
    }

    if (category) query.categoryId = category;

    if (customer?.trim()) {
      query.customerName = {
        $regex: customer.trim(),
        $options: 'i',
      };
    }

    if (partner) query.partnerId = partner;
if (category && Types.ObjectId.isValid(category)) query.categoryId = new Types.ObjectId(category);
if (partner && Types.ObjectId.isValid(partner)) query.partnerId = new Types.ObjectId(partner);
    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);

      if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
        query.scheduledAt = { $gte: start, $lte: end };
      }
    }

    if (search?.trim()) {
      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        '\\$&',
      );

      query.$or = [
        { customerName: { $regex: escapedSearch, $options: 'i' } },
        { serviceName: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const bookings = await BookingModel.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean()
      .exec();

    const typedBookings =
      bookings as unknown as AdminBookingSource[];

    const [lookups, payments] = await Promise.all([
      this.prefetchLookups(typedBookings),
      this.getPaymentsForBookings(
        typedBookings.map((booking) => booking._id.toString()),
      ),
    ]);

    const data = await Promise.all(
      typedBookings.map((booking) =>
        this.buildBookingResponse(
          booking,
          payments.get(booking._id.toString()) ?? null,
          lookups,
        ),
      ),
    );

    res.status(200).json({ success: true, data });
  }

  async getBookingById(req: Request, res: Response): Promise<void> {
    this.assertAdmin(req);

    const { bookingId } = req.params;

    const booking = await BookingModel.findById(bookingId)
      .lean()
      .exec();

    if (!booking) {
      throw new HttpError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    const payment = await this.getPaymentForBooking(bookingId);

    const data = await this.buildBookingResponse(
      booking as unknown as AdminBookingSource,
      payment,
    );

    res.status(200).json({ success: true, data });
  }

  /**
   * GET /api/v1/admin/bookings/:bookingId/eligible-partners
   *
   * Returns all partners with their eligibility information.
   * Only eligible partners can be assigned through assignPartner().
   */
  async getEligiblePartners(req: Request, res: Response): Promise<void> {
    this.assertAdmin(req);

    const { bookingId } = req.params;

    const bookingDocument = await BookingModel.findById(bookingId)
      .lean()
      .exec();

    if (!bookingDocument) {
      throw new HttpError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    const booking =
      bookingDocument as unknown as AdminBookingSource;

    const bookingCategoryId =
      await this.resolveBookingCategory(booking);

    if (!bookingCategoryId) {
      throw new HttpError(
        400,
        'Booking category could not be determined',
        'BOOKING_CATEGORY_MISSING',
      );
    }

    const bookingCoordinates =
      this.getBookingCoordinates(booking);

    if (!bookingCoordinates) {
      throw new HttpError(
        400,
        'Booking location is missing or invalid',
        'BOOKING_LOCATION_MISSING',
      );
    }

    if (!booking.scheduledAt) {
      throw new HttpError(
        400,
        'Booking scheduled date is missing',
        'BOOKING_SCHEDULE_MISSING',
      );
    }

    const slotTimes = this.getSlotTimes(booking.slot);

    const bookingDate =
      booking.date ??
      this.toISOString(booking.scheduledAt).slice(0, 10);

    if (!slotTimes.start || !slotTimes.end || !bookingDate) {
      throw new HttpError(
        400,
        'Booking date or time slot is invalid',
        'BOOKING_SLOT_INVALID',
      );
    }

    // Fetch all real partner profiles, including profiles that
    // are offline, pending KYC, or not yet trained.
    const rawPartners = await PartnerModel.find({})
      .lean()
      .exec();

    const partners =
      rawPartners as unknown as PartnerSource[];

    if (!partners.length) {
      res.status(200).json({
        success: true,
        totalPartners: 0,
        totalEligible: 0,
        onlineCount: 0,
        availableCount: 0,
        data: [],
      });
      return;
    }

    const partnerIds = partners.map(
      (partner) => partner._id,
    );

    const userIds = partners.map(
      (partner) => partner.userId,
    );

    // Resolve category names for display.
    const categoryIds = [
      ...new Set(
        partners.flatMap((partner) =>
          (partner.categories ?? []).map((id) => id.toString()),
        ),
      ),
    ];

    const [users, availabilityRecords, serviceAreas, categories] =
      await Promise.all([
        UserModel.find({
          _id: { $in: userIds },
        })
          .lean()
          .exec(),

        // Availability is saved against the partner's User id
        // (JWT sub), not Partner._id.
        Availability.find({
          partnerId: { $in: userIds },
        })
          .lean()
          .exec(),

        ServiceAreaModel.find({
          partnerId: { $in: partnerIds },
        })
          .lean()
          .exec(),

        categoryIds.length
          ? CategoryModel.find({
              _id: { $in: categoryIds },
            })
              .select('_id name')
              .lean()
              .exec()
          : Promise.resolve([]),
      ]);

    const usersById = new Map(
      (users as unknown as UserSource[]).map((user) => [
        user._id.toString(),
        user,
      ]),
    );

    const availabilityByPartner = new Map(
      availabilityRecords.map((record) => [
        record.partnerId.toString(),
        record,
      ]),
    );

    const areasByPartner = new Map(
      (serviceAreas as unknown as ServiceAreaSource[]).map((area) => [
        area.partnerId.toString(),
        area,
      ]),
    );

    const categoryNamesById = new Map(
      categories.map((category) => [
        category._id.toString(),
        category.name,
      ]),
    );

    const data: Array<Record<string, unknown>> = [];

    let onlineCount = 0;
    let availableCount = 0;
    let totalEligible = 0;

    for (const partner of partners) {
      const partnerId = partner._id.toString();

      const partnerUser = usersById.get(
        partner.userId.toString(),
      );

      // A profile without its linked user cannot be presented
      // as a usable partner account.
      if (!partnerUser) continue;

      const availability =
        availabilityByPartner.get(partner.userId.toString());

      const serviceArea =
        areasByPartner.get(partnerId);

      const isOnline =
        availability?.isOnline === true;

      if (isOnline) {
        onlineCount++;
      }

      const kycStatus =
        partner.kyc?.status ?? 'not_submitted';

      const isKycApproved =
        kycStatus.toLowerCase() === 'approved';

      const trainingCompleted =
        isTrainingDone(partner);

      const accountStatus =
        partnerUser.status ?? 'unknown';

      const isAccountActive =
        accountStatus.toLowerCase() === 'active';

      const categoryMatches =
        await this.partnerMatchesBooking(
          partner,
          booking,
          bookingCategoryId,
        );

      const hasServiceArea =
        Boolean(serviceArea?.baseLocation);

      let distanceKm: number | null = null;

      if (hasServiceArea && serviceArea?.baseLocation) {
        const distance = this.calculateDistanceKm(
          bookingCoordinates,
          serviceArea.baseLocation,
        );

        if (Number.isFinite(distance)) {
          distanceKm = Number(distance.toFixed(2));
        }
      }

      const radiusKm =
        serviceArea?.radiusKm ??
        partner.serviceRadiusKm ??
        0;

      const withinServiceRadius =
        distanceKm !== null &&
        radiusKm > 0 &&
        distanceKm <= radiusKm;

      let slotAvailable = false;

      if (availability) {
        try {
          slotAvailable = await isAvailable(
            partner.userId.toString(),
            {
              date: bookingDate,
              start: slotTimes.start,
              end: slotTimes.end,
            },
          );
        } catch (error) {
          console.error(
            `[AdminBookings] Availability check failed for ${partnerId}:`,
            error,
          );

          slotAvailable = false;
        }
      }

      if (slotAvailable) {
        availableCount++;
      }

      let hasConflict = false;

      try {
        hasConflict = await this.hasBookingConflict(
          booking,
          partnerId,
        );
      } catch (error) {
        console.error(
          `[AdminBookings] Conflict check failed for ${partnerId}:`,
          error,
        );

        // Fail closed: do not mark a partner eligible if the
        // conflict check could not be completed.
        hasConflict = true;
      }

      const eligibilityReasons: string[] = [];

      if (!isKycApproved) {
        eligibilityReasons.push(
          `KYC is ${kycStatus.replace(/_/g, ' ')}`,
        );
      }

      if (!trainingCompleted) {
        eligibilityReasons.push(
          'Training is not completed',
        );
      }

      if (!isAccountActive) {
        eligibilityReasons.push(
          `Partner account is ${accountStatus}`,
        );
      }

      if (!isOnline) {
        eligibilityReasons.push(
          'Partner is offline',
        );
      }

      if (!categoryMatches) {
        eligibilityReasons.push(
          'Partner does not provide this booking category or service',
        );
      }

      if (!hasServiceArea) {
        eligibilityReasons.push(
          'Partner service area or base location is not configured',
        );
      } else if (distanceKm === null) {
        eligibilityReasons.push(
          'Partner distance could not be calculated',
        );
      } else if (radiusKm <= 0) {
        eligibilityReasons.push(
          'Partner service radius is not configured',
        );
      } else if (!withinServiceRadius) {
        eligibilityReasons.push(
          'Booking is outside the partner service radius',
        );
      }

      if (!slotAvailable) {
        eligibilityReasons.push(
          'Partner is not available during the selected time slot',
        );
      }

      if (hasConflict) {
        eligibilityReasons.push(
          'Partner has a conflicting booking',
        );
      }

      const eligible =
        isKycApproved &&
        trainingCompleted &&
        isAccountActive &&
        isOnline &&
        categoryMatches &&
        hasServiceArea &&
        withinServiceRadius &&
        slotAvailable &&
        !hasConflict;

      if (eligible) {
        totalEligible++;
      }

      const partnerCategoryNames = (
        partner.categories ?? []
      ).map((id) => {
        const categoryId = id.toString();

        return (
          categoryNamesById.get(categoryId) ??
          categoryId
        );
      });

      data.push({
        id: partnerId,

        name: partnerUser.name ?? 'Partner',
        email: partnerUser.email ?? '',
        phone: partnerUser.phone ?? '',

        category: partnerCategoryNames.length
          ? partnerCategoryNames.join(', ')
          : 'Not configured',

        categories: partnerCategoryNames,

        categoryIds:
          partner.categories?.map((id) => id.toString()) ?? [],

        cities: serviceArea?.cities ?? [],
        areas: serviceArea?.areas ?? [],

        kycStatus,
        isApproved: isKycApproved,

        accountStatus,
        trainingCompleted,

        isOnline,
        available: slotAvailable,
        isAvailable: slotAvailable,

        hasConflict,

        distanceKm,
        serviceRadiusKm: radiusKm,

        withinServiceRadius,
        categoryMatches,

        rating: partner.ratingAvg ?? 0,
        ratingCount: partner.ratingCount ?? 0,

        eligible,
        eligibilityReasons,
      });
    }

    // Sort eligible partners first, then online partners.
    // Within each group, nearest partners appear first.
    // Rating is used as the final tie-breaker.
    data.sort((a, b) => {
      if (Boolean(a.eligible) !== Boolean(b.eligible)) {
        return Number(Boolean(b.eligible)) -
          Number(Boolean(a.eligible));
      }

      if (Boolean(a.isOnline) !== Boolean(b.isOnline)) {
        return Number(Boolean(b.isOnline)) -
          Number(Boolean(a.isOnline));
      }

      const distanceA =
        typeof a.distanceKm === 'number'
          ? a.distanceKm
          : Number.POSITIVE_INFINITY;

      const distanceB =
        typeof b.distanceKm === 'number'
          ? b.distanceKm
          : Number.POSITIVE_INFINITY;

      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }

      return Number(b.rating) - Number(a.rating);
    });

    res.status(200).json({
      success: true,
      totalPartners: data.length,
      totalEligible,
      onlineCount,
      availableCount,
      data,
    });
  }

  /**
   * PATCH /api/v1/admin/bookings/:bookingId/assign
   */
  async assignPartner(req: Request, res: Response): Promise<void> {
    const user = this.assertAdmin(req);

    const { bookingId } = req.params;

    const { partnerId, reason } = req.body as {
      partnerId?: string;
      reason?: string;
    };

    if (!partnerId || !Types.ObjectId.isValid(partnerId)) {
      throw new HttpError(
        400,
        'A valid partnerId is required',
        'INVALID_PARTNER_ID',
      );
    }

    if (!reason?.trim()) {
      throw new HttpError(
        400,
        'Assignment reason is required',
        'ASSIGNMENT_REASON_REQUIRED',
      );
    }

    const booking = await BookingModel.findById(bookingId);

    if (!booking) {
      throw new HttpError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    const typedBooking =
      booking as unknown as AdminBookingSource;

    const bookingCategoryId =
      await this.resolveBookingCategory(typedBooking);

    if (!bookingCategoryId) {
      throw new HttpError(
        400,
        'Booking category could not be determined',
        'BOOKING_CATEGORY_MISSING',
      );
    }

    const bookingCoordinates =
      this.getBookingCoordinates(typedBooking);

    if (!bookingCoordinates) {
      throw new HttpError(
        400,
        'Booking location is missing or invalid',
        'BOOKING_LOCATION_MISSING',
      );
    }

    if (!booking.scheduledAt) {
      throw new HttpError(
        400,
        'Booking scheduled date is missing',
        'BOOKING_SCHEDULE_MISSING',
      );
    }

    const slotTimes = this.getSlotTimes(booking.slot);

    const bookingDate =
      booking.date ??
      this.toISOString(booking.scheduledAt).slice(0, 10);

    if (!slotTimes.start || !slotTimes.end || !bookingDate) {
      throw new HttpError(
        400,
        'Booking date or time slot is invalid',
        'BOOKING_SLOT_INVALID',
      );
    }

    // Resolve either the Partner profile ID or the linked User ID.
    let partner = await PartnerModel.findById(partnerId);

    if (!partner) {
      partner = await PartnerModel.findOne({
        userId: partnerId,
      });
    }

    if (!partner) {
      throw new HttpError(
        404,
        'Partner not found',
        'PARTNER_NOT_FOUND',
      );
    }

    if (partner.kyc?.status !== 'approved') {
      throw new HttpError(
        400,
        'Partner KYC is not approved',
        'PARTNER_KYC_NOT_APPROVED',
      );
    }

    if (!isTrainingDone(partner as unknown as PartnerSource)) {
      throw new HttpError(
        400,
        'Partner training is not completed',
        'PARTNER_TRAINING_NOT_COMPLETED',
      );
    }

    const partnerUser = await UserModel.findById(
      partner.userId,
    ).lean().exec();

    if (!partnerUser) {
      throw new HttpError(
        400,
        'Partner user account not found',
        'PARTNER_USER_NOT_FOUND',
      );
    }

    if (partnerUser.status !== 'active') {
      throw new HttpError(
        400,
        'Partner account is not active',
        'PARTNER_NOT_ACTIVE',
      );
    }

    const typedPartner =
      partner as unknown as PartnerSource;

    if (
      !(await this.partnerMatchesBooking(
        typedPartner,
        typedBooking,
        bookingCategoryId,
      ))
    ) {
      throw new HttpError(
        400,
        'Partner is not eligible for this booking category',
        'PARTNER_CATEGORY_MISMATCH',
      );
    }

    const [availability, serviceArea] = await Promise.all([
      Availability.findOne({
        partnerId: partner.userId,
      }).lean().exec(),

      ServiceAreaModel.findOne({
        partnerId: partner._id,
      }).lean().exec(),
    ]);

    if (!availability?.isOnline) {
      throw new HttpError(
        400,
        'Partner is currently offline',
        'PARTNER_OFFLINE',
      );
    }

    if (!serviceArea?.baseLocation) {
      throw new HttpError(
        400,
        'Partner service area is not configured',
        'PARTNER_SERVICE_AREA_MISSING',
      );
    }

    const distanceKm = this.calculateDistanceKm(
      bookingCoordinates,
      serviceArea.baseLocation,
    );

    const radiusKm =
      serviceArea.radiusKm ??
      partner.serviceRadiusKm ??
      0;

    if (radiusKm <= 0 || distanceKm > radiusKm) {
      throw new HttpError(
        400,
        'Booking is outside the partner service radius',
        'PARTNER_OUTSIDE_SERVICE_RADIUS',
      );
    }

    let slotAvailable = false;

    try {
      slotAvailable = await isAvailable(
        partner.userId.toString(),
        {
          date: bookingDate,
          start: slotTimes.start,
          end: slotTimes.end,
        },
      );
    } catch (error) {
      console.error('[AdminBookings] Availability check failed:', error);
    }

    if (!slotAvailable) {
      throw new HttpError(
        409,
        'Partner is not available during the selected time slot',
        'PARTNER_SLOT_UNAVAILABLE',
      );
    }

    const hasConflict = await this.hasBookingConflict(
      typedBooking,
      partner._id.toString(),
    );

    if (hasConflict) {
      throw new HttpError(
        409,
        'Partner has a conflicting booking',
        'PARTNER_BOOKING_CONFLICT',
      );
    }

    const previousPartnerId =
      booking.partnerId?.toString() ?? null;

    const previousStatus = booking.status;
    const trimmedReason = reason.trim();

    const auditBefore: Record<string, unknown> = {
      partnerId: previousPartnerId,
      status: previousStatus,
    };

    booking.partnerId = partner._id;

    if (booking.status !== 'assigned') {
      applyTransition(
        booking,
        'assigned',
        { role: 'admin', id: user.id },
        trimmedReason,
      );
    } else {
      booking.statusHistory.push({
        from: previousStatus,
        to: 'assigned',
        reason: trimmedReason,
        actorId: user.id,
        actorRole: 'admin',
        at: new Date(),
      });
    }

    await booking.save();

    // Tell the partner (and the customer) about the assignment. Fire-and-forget: a failed
    // notification must never fail the assignment itself.
    void notify(String(partner.userId), 'booking.assigned', {
      title: 'New job assigned to you',
      message: 'A new job has been assigned to you. Open My Jobs to confirm it.',
      bookingId,
    }).catch((err) => console.error('[admin-bookings] partner assigned notification failed', err));

    if (booking.customerId) {
      alertCustomerPartnerAssigned({ customerId: booking.customerId, bookingId });
    }

    await this.recordBookingAudit(
      'booking.partner_assigned',
      bookingId,
      String(user.id),
      req.ip || 'unknown',
      auditBefore,
      {
        partnerId: partner._id.toString(),
        status: booking.status,
        reason: trimmedReason,
        distanceKm: Number(distanceKm.toFixed(2)),
      },
    );

    const payment = await this.getPaymentForBooking(bookingId);

    const data = await this.buildBookingResponse(
      booking as unknown as AdminBookingSource,
      payment,
    );

    res.status(200).json({
      success: true,
      data,
      assignment: {
        previousPartnerId,
        partnerId: partner._id.toString(),
        reason: trimmedReason,
        distanceKm: Number(distanceKm.toFixed(2)),
      },
    });
  }

  async overrideStatus(req: Request, res: Response): Promise<void> {
    const user = this.assertAdmin(req);

    const { bookingId } = req.params;
    const { status, reason } = req.body as {
      status?: string;
      reason?: string;
    };

    if (!status) {
      throw new HttpError(400, 'Status is required', 'STATUS_REQUIRED');
    }

    if (!reason?.trim()) {
      throw new HttpError(
        400,
        'Override reason is required',
        'OVERRIDE_REASON_REQUIRED',
      );
    }

    const isValidStatus = (value: string): value is BookingStatus =>
      (BOOKING_STATUSES as readonly string[]).includes(value);

    if (!isValidStatus(status)) {
      throw new HttpError(
        400,
        `Invalid booking status: ${status}`,
        'INVALID_BOOKING_STATUS',
      );
    }

    const booking = await BookingModel.findById(bookingId);

    if (!booking) {
      throw new HttpError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    const previousStatus = booking.status;
    const trimmedReason = reason.trim();

    applyTransition(
      booking,
      status,
      { role: 'admin', id: user.id },
      trimmedReason,
    );

    const latestHistoryEntry =
      booking.statusHistory[booking.statusHistory.length - 1];

    await BookingModel.updateOne(
      { _id: booking._id },
      {
        $set: { status },
        $push: { statusHistory: latestHistoryEntry },
      },
    ).exec();

    await this.recordBookingAudit(
      'booking.status_overridden',
      bookingId,
      String(user.id),
      req.ip || 'unknown',
      { status: previousStatus },
      { status, reason: trimmedReason },
    );

    res.status(200).json({
      success: true,
      data: {
        id: booking._id.toString(),
        status,
        previousStatus,
        reason: trimmedReason,
      },
    });
  }

  async cancelBooking(req: Request, res: Response): Promise<void> {
    const user = this.assertAdmin(req);

    const { bookingId } = req.params;
    const { reason } = req.body as { reason?: string };

    if (!reason?.trim()) {
      throw new HttpError(
        400,
        'Cancellation reason is required',
        'CANCELLATION_REASON_REQUIRED',
      );
    }

    const trimmedReason = reason.trim();

    const booking = await BookingModel.findById(bookingId);

    if (!booking) {
      throw new HttpError(404, 'Booking not found', 'BOOKING_NOT_FOUND');
    }

    if (
      booking.status === 'cancelled_by_customer' ||
      booking.status === 'cancelled_by_admin' ||
      booking.status === 'cancelled_by_partner'
    ) {
      const payment = await this.getPaymentForBooking(bookingId);

      const refundAmount = payment?.refund?.amount ?? 0;
      const refundStatus = payment?.refund?.status;

      const refundResult: RefundResult = {
        eligible: refundAmount > 0,
        amount: refundAmount,
        currency: payment?.currency ?? 'INR',
        status: refundStatus === 'processed'
          ? 'already_refunded'
          : 'none',
        paymentId: payment?.razorpayPaymentId,
      };

      const data = await this.buildBookingResponse(
        booking as unknown as AdminBookingSource,
        payment,
      );

      res.status(200).json({
        success: true,
        data,
        refund: refundResult,
      });

      return;
    }

    const auditBefore: Record<string, unknown> = {
      status: booking.status,
      partnerId: booking.partnerId?.toString() ?? null,
      cancellationReason: (
        booking as unknown as Record<string, unknown>
      ).cancellationReason,
    };

    const payment = await this.getPaymentForBooking(bookingId);

    let refundResult: RefundResult = {
      eligible: false,
      amount: 0,
      currency: payment?.currency ?? 'INR',
      status: 'none',
      paymentId: payment?.razorpayPaymentId,
    };

    if (payment) {
      const paymentStatus = (payment.status ?? '').toUpperCase();
      const refundStatus = (payment.refund?.status ?? 'none').toLowerCase();

      if (
        paymentStatus === 'REFUNDED' ||
        refundStatus === 'processed'
      ) {
        refundResult = {
          eligible: true,
          amount: payment.refund?.amount ?? payment.amount ?? 0,
          currency: payment.currency ?? 'INR',
          status: 'already_refunded',
          paymentId: payment.razorpayPaymentId,
        };
      } else if (paymentStatus === 'PAID') {
        const paymentId = payment.razorpayPaymentId;

        if (!paymentId) {
          throw new HttpError(
            400,
            'Paid payment does not contain a Razorpay payment ID',
            'RAZORPAY_PAYMENT_ID_MISSING',
          );
        }

        const refundAmount = payment.amount ?? 0;

        if (refundAmount <= 0) {
          throw new HttpError(
            400,
            'Refund amount must be greater than zero',
            'INVALID_REFUND_AMOUNT',
          );
        }

        const refundCurrency = payment.currency ?? 'INR';

        const paymentDocument = await PaymentModel.findOne({
          bookingId,
        }).sort({ createdAt: -1 });

        if (!paymentDocument) {
          throw new HttpError(
            404,
            'Payment record not found',
            'PAYMENT_NOT_FOUND',
          );
        }

        paymentDocument.refund = {
          status: 'requested',
          amount: refundAmount,
          requestedAt: new Date(),
        };

        await paymentDocument.save();

        try {
          await getRazorpay().payments.refund(paymentId, {
            amount: Math.round(refundAmount * 100),
          });

          paymentDocument.status = 'REFUNDED';
          paymentDocument.refund = {
            status: 'processed',
            amount: refundAmount,
            requestedAt:
              paymentDocument.refund?.requestedAt ?? new Date(),
          };

          await paymentDocument.save();

          refundResult = {
            eligible: true,
            amount: refundAmount,
            currency: refundCurrency,
            status: 'processed',
            paymentId,
          };
        } catch (error) {
          paymentDocument.refund = {
            status: 'rejected',
            amount: refundAmount,
          };

          await paymentDocument.save();

          console.error('[AdminBookings] Razorpay refund failed:', error);

          throw new HttpError(
            502,
            'Razorpay refund failed. Booking was not cancelled.',
            'REFUND_FAILED',
          );
        }
      }
    }

    applyTransition(
      booking,
      'cancelled_by_admin',
      { role: 'admin', id: user.id },
      trimmedReason,
    );

    const latestHistoryEntry =
      booking.statusHistory[booking.statusHistory.length - 1];

    await BookingModel.updateOne(
      { _id: booking._id },
      {
        $set: {
          status: 'cancelled_by_admin',
          cancellationReason: trimmedReason,
        },
        $push: { statusHistory: latestHistoryEntry },
      },
    ).exec();

    await this.recordBookingAudit(
      'booking.cancelled_by_admin',
      bookingId,
      String(user.id),
      req.ip || 'unknown',
      auditBefore,
      {
        status: 'cancelled_by_admin',
        cancellationReason: trimmedReason,
        refundStatus: refundResult.status,
        refundAmount: refundResult.amount,
      },
    );

    const updatedBooking = await BookingModel.findById(bookingId)
      .lean()
      .exec();

    if (!updatedBooking) {
      throw new HttpError(
        404,
        'Booking not found after cancellation',
        'BOOKING_NOT_FOUND',
      );
    }

    const latestPayment = await this.getPaymentForBooking(bookingId);

    const data = await this.buildBookingResponse(
      updatedBooking as unknown as AdminBookingSource,
      latestPayment,
    );

    res.status(200).json({
      success: true,
      data,
      refund: refundResult,
    });
  }
}

export const adminBookingsController = new AdminBookingsController();