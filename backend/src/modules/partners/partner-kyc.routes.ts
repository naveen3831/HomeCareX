import { Router } from 'express';
import { authenticate, getAuthUser } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/role.middleware';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { HttpError } from '../auth/auth.types';
import { PartnerModel } from '../../models/Partner';
import { UserModel } from '../../models/User';
import { alertKycSubmitted } from '../notifications/admin-alerts';

/** Mounted at /api/v1/partner/kyc. Partner only. */
export const partnerKycRoutes = Router();
partnerKycRoutes.use(authenticate, requireRole('partner'));

/** Statuses a partner may submit from. Anything else is either already decided or in the team's hands. */
const SUBMITTABLE_STATUSES = ['not_started', 'not_submitted', 'rejected'] as const;

// POST /api/v1/partner/kyc/submit
//
// Checks, in this order:
//   404  no partner profile
//   409  KYC already approved   (an approved partner must never be pushed back to "submitted")
//   409  KYC already in review  (the team is looking at it right now)
//   403  KYC suspended          (only an admin can lift a suspension)
//   400  no documents uploaded  (nothing to review)
//   200  already submitted      (safe to repeat: nothing changes, admins are not alerted twice)
partnerKycRoutes.post(
  '/submit',
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);

    const current = await PartnerModel.findOne({ userId: id }).select('kyc').lean();
    if (!current) throw new HttpError(404, 'Partner profile not found', 'NOT_FOUND');

    const status = String(current.kyc?.status ?? 'not_started');

    if (status === 'approved') {
      throw new HttpError(409, 'Your KYC is already approved.', 'KYC_ALREADY_APPROVED');
    }
    if (status === 'in_review') {
      throw new HttpError(409, 'Your KYC is already being reviewed.', 'KYC_IN_REVIEW');
    }
    if (status === 'suspended') {
      throw new HttpError(403, 'Your account is suspended. Please contact support.', 'KYC_SUSPENDED');
    }

    const documents = current.kyc?.documents ?? [];
    if (documents.length === 0) {
      throw new HttpError(400, 'Upload your KYC documents before submitting.', 'KYC_DOCUMENTS_MISSING');
    }

    if (status === 'submitted') {
      sendSuccess(res, { status: 'submitted' });
      return;
    }

    // Conditional update: if the status changed since we read it (for example an admin just approved it),
    // nothing is written and we report the conflict instead of overwriting the decision.
    const updated = await PartnerModel.findOneAndUpdate(
      {
        userId: id,
        'kyc.status': { $in: [...SUBMITTABLE_STATUSES] },
        'kyc.documents.0': { $exists: true },
      },
      {
        $set: { 'kyc.status': 'submitted', 'kyc.submittedAt': new Date() },
        $unset: { 'kyc.rejectionReason': '' },
      },
      { new: true },
    );
    if (!updated) {
      throw new HttpError(409, 'Your KYC status just changed. Refresh and try again.', 'CONFLICT');
    }

    const user = await UserModel.findById(id).select('name').lean();
    // The admin UI opens /admin/partners/:id with the login user id, not the Partner profile id.
    alertKycSubmitted({ partnerId: id, partnerName: user?.name });

    sendSuccess(res, { status: 'submitted' });
  }),
);

export default partnerKycRoutes;
