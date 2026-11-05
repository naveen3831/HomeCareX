import PartnerModel from '../../models/Partner';
import { ERROR_CODES } from '../../constants/errorCodes';
import { Errors } from '../../utils/errors';
import { auditService } from '../audit/audit.service';
import { UserModel } from '../../models/User';
import { mailService } from '../../services/mail.service';
import { notifyAdminsTrainingCompleted } from '../partners/partner-kyc.notify';

/** Must match DEMO_STEPS in the frontend (pages/partner/Onboarding/onboarding.content.ts). */
export const ONBOARDING_TOTAL_STEPS = 6;

/**
 * not_eligible       KYC is not approved yet: no demo.
 * training           the partner is still watching the demo (resumes at currentStep).
 * awaiting_approval  all steps done, an admin has not approved yet. The partner has no access.
 * approved           an admin approved: the partner can use the app.
 */
export type OnboardingStage = 'not_eligible' | 'training' | 'awaiting_approval' | 'approved';

export interface OnboardingStatus {
  eligible: boolean;
  totalSteps: number;
  completedSteps: number;
  currentStep: number | null;
  completed: boolean;
  completedAt: string | null;
  stage: OnboardingStage;
  /** true only when an admin has approved the finished training. */
  approved: boolean;
  approvedAt: string | null;
}

interface Row {
  kyc?: { status?: string };
  onboarding?: { completedSteps?: number; completedAt?: Date; approvedAt?: Date };
}

const iso = (d?: Date): string | null => (d ? new Date(d).toISOString() : null);

function toStatus(row: Row): OnboardingStatus {
  const done = Math.min(row.onboarding?.completedSteps ?? 0, ONBOARDING_TOTAL_STEPS);
  const completed = done >= ONBOARDING_TOTAL_STEPS;
  const eligible = row.kyc?.status === 'approved';
  const approved = eligible && completed && !!row.onboarding?.approvedAt;
  const stage: OnboardingStage = !eligible ? 'not_eligible' : approved ? 'approved' : completed ? 'awaiting_approval' : 'training';
  return {
    eligible,
    totalSteps: ONBOARDING_TOTAL_STEPS,
    completedSteps: done,
    currentStep: completed ? null : done + 1,
    completed,
    completedAt: iso(row.onboarding?.completedAt),
    stage,
    approved,
    approvedAt: iso(row.onboarding?.approvedAt),
  };
}

const SELECT = 'kyc.status onboarding';

/** Fire-and-forget: tell the admins this partner finished the training. Never fails the partner's request. */
function notifyTrainingCompleted(userId: string): void {
  void (async () => {
    const user = await UserModel.findById(userId).select('name email phone').lean();
    notifyAdminsTrainingCompleted({
      userId,
      name: user?.name ?? 'A partner',
      email: user?.email ?? '',
      phone: user?.phone ?? undefined,
    });
  })().catch((err) => console.error('[onboarding] training-completed alert failed', err));
}

/** Fire-and-forget: email the partner that they can now log in and go online. */
function notifyPartnerTrainingApproved(userId: string): void {
  void (async () => {
    const user = await UserModel.findById(userId).select('name email').lean();
    if (!user?.email) return;
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    await mailService.sendPartnerTrainingApprovedEmail({
      name: user.name ?? 'Partner',
      email: user.email,
      loginUrl: `${frontendUrl}/login`,
    });
  })().catch((err) => console.error('[onboarding] training-approved email failed', err));
}

async function load(userId: string): Promise<Row> {
  const row = await PartnerModel.findOne({ userId }).select(SELECT).lean<Row | null>().exec();
  if (!row) throw Errors.notFound(ERROR_CODES.PARTNER_NOT_FOUND, 'Partner profile not found');
  return row;
}

interface Actor {
  id: string;
  ip: string;
}

async function audit(actor: Actor, action: string, userId: string, before: OnboardingStatus, after: OnboardingStatus) {
  try {
    await auditService.recordAudit({ actor: actor.id, action, entity: 'Partner', entityId: userId, before, after, ip: actor.ip, result: 'Success' });
  } catch {
    /* an audit failure must not undo the admin's decision */
  }
}

