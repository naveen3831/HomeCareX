
import { Types } from 'mongoose';
import { HttpError } from '../auth/auth.types';
import { auditService } from '../audit/audit.service';
import { marketingValidation } from './marketing.validation';
import { marketingRepository } from './marketing.repository';
import type { BannerDto } from './marketing.types';

interface BannerDocumentLike {
  _id: Types.ObjectId;
  title: string;
  image: string;
  link?: string;
  placement:
    | 'HOME'
    | 'HOME_TOP'
    | 'HOME_MIDDLE'
    | 'HOME_BOTTOM';
  startAt: Date;
  endAt: Date;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MarketingAuditActor {
  id: string;
  ip: string;
}

const toDto = (
  banner: BannerDocumentLike,
): BannerDto => ({
  id: banner._id.toString(),
  title: banner.title,
  image: banner.image,
  link: banner.link ?? '',
  placement: banner.placement,
  startAt: new Date(banner.startAt).toISOString(),
  endAt: new Date(banner.endAt).toISOString(),
  order: banner.order ?? 0,
  active: banner.active,
  createdAt: new Date(banner.createdAt).toISOString(),
  updatedAt: new Date(banner.updatedAt).toISOString(),
});

/**
 * Records an audit event without undoing a successful
 * banner operation if the audit store is unavailable.
 */
const recordMarketingAudit = async (input: {
  actor: MarketingAuditActor;
  action: string;
  entityId: string;
  before?: BannerDto;
  after?: BannerDto;
}): Promise<void> => {
  try {
    await auditService.recordAudit({
      actor: input.actor.id,
      action: input.action,
      entity: 'Banner',
      entityId: input.entityId,
      ip: input.actor.ip || 'unknown',
      result: 'Success',
      ...(input.before
        ? { before: input.before }
        : {}),
      ...(input.after
        ? { after: input.after }
        : {}),
    });
  } catch (error) {
    console.error(
      `[Audit] Failed to record ${input.action}:`,
      error,
    );
  }
};

export class MarketingService {
  async listAdmin(): Promise<BannerDto[]> {
    const banners = await marketingRepository.listAdmin();

    return banners.map((banner) =>
      toDto(banner as unknown as BannerDocumentLike),
    );
  }

  async getById(id: string): Promise<BannerDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(
        404,
        'Banner not found',
        'NOT_FOUND',
      );
    }

    const banner = await marketingRepository.findById(id);

    if (!banner) {
      throw new HttpError(
        404,
        'Banner not found',
        'NOT_FOUND',
      );
    }

    return toDto(banner as unknown as BannerDocumentLike);
  }

  async create(
    input: unknown,
    actor: MarketingAuditActor,
  ): Promise<BannerDto> {
    const result =
      marketingValidation.bannerCreateSchema.safeParse(input);

    if (!result.success) {
      const error = new HttpError(
        422,
        'Invalid banner data',
        'VALIDATION_ERROR',
      );

      error.details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw error;
    }

    const banner = await marketingRepository.create(
      result.data,
    );

    const after = toDto(
      banner as unknown as BannerDocumentLike,
    );

    await recordMarketingAudit({
      actor,
      action: 'banner.created',
      entityId: after.id,
      after,
    });

    return after;
  }

  async update(
    id: string,
    input: unknown,
    actor: MarketingAuditActor,
  ): Promise<BannerDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(
        404,
        'Banner not found',
        'NOT_FOUND',
      );
    }

    const existing = await marketingRepository.findById(id);

    if (!existing) {
      throw new HttpError(
        404,
        'Banner not found',
        'NOT_FOUND',
      );
    }

    const result =
      marketingValidation.bannerUpdateSchema.safeParse(input);

    if (!result.success) {
      const error = new HttpError(
        422,
        'Invalid banner data',
        'VALIDATION_ERROR',
      );

      error.details = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));

      throw error;
    }

    const data = result.data;
    const existingBanner =
      existing as unknown as BannerDocumentLike;

    const startAt = data.startAt ?? existingBanner.startAt;
    const endAt = data.endAt ?? existingBanner.endAt;

    if (new Date(endAt) <= new Date(startAt)) {
      const error = new HttpError(
        422,
        'End date must be after start date',
        'VALIDATION_ERROR',
      );

      error.details = [
        {
          field: 'endAt',
          message: 'End date must be after start date',
        },
      ];

      throw error;
    }

    const banner = await marketingRepository.update(
      id,
      data,
    );

    if (!banner) {
      throw new HttpError(
        404,
        'Banner not found',
        'NOT_FOUND',
      );
    }

    const before = toDto(existingBanner);
    const after = toDto(
      banner as unknown as BannerDocumentLike,
    );

    await recordMarketingAudit({
      actor,
      action: 'banner.updated',
      entityId: after.id,
      before,
      after,
    });

    return after;
  }

  async remove(
    id: string,
    actor: MarketingAuditActor,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(
        404,
        'Banner not found',
        'NOT_FOUND',
      );
    }

    const banner = await marketingRepository.remove(id);

    if (!banner) {
      throw new HttpError(
        404,
        'Banner not found',
        'NOT_FOUND',
      );
    }

    const before = toDto(
      banner as unknown as BannerDocumentLike,
    );

    await recordMarketingAudit({
      actor,
      action: 'banner.deleted',
      entityId: before.id,
      before,
    });
  }

  async listPublic(
    placement?: string,
  ): Promise<BannerDto[]> {
    const banners = await marketingRepository.listPublic(
      placement,
    );

    return banners.map((banner) =>
      toDto(banner as unknown as BannerDocumentLike),
    );
  }
}

export const marketingService = new MarketingService();
