import http, { type ApiResponse } from '@/lib/http';

/**
 * not_eligible       KYC not approved yet: no demo.
 * training           the partner is watching the demo and resumes at currentStep.
 * awaiting_approval  every step is done; the partner waits for an admin and has no access.
 * approved           an admin approved: the partner can use the app.
 */
export type OnboardingStage = 'not_eligible' | 'training' | 'awaiting_approval' | 'approved';

export interface OnboardingStatus {
  /** true once the admin has approved the partner KYC. */
  eligible: boolean;
  totalSteps: number;
  completedSteps: number;
  /** 1-based step the partner must do next, or null when every step is done. */
  currentStep: number | null;
  completed: boolean;
  completedAt: string | null;
  stage: OnboardingStage;
  /** true only when an admin approved the finished training. */
  approved: boolean;
  approvedAt: string | null;
}

/** GET /partner/onboarding: where the partner stopped. */
export async function fetchOnboarding(): Promise<OnboardingStatus> {
  const res = await http.get<ApiResponse<OnboardingStatus>>('/partner/onboarding');
  return res.data.data;
}

/** POST /partner/onboarding/steps/:step/complete. The server only accepts the step the partner is on. */
export async function completeOnboardingStep(step: number): Promise<OnboardingStatus> {
  const res = await http.post<ApiResponse<OnboardingStatus>>(`/partner/onboarding/steps/${step}/complete`);
  return res.data.data;
}

/** Readable message from an axios-style error. */
export function onboardingErrorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  return typeof message === 'string' && message ? message : fallback;
}
