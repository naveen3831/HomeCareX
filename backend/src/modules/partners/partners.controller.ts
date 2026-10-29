
import type { NextFunction, Request, Response } from 'express';

import { parseBody } from '../auth/auth.validation';
import { getAuthUser } from '../../middleware/auth.middleware';

import { partnersService } from './partners.service';
import {
  createPartnerSchema,
  updatePartnerSchema,
} from './partners.validation';

/**
 * ---------------------------------------------------------
 * ASYNC CONTROLLER WRAPPER
 * ---------------------------------------------------------
 */
const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };

/**
 * ---------------------------------------------------------
 * AUTHENTICATED ADMIN AUDIT ACTOR
 * ---------------------------------------------------------
 */
const getActor = (req: Request) => ({
  id: getAuthUser(req).id,
  ip: req.ip || 'unknown',
});

/**
 * ---------------------------------------------------------
 * PARTNERS CONTROLLER
 * ---------------------------------------------------------
 */
export class PartnersController {
  /**
   * CREATE PARTNER
   */
  create = wrap(async (req, res) => {
    const actor = getActor(req);

    const input = parseBody(
      createPartnerSchema,
      req.body,
    );

    const data = await partnersService.create(
      input,
      actor,
    );

    res.status(201).json({
      success: true,
      data,
      message: data.emailSent
        ? 'Partner registered and credentials emailed.'
        : 'Partner registered, but the email could not be sent.',
    });
  });

  /**
   * GET PARTNER BY ID
   * Used by the Admin Partner Details page.
   */
  getById = wrap(async (req, res) => {
    const data = await partnersService.getById(
      req.params.id,
    );

    res.json({
      success: true,
      data,
    });
  });

  /**
   * UPDATE PARTNER
   */
  update = wrap(async (req, res) => {
    const actor = getActor(req);

    const input = parseBody(
      updatePartnerSchema,
      req.body,
    );

    const data = await partnersService.update(
      req.params.id,
      input,
      actor,
    );

    res.json({
      success: true,
      data,
      message: 'Partner updated.',
    });
  });

  /**
   * DELETE PARTNER
   */
  remove = wrap(async (req, res) => {
    const actor = getActor(req);

    await partnersService.remove(
      req.params.id,
      actor,
    );

    res.json({
      success: true,
      data: { ok: true },
      message: 'Partner removed.',
    });
  });

  /**
   * GET PARTNERS
   */
  getPartners = wrap(async (_req, res) => {
    const data = await partnersService.list();

    res.json({
      success: true,
      data,
    });
  });

  /**
   * GET PARTNERS & KYC DIRECTORY
   */
  getDirectory = wrap(async (_req, res) => {
    const data = await partnersService.directory();

    res.json({
      success: true,
      data,
    });
  });

  /**
   * GET PARTNER STATISTICS
   */
  getStats = wrap(async (_req, res) => {
    const data = await partnersService.stats();

    res.json({
      success: true,
      data,
    });
  });
}

export default PartnersController;
