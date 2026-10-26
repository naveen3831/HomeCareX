import api from '@/lib/api';

export interface SosLocation {
  lat: number;
  lng: number;
  accuracy?: number;
}

/** Mirrors backend SosAlertDto (backend/src/modules/sos/sos.types.ts). */
export interface SosAlert {
  id: string;
  partnerId: string;
  bookingId: string | null;
  location: SosLocation | null;
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: string;
}

export interface SosResult {
  alert: SosAlert;
  /** True when this partner already had an active alert in the last minute, so no second alert was raised. */
  duplicate: boolean;
}

export interface SosInput {
  bookingId?: string | null;
  location?: SosLocation | null;
  note?: string;
}

const OBJECT_ID = /^[a-f\d]{24}$/i;

/** POST /partner/safety/sos. Never rejects because of a demo job id: the booking is only sent when it is a real one. */
export async function sendSos(input: SosInput = {}): Promise<SosResult> {
  const body: Record<string, unknown> = {};
  if (input.bookingId && OBJECT_ID.test(input.bookingId)) body.bookingId = input.bookingId;
  if (input.location) {
    body.location = {
      lat: input.location.lat,
      lng: input.location.lng,
      ...(typeof input.location.accuracy === 'number' ? { accuracy: input.location.accuracy } : {}),
    };
  }
  if (input.note?.trim()) body.note = input.note.trim();

  const res = await api.post<{ data: SosResult }>('/partner/safety/sos', body);
  return res.data.data;
}

/**
 * One quick location fix for an SOS. Resolves to null when permission is denied, unsupported or slow,
 * so an alert is never held back waiting for GPS.
 */
export function getQuickFix(timeoutMs = 4000): Promise<SosLocation | null> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        window.clearTimeout(timer);
        resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
      },
      () => {
        window.clearTimeout(timer);
        resolve(null);
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}