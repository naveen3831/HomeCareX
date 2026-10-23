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

// POST /api/v1/partner/kyc/submit
partnerKycRoutes.post(
  '/submit',
  asyncHandler(async (req, res) => {
    const { id } = getAuthUser(req);

    const partner = await PartnerModel.findOneAndUpdate(
      { userId: id },
      { $set: { 'kyc.status': 'submitted', 'kyc.submittedAt': new Date() } },
      { new: true },
    );
    if (!partner) throw new HttpError(404, 'Partner profile not found', 'NOT_FOUND');

    const user = await UserModel.findById(id).select('name').lean();
    alertKycSubmitted({ partnerId: String(partner._id), partnerName: user?.name });

    sendSuccess(res, { status: 'submitted' });
  }),
);

export default partnerKycRoutes;