export const partnerOnboardingService = {
  async get(userId: string): Promise<OnboardingStatus> {
    return toStatus(await load(userId));
  },

  /**
   * Marks `step` done. Only the step the partner is on is accepted, so steps cannot be skipped or
   * completed twice. The filter makes this atomic: two quick taps cannot advance two steps.
   */
  async completeStep(userId: string, step: number): Promise<OnboardingStatus> {
    const current = toStatus(await load(userId));
    if (!current.eligible) throw Errors.forbidden('The demo opens after your account is approved');
    if (current.completed) return current;
    if (step !== current.currentStep) {
      throw Errors.conflict(ERROR_CODES.CONFLICT, `Finish step ${current.currentStep} first`);
    }
    const finishing = step === ONBOARDING_TOTAL_STEPS;
    const filter =
      step === 1
        ? { userId, 'kyc.status': 'approved', $or: [{ 'onboarding.completedSteps': { $exists: false } }, { 'onboarding.completedSteps': 0 }] }
        : { userId, 'kyc.status': 'approved', 'onboarding.completedSteps': step - 1 };
    const set: Record<string, unknown> = { 'onboarding.completedSteps': step };
    if (finishing) set['onboarding.completedAt'] = new Date();
    const updated = await PartnerModel.findOneAndUpdate(filter, { $set: set }, { new: true })
      .select(SELECT)
      .lean<Row | null>()
      .exec();
    if (!updated) return toStatus(await load(userId)); // lost a race: report where we really are
    // The filter above only matches once, so the admins are told exactly once, when the last step is done.
    if (finishing) notifyTrainingCompleted(userId);
    return toStatus(updated);
  },

  /** True when the partner may use the app. Partners whose KYC is not approved are not judged here. */
  async isCleared(userId: string): Promise<boolean> {
    const row = await PartnerModel.findOne({ userId }).select(SELECT).lean<Row | null>().exec();
    if (!row) return true; // no profile: other modules already deal with that
    const s = toStatus(row);
    return !s.eligible || s.approved;
  },

  /** Admin: where the partner is in the training. `userId` is the login user id used by /admin/partners/:id. */
  async adminGet(userId: string): Promise<OnboardingStatus> {
    return toStatus(await load(userId));
  },

  /** Admin: let a partner who finished all steps into the app. */
  async adminApprove(userId: string, actor: Actor): Promise<OnboardingStatus> {
    const before = toStatus(await load(userId));
    if (!before.eligible) throw Errors.badRequest('Approve the partner KYC first');
    if (!before.completed) throw Errors.conflict(ERROR_CODES.CONFLICT, `The partner has finished ${before.completedSteps} of ${before.totalSteps} steps`);
    if (before.approved) return before;
    const updated = await PartnerModel.findOneAndUpdate(
      { userId, 'onboarding.completedSteps': { $gte: ONBOARDING_TOTAL_STEPS } },
      { $set: { 'onboarding.approvedAt': new Date(), 'onboarding.approvedBy': actor.id } },
      { new: true },
    )
      .select(SELECT)
      .lean<Row | null>()
      .exec();
    const after = updated ? toStatus(updated) : await this.adminGet(userId);
    await audit(actor, 'partner.training.approve', userId, before, after);
    if (updated) notifyPartnerTrainingApproved(userId);
    return after;
  },

  /** Admin: send the partner back to step 1 and remove access until they finish again and are approved. */
  async adminReset(userId: string, actor: Actor): Promise<OnboardingStatus> {
    const before = toStatus(await load(userId));
    const updated = await PartnerModel.findOneAndUpdate(
      { userId },
      { $set: { 'onboarding.completedSteps': 0 }, $unset: { 'onboarding.completedAt': '', 'onboarding.approvedAt': '', 'onboarding.approvedBy': '' } },
      { new: true },
    )
      .select(SELECT)
      .lean<Row | null>()
      .exec();
    const after = updated ? toStatus(updated) : before;
    await audit(actor, 'partner.training.reset', userId, before, after);
    return after;
  },
};