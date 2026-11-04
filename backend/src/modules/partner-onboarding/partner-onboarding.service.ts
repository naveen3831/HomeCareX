import { Types } from 'mongoose';
import PartnerModel from '../../models/Partner';
import { ERROR_CODES } from '../../constants/errorCodes';
import { Errors } from '../../utils/errors';
import { auditService } from '../audit/audit.service';

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
  _id?: unknown;
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

/** Training stage of a partner profile (used by the admin partner list). Accepts a Mongoose document or a lean row. */
export const trainingStageOf = (profile: {
  kyc?: { status?: string | null } | null;
  onboarding?: { completedSteps?: number | null; completedAt?: Date | null; approvedAt?: Date | null } | null;
}): OnboardingStage =>
  toStatus({
    kyc: { status: profile.kyc?.status ?? undefined },
    onboarding: {
      completedSteps: profile.onboarding?.completedSteps ?? undefined,
      completedAt: profile.onboarding?.completedAt ?? undefined,
      approvedAt: profile.onboarding?.approvedAt ?? undefined,
    },
  }).stage;

const SELECT = 'kyc.status onboarding';

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
    const row = await load(userId);
    const status = toStatus(row);
    console.log(`[partner-onboarding] partner checks status user=${userId} stage=${status.stage} approved=${status.approved} steps=${status.completedSteps}`);
    return status;
  },

  /**
   * Marks `step` done. Only the step the partner is on is accepted, so steps cannot be skipped or
   * completed twice. The filter makes this atomic: two quick taps cannot advance two steps.
   */
  async completeStep(userId: string, step: number): Promise<OnboardingStatus> {
    const row = await load(userId);
    const current = toStatus(row);
    console.log(`[partner-onboarding] completeStep v3 user=${userId} step=${step} stored=${JSON.stringify(row.onboarding)} kyc=${row.kyc?.status}`);
    if (!current.eligible) throw Errors.forbidden('The demo opens after your account is approved');
    if (current.completed) return current;
    if (step !== current.currentStep) {
      throw Errors.conflict(ERROR_CODES.CONFLICT, `Finish step ${current.currentStep} first`);
    }
    const set: Record<string, unknown> = { 'onboarding.completedSteps': step, updatedAt: new Date() };
    if (step === ONBOARDING_TOTAL_STEPS) set['onboarding.completedAt'] = new Date();
    // Native driver, targeted by _id: no Mongoose casting or strict-mode stripping can interfere.
    // The filter only skips the write when the counter is already at or past `step` (double tap).
    const result = await PartnerModel.collection.updateOne(
      { _id: row._id as never, 'onboarding.completedSteps': { $not: { $gte: step } } },
      { $set: set },
    );
    const after = await load(userId);
    console.log(`[partner-onboarding] completeStep result matched=${result.matchedCount} modified=${result.modifiedCount} now=${JSON.stringify(after.onboarding)}`);
    return toStatus(after);
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
    const row = await load(userId);
    const before = toStatus(row);
    if (!before.eligible) throw Errors.badRequest('Approve the partner KYC first');
    if (!before.completed) throw Errors.conflict(ERROR_CODES.CONFLICT, `The partner has finished ${before.completedSteps} of ${before.totalSteps} steps`);
    if (before.approved) return before;
    // Native driver, targeted by _id (same reason as completeStep: no Mongoose casting can drop the write).
    const now = new Date();
    const result = await PartnerModel.collection.updateOne(
      { _id: row._id as never },
      { $set: { 'onboarding.approvedAt': now, 'onboarding.approvedBy': new Types.ObjectId(actor.id), updatedAt: now } },
    );
    const after = toStatus(await load(userId));
    console.log(`[partner-onboarding] approve user=${userId} matched=${result.matchedCount} modified=${result.modifiedCount} approved=${after.approved}`);
    if (!after.approved) throw Errors.conflict(ERROR_CODES.CONFLICT, 'The approval could not be saved. Please try again.');
    await audit(actor, 'partner.training.approve', userId, before, after);
    return after;
  },

  /** Admin: send the partner back to step 1 and remove access until they finish again and are approved. */
  async adminReset(userId: string, actor: Actor): Promise<OnboardingStatus> {
    const row = await load(userId);
    const before = toStatus(row);
    const result = await PartnerModel.collection.updateOne(
      { _id: row._id as never },
      {
        $set: { 'onboarding.completedSteps': 0, updatedAt: new Date() },
        $unset: { 'onboarding.completedAt': '', 'onboarding.approvedAt': '', 'onboarding.approvedBy': '' },
      },
    );
    const after = toStatus(await load(userId));
    console.log(`[partner-onboarding] reset user=${userId} matched=${result.matchedCount} modified=${result.modifiedCount} completedSteps=${after.completedSteps}`);
    if (after.completedSteps !== 0) throw Errors.conflict(ERROR_CODES.CONFLICT, 'The reset could not be saved. Please try again.');
    await audit(actor, 'partner.training.reset', userId, before, after);
    return after;
  },
};