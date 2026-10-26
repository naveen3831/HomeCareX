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
}

export interface TriggerSosResultDto {
  alert: SosAlertDto;
  /** True when the same partner already had an active alert in the last minute, so no second alert was raised. */
  duplicate: boolean;
}
