import { Types } from 'mongoose';
import { CouponModel } from '../../models/Coupon';
import { CategoryModel } from '../../models/Category';
import { ServiceModel } from '../../models/Service';
import { HttpError } from '../auth/auth.types';
import { auditService } from '../audit/audit.service';
import {
  couponCreateSchema,
  couponUpdateSchema,
} from './coupons.validation';
import { couponsRepository } from './coupons.repository';
import type {
  CouponDto,
  CouponValidateInput,
  CouponValidateResult,
} from './coupons.types';

interface AuditActor {
  id: string;
  ip: string;
}

interface CouponDocumentLike {
  _id: Types.ObjectId;
  code: string;
  type: 'PERCENT' | 'FLAT';
  value: number;
  maxDiscount?: number | null;
  minOrder: number;
  startAt: Date;
  endAt: Date;
  totalLimit?: number | null;
  perUserLimit?: number | null;
  usedCount: number;
  categoryIds: Types.ObjectId[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const toDto = (coupon: CouponDocumentLike): CouponDto => ({
  id: coupon._id.toString(),
  code: coupon.code,
  type: coupon.type,
  value: coupon.value,
  maxDiscount: coupon.maxDiscount ?? null,
  minOrder: coupon.minOrder ?? 0,
  startAt: coupon.startAt.toISOString(),
  endAt: coupon.endAt.toISOString(),
  totalLimit: coupon.totalLimit ?? null,
  perUserLimit: coupon.perUserLimit ?? null,
  usedCount: coupon.usedCount ?? 0,
  categoryIds: (coupon.categoryIds ?? []).map((id) =>
    id.toString(),
  ),
  active: coupon.active,
  createdAt: coupon.createdAt.toISOString(),
  updatedAt: coupon.updatedAt.toISOString(),
});

export class CouponsService {
  async list(
    search?: string,
    active?: boolean,
  ): Promise<CouponDto[]> {
    const coupons = await couponsRepository.list(
      search,
      active,
    );

    return coupons.map((coupon) =>
      toDto(coupon as unknown as CouponDocumentLike),
    );
  }

  async getById(id: string): Promise<CouponDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(
        404,
        'Coupon not found',
        'NOT_FOUND',
      );
    }

    const coupon = await couponsRepository.findById(id);

    if (!coupon) {
      throw new HttpError(
        404,
        'Coupon not found',
        'NOT_FOUND',
      );
    }

    return toDto(
      coupon as unknown as CouponDocumentLike,
    );
  }

  async create(
    input: unknown,
    actor: AuditActor,
  ): Promise<CouponDto> {
    const parsed = couponCreateSchema.safeParse(input);

    if (!parsed.success) {
      const error = new HttpError(
        422,
        'Invalid coupon data',
        'VALIDATION_ERROR',
      );

      error.details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw error;
    }

    const data = parsed.data;

    const existing = await couponsRepository.findByCode(
      data.code,
    );

    if (existing) {
      throw new HttpError(
        409,
        'Coupon code already exists',
        'COUPON_DUPLICATE',
      );
    }

    const coupon = await couponsRepository.create({
      ...data,
      code: data.code.toUpperCase(),
    });

    const after = toDto(
      coupon as unknown as CouponDocumentLike,
    );

    // Audit failure must not undo a successful coupon creation.
    try {
      await auditService.recordAudit({
        actor: actor.id,
        action: 'coupon.created',
        entity: 'Coupon',
        entityId: after.id,
        before: null,
        after,
        ip: actor.ip,
        result: 'Success',
      });
    } catch (error) {
      console.error(
        '[Audit] Failed to record coupon creation:',
        error,
      );
    }

    return after;
  }

