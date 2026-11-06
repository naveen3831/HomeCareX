import { UserModel } from '../../models/User';
import { mailService } from '../../services/mail.service';
import { alertTrainingCompleted } from '../notifications/admin-alerts';

const frontendUrl = () => (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');

/** Admin addresses: ADMIN_NOTIFY_EMAIL (comma separated) wins, otherwise every active admin user. */
async function adminRecipients(): Promise<string[]> {
  const fromEnv = (process.env.ADMIN_NOTIFY_EMAIL ?? '').split(',').map((e) => e.trim()).filter(Boolean);
  if (fromEnv.length > 0) return fromEnv;
  const admins = await UserModel.find({ role: 'admin', status: 'active' }).select('email').lean();
  return admins.map((a) => a.email).filter(Boolean);
}

/**
 * The partner finished the last step: bell alert (click opens the partner page) + email to the admin team.
 * Fire-and-forget: a failed alert or email must never fail the step the partner just completed.
 * Without SMTP only the bell alert arrives.
 */
export function notifyAdminsTrainingCompleted(userId: string): void {
  void (async () => {
    const user = await UserModel.findById(userId).select('name email').lean();
    const partnerName = user?.name ?? 'A partner';
    alertTrainingCompleted({ partnerId: userId, partnerName });
    const to = await adminRecipients();
   await mailService.sendAdminPartnerTrainingEmail(to, {
      partnerName,
      partnerEmail: user?.email ?? '-',
      reviewUrl: `${frontendUrl()}/admin/partners/${userId}`,
    });
  })().catch((err) => console.error('[partner-onboarding] training.completed notify failed', err));
}

/** An admin approved the training: tell the partner. Fire-and-forget. */
export function notifyPartnerTrainingApproved(userId: string): void {
  void (async () => {
    const user = await UserModel.findById(userId).select('name email').lean();
    if (!user?.email) return;
    await mailService.sendPartnerTrainingApprovedEmail({ name: user.name, email: user.email, loginUrl: `${frontendUrl()}/login` });
  })().catch((err) => console.error('[partner-onboarding] approval email failed', err));
}
