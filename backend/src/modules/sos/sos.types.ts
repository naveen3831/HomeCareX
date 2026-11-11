import type { SosStatus } from "./SosAlert";

export interface SosLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

export interface SosAlertDto {
  id: string;
  partnerId: string;
  bookingId: string | null;
  location: SosLocation | null;
  status: SosStatus;
  triggeredAt: string;
  /** Only on the live admin socket event, so the alert can show who needs help without another request. */
  partnerName?: string;
  partnerPhone?: string;
}

export interface TriggerSosResultDto {
  alert: SosAlertDto;
  /** True when the same partner already had an active alert in the last minute, so no second alert was raised. */
  duplicate: boolean;
}
