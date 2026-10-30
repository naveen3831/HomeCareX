import { UserModel } from '../../models/User';
import { mailService } from '../../services/mail.service';
import { alertKycSubmitted } from '../notifications/admin-alerts';

export interface KycSubmittedInfo {
  /** The partner's login user id: the same id /admin/partners/:id and the admin UI use. */
  userId: string;
  name: string;
  email: string;
  phone?: string;
  category?: string;
}

/** Admin addresses: ADMIN_NOTIFY_EMAIL (comma separated) wins, otherwise every active admin user. */
async function adminRecipients(): Promise<string[]> {
  const fromEnv = (process.env.ADMIN_NOTIFY_EMAIL ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;

  const admins = await UserModel.find({ role: 'admin', status: 'active' }).select('email').lean();
  return admins.map((a) => a.email).filter(Boolean);
}

/**
 * A partner is waiting for KYC review: bell alert + email to the admin team.
 * Fire-and-forget. A failed alert or email must never fail the registration that triggered it.
 */
export function notifyAdminsKycSubmitted(info: KycSubmittedInfo): void {
  alertKycSubmitted({ partnerId: info.userId, partnerName: info.name });

  void (async () => {
    const to = await adminRecipients();
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    await mailService.sendAdminPartnerKycEmail(to, {
      partnerName: info.name,
      partnerEmail: info.email,
      partnerPhone: info.phone,
      category: info.category,
      reviewUrl: `${frontendUrl}/admin/partners/${info.userId}`,
    });
  })().catch((err) => console.error('[partners] admin KYC email failed', err));
}
