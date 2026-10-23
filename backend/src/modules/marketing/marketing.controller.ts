
import type {
  Request,
  Response,
} from 'express';

import { sendSuccess } from '../../utils/response';
import { getAuthUser } from '../../middleware/auth.middleware';
import { marketingService } from './marketing.service';

export class MarketingController {
  async listAdmin(
    _req: Request,
    res: Response,
  ) {
    const banners =
      await marketingService.listAdmin();

    return sendSuccess(res, banners);
  }

  async getById(
    req: Request,
    res: Response,
  ) {
    const banner =
      await marketingService.getById(
        req.params.id,
      );

    return sendSuccess(res, banner);
  }

  async create(
    req: Request,
    res: Response,
  ) {
    const user = getAuthUser(req);

    const actor = {
      id: String(user.id),
      ip: req.ip || 'unknown',
    };

    const banner =
      await marketingService.create(
        req.body,
        actor,
      );

    return sendSuccess(res, banner, {
      status: 201,
    });
  }

  async update(
    req: Request,
    res: Response,
  ) {
    const user = getAuthUser(req);

    const actor = {
      id: String(user.id),
      ip: req.ip || 'unknown',
    };

    const banner =
      await marketingService.update(
        req.params.id,
        req.body,
        actor,
      );

    return sendSuccess(res, banner);
  }

  async remove(
    req: Request,
    res: Response,
  ) {
    const user = getAuthUser(req);

    const actor = {
      id: String(user.id),
      ip: req.ip || 'unknown',
    };

    await marketingService.remove(
      req.params.id,
      actor,
    );

    return sendSuccess(res, {
      ok: true,
    });
  }

  async listPublic(
    req: Request,
    res: Response,
  ) {
    const placement =
      typeof req.query.placement === 'string'
        ? req.query.placement
        : undefined;

    const banners =
      await marketingService.listPublic(
        placement,
      );

    return sendSuccess(res, banners);
  }
}

export const marketingController =
  new MarketingController();
