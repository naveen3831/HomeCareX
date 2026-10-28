import { Router } from 'express';
import mongoose from 'mongoose';

import { asyncHandler } from '../../utils/asyncHandler';
import { LeadModel } from './leads.model';

/**
 * Mounted at /admin/leads with authMiddleware + requireAdmin + requireResourceAccess('leads'):
 * GET needs leads:view, PATCH needs leads:update.
 */
export const adminLeadsRoutes = Router();

const STATUSES = ['new', 'contacted', 'closed'] as const;
const SOURCES = ['contact', 'partner'] as const;
const PAGE_SIZE = 20;

const escapeRegex = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The model stores skills as one comma-separated string; the admin UI wants a list. */
const toDto = (doc: Record<string, any>) => ({
  _id: String(doc._id),
  name: doc.name,
  email: doc.email,
  phone: doc.phone,
  city: doc.city,
  message: doc.message,
  skills: doc.skills
    ? String(doc.skills).split(',').map((s: string) => s.trim()).filter(Boolean)
    : undefined,
  source: doc.source,
  status: doc.status,
  createdAt: doc.createdAt,
});

adminLeadsRoutes.get(
  '/',
  asyncHandler(async (req, res) => {
    const page = Math.max(1, Number.parseInt(String(req.query.page ?? '1'), 10) || 1);
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const source = String(req.query.source ?? '');
    const status = String(req.query.status ?? '');

    const filter: Record<string, unknown> = {};
    if ((SOURCES as readonly string[]).includes(source)) filter.source = source;
    if ((STATUSES as readonly string[]).includes(status)) filter.status = status;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { city: rx }, { message: rx }];
    }

    const [docs, total, byStatus, partnerInterests] = await Promise.all([
      LeadModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
      LeadModel.countDocuments(filter),
      LeadModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      LeadModel.countDocuments({ source: 'partner' }),
    ]);

    const count = (s: string) => byStatus.find((r) => r._id === s)?.count ?? 0;
    res.json({
      success: true,
      data: {
        leads: docs.map(toDto),
        pagination: { page, limit: PAGE_SIZE, total, pages: Math.ceil(total / PAGE_SIZE) },
        stats: {
          total: byStatus.reduce((n, r) => n + r.count, 0),
          new: count('new'),
          contacted: count('contacted'),
          closed: count('closed'),
          partnerInterests,
        },
      },
    });
  }),
);

adminLeadsRoutes.get(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'This lead is no longer available.' });
    }
    const doc = await LeadModel.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'This lead is no longer available.' });
    res.json({ success: true, data: toDto(doc) });
  }),
);

adminLeadsRoutes.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const status = req.body?.status;
    if (!(STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be new, contacted or closed.' });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: 'This lead is no longer available.' });
    }
    const doc = await LeadModel.findByIdAndUpdate(req.params.id, { status }, { new: true }).lean();
    if (!doc) return res.status(404).json({ success: false, message: 'This lead is no longer available.' });
    res.json({ success: true, data: toDto(doc) });
  }),
);

export default adminLeadsRoutes;