  async update(
    id: string,
    input: unknown,
    actor: AuditActor,
  ): Promise<CouponDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(
        404,
        'Coupon not found',
        'NOT_FOUND',
      );
    }

    const parsed = couponUpdateSchema.safeParse(input);

    if (!parsed.success) {
      const error = new HttpError(
        422,
        'Invalid coupon data',
        'VALIDATION_ERROR',
      );

      error.details = parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw error;
    }

    const data = parsed.data;

    // Capture the existing state before modifying the coupon.
    const existingCoupon = await couponsRepository.findById(
      id,
    );

    if (!existingCoupon) {
      throw new HttpError(
        404,
        'Coupon not found',
        'NOT_FOUND',
      );
    }

    const before = toDto(
      existingCoupon as unknown as CouponDocumentLike,
    );

    if (data.code) {
      const duplicate = await couponsRepository.findByCode(
        data.code,
      );

      if (
        duplicate &&
        duplicate._id.toString() !== id
      ) {
        throw new HttpError(
          409,
          'Coupon code already exists',
          'COUPON_DUPLICATE',
        );
      }
    }

    const coupon = await couponsRepository.update(id, {
      ...data,
      ...(data.code
        ? { code: data.code.toUpperCase() }
        : {}),
    });

    if (!coupon) {
      throw new HttpError(
        404,
        'Coupon not found',
        'NOT_FOUND',
      );
    }

    const after = toDto(
      coupon as unknown as CouponDocumentLike,
    );

    // Store before/after snapshots for the audit history.
    try {
      await auditService.recordAudit({
        actor: actor.id,
        action: 'coupon.updated',
        entity: 'Coupon',
        entityId: after.id,
        before,
        after,
        ip: actor.ip,
        result: 'Success',
      });
    } catch (error) {
      console.error(
        '[Audit] Failed to record coupon update:',
        error,
      );
    }

    return after;
  }

  async remove(
    id: string,
    actor: AuditActor,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(
        404,
        'Coupon not found',
        'NOT_FOUND',
      );
    }

    // Save the coupon snapshot before deletion.
    const existingCoupon = await couponsRepository.findById(
      id,
    );

    if (!existingCoupon) {
      throw new HttpError(
        404,
        'Coupon not found',
        'NOT_FOUND',
      );
    }

    const before = toDto(
      existingCoupon as unknown as CouponDocumentLike,
    );

    const coupon = await couponsRepository.remove(id);

    if (!coupon) {
      throw new HttpError(
        404,
        'Coupon not found',
        'NOT_FOUND',
      );
    }

    // A deleted coupon has no after snapshot.
    try {
      await auditService.recordAudit({
        actor: actor.id,
        action: 'coupon.deleted',
        entity: 'Coupon',
        entityId: before.id,
        before,
        after: null,
        ip: actor.ip,
        result: 'Success',
      });
    } catch (error) {
      console.error(
        '[Audit] Failed to record coupon deletion:',
        error,
      );
    }
  }

  async validate(
    input: CouponValidateInput,
    userId?: string,
  ): Promise<CouponValidateResult> {
    const code = input.couponCode.trim().toUpperCase();

    if (!code) {
      throw new HttpError(
        422,
        'Coupon code is required',
        'COUPON_INVALID',
      );
    }

    const coupon = await couponsRepository.findByCode(code);

    if (!coupon) {
      throw new HttpError(
        422,
        'That coupon code is not valid',
        'COUPON_INVALID',
      );
    }

    if (!coupon.active) {
      throw new HttpError(
        422,
        'This coupon is inactive',
        'COUPON_INACTIVE',
      );
    }

    const now = new Date();

    if (now < coupon.startAt) {
      throw new HttpError(
        422,
        'This coupon has not started yet',
        'COUPON_NOT_STARTED',
      );
    }

    if (now > coupon.endAt) {
      throw new HttpError(
        422,
        'This coupon has expired',
        'COUPON_EXPIRED',
      );
    }

    if (
      coupon.totalLimit !== null &&
      coupon.totalLimit !== undefined &&
      coupon.usedCount >= coupon.totalLimit
    ) {
      throw new HttpError(
        422,
        'This coupon has reached its usage limit',
        'COUPON_USAGE_LIMIT',
      );
    }

    if (userId) {
      const userUsage = await couponsRepository.countUsage(
        coupon._id.toString(),
        userId,
      );

      if (
        coupon.perUserLimit !== null &&
        coupon.perUserLimit !== undefined &&
        userUsage >= coupon.perUserLimit
      ) {
        throw new HttpError(
          422,
          'You have reached the usage limit for this coupon',
          'COUPON_PER_USER_LIMIT',
        );
      }
    }

    if (!Types.ObjectId.isValid(input.serviceId)) {
      throw new HttpError(
        422,
        'That service is not valid',
        'COUPON_INVALID',
      );
    }

    const service = await ServiceModel.findById(
      input.serviceId,
    );

    if (!service || !service.active) {
      throw new HttpError(
        422,
        'That service is not available',
        'COUPON_INVALID',
      );
    }

    if (
      coupon.categoryIds.length > 0 &&
      !coupon.categoryIds.some(
        (categoryId) =>
          categoryId.toString() ===
          service.categoryId.toString(),
      )
    ) {
      throw new HttpError(
        422,
        'This coupon is not applicable to this service',
        'COUPON_NOT_APPLICABLE',
      );
    }

    const quantity = Math.max(
      1,
      input.quantity || 1,
    );

    let orderValue = service.basePrice * quantity;

    for (const addOnInput of input.addOns ?? []) {
      const addOn = (service.addOns ?? []).find(
        (item) =>
          String((item as { _id?: unknown; id?: unknown })._id ?? (item as { _id?: unknown; id?: unknown }).id) ===
          addOnInput.addOnId,
      );

      if (addOn) {
        orderValue +=
          addOn.price *
          Math.max(1, addOnInput.quantity || 1);
      }
    }

    if (orderValue < coupon.minOrder) {
      const error = new HttpError(
        422,
        `Minimum order value is ₹${coupon.minOrder}`,
        'COUPON_MIN_ORDER',
      );

      error.details = [
        {
          field: 'minOrder',
          message: String(coupon.minOrder),
        },
      ];

      throw error;
    }

    let discount =
      coupon.type === 'PERCENT'
        ? Math.round(
            (orderValue * coupon.value) / 100,
          )
        : coupon.value;

    if (
      coupon.maxDiscount !== null &&
      coupon.maxDiscount !== undefined
    ) {
      discount = Math.min(
        discount,
        coupon.maxDiscount,
      );
    }

    discount = Math.min(discount, orderValue);

    return {
      code,
      discount,
    };
  }

  async listAvailable(
    input?: Omit<
      CouponValidateInput,
      'couponCode'
    >,
    userId?: string,
  ): Promise<
    {
      id: string;
      code: string;
      title: string;
      description: string;
      eligible: boolean;
      type: 'PERCENT' | 'FLAT';
      value: number;
      minOrder: number;
      maxDiscount: number | null;
      reason?: {
        code: string;
        minOrder?: number;
      };
    }[]
  > {
    const now = new Date();
    const coupons = await CouponModel.find({
      active: true,
      startAt: { $lte: now },
      endAt: { $gte: now },
    })
      .populate('categoryIds', 'name slug')
      .sort({
        createdAt: -1,
      });

    const results: {
      id: string;
      code: string;
      title: string;
      description: string;
      eligible: boolean;
      type: 'PERCENT' | 'FLAT';
      value: number;
      minOrder: number;
      maxDiscount: number | null;
      reason?: {
        code: string;
        minOrder?: number;
      };
    }[] = [];

    for (const coupon of coupons) {
      const categoryNames = ((coupon.categoryIds ?? []) as unknown as Array<{ name?: string }>)
        .map((c) => (typeof c === 'object' && c !== null ? c.name : ''))
        .filter(Boolean);

      const categoryScope = categoryNames.length > 0 ? ` on ${categoryNames.join(', ')}` : '';

      const title =
        coupon.type === 'PERCENT'
          ? `${coupon.value}% off${categoryScope}`
          : `Flat ₹${coupon.value} off${categoryScope}`;

      const description =
        coupon.maxDiscount && coupon.type === 'PERCENT'
          ? `${coupon.value}% off up to ₹${coupon.maxDiscount}${coupon.minOrder > 0 ? ` on orders above ₹${coupon.minOrder}` : ''}.`
          : coupon.minOrder > 0
          ? `On orders above ₹${coupon.minOrder}. Valid on all eligible services.`
          : `Valid on all eligible services.`;

      if (input && input.serviceId) {
        try {
          await this.validate(
            {
              ...input,
              couponCode: coupon.code,
            },
            userId,
          );

          results.push({
            id: coupon._id.toString(),
            code: coupon.code,
            title,
            description,
            eligible: true,
            type: coupon.type,
            value: coupon.value,
            minOrder: coupon.minOrder,
            maxDiscount: coupon.maxDiscount ?? null,
          });
        } catch (error) {
          const err = error as HttpError;
          if (err.code === 'COUPON_EXPIRED' || err.code === 'COUPON_NOT_STARTED') {
            continue;
          }

          const normalizedCode =
            err.code === 'COUPON_PER_USER_LIMIT'
              ? 'COUPON_USAGE_LIMIT'
              : (err.code ?? 'COUPON_INVALID');

          results.push({
            id: coupon._id.toString(),
            code: coupon.code,
            title,
            description,
            eligible: false,
            type: coupon.type,
            value: coupon.value,
            minOrder: coupon.minOrder,
            maxDiscount: coupon.maxDiscount ?? null,
            reason: {
              code: normalizedCode,
              ...(err.details?.[0]?.message
                ? {
                    minOrder: Number(err.details[0].message),
                  }
                : {}),
            },
          });
        }
      } else {
        let eligible = true;
        let reasonCode: string | undefined;

        if (
          coupon.totalLimit !== null &&
          coupon.totalLimit !== undefined &&
          coupon.usedCount >= coupon.totalLimit
        ) {
          eligible = false;
          reasonCode = 'COUPON_USAGE_LIMIT';
        } else if (userId && coupon.perUserLimit !== null && coupon.perUserLimit !== undefined) {
          const userUsage = await couponsRepository.countUsage(
            coupon._id.toString(),
            userId,
          );
          if (userUsage >= coupon.perUserLimit) {
            eligible = false;
            reasonCode = 'COUPON_USAGE_LIMIT';
          }
        }

        results.push({
          id: coupon._id.toString(),
          code: coupon.code,
          title,
          description,
          eligible,
          type: coupon.type,
          value: coupon.value,
          minOrder: coupon.minOrder,
          maxDiscount: coupon.maxDiscount ?? null,
          ...(reasonCode ? { reason: { code: reasonCode } } : {}),
        });
      }
    }

    return results;
  }

  async recordUsage(
    code: string,
    userId: string,
    bookingId?: string,
  ): Promise<void> {
    const coupon = await couponsRepository.findByCode(code);
    if (!coupon) return;
    await couponsRepository.recordUsage(coupon._id.toString(), userId, bookingId);
    await CouponModel.findByIdAndUpdate(coupon._id, { $inc: { usedCount: 1 } });
  }
}

export const couponsService = new CouponsService();
