import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import http, { type ApiResponse } from "@/lib/http";
import { useAuth } from "@/hooks/useAuth";
import { normalizeApiError, type NormalizedApiError } from "@/services/bookingApi";
import { customerKeys } from "./api";

export const NOTIFICATION_TOPICS = ["booking", "payment", "offers", "reminders", "support"] as const;
export const NOTIFICATION_CHANNELS = ["push", "sms", "email", "inApp"] as const;
export const LANGUAGES = ["en", "hi", "te"] as const;

export type NotificationTopic = (typeof NOTIFICATION_TOPICS)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type Language = (typeof LANGUAGES)[number];
export type NotificationMatrix = Record<NotificationTopic, Record<NotificationChannel, boolean>>;

export interface ProfileDto {
  id: string;
  name: string;
  email: string;
  phone?: string;
  /** Small data URL of the profile photo, when one was uploaded. */
  avatarUrl?: string;
}
/** phone: "" or null removes the number. */
export interface ProfilePatch {
  name?: string;
  email?: string;
  phone?: string | null;
}
export interface PreferencesDto {
  language: Language;
  notifications: NotificationMatrix;
}
export interface PreferencesPatch {
  language?: Language;
  notifications?: Partial<{ [T in NotificationTopic]: Partial<Record<NotificationChannel, boolean>> }>;
}
export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export const profileKeys = {
  profile: (userId: string | undefined) => ["customer", "profile", userId ?? "anonymous"] as const,
  preferences: (userId: string | undefined) => ["customer", "preferences", userId ?? "anonymous"] as const,
};

/** Wraps a request so every failure is a NormalizedApiError (status, code, message, details). */
async function call<T>(run: () => Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    return (await run()).data.data;
  } catch (err) {
    throw normalizeApiError(err);
  }
}

export const profileApi = {
  get: () => call<{ profile: ProfileDto }>(() => http.get("/customer/profile")).then((d) => d.profile),
  update: (patch: ProfilePatch) =>
    call<{ profile: ProfileDto }>(() => http.patch("/customer/profile", patch)).then((d) => d.profile),
  /** The cropped image is sent as the raw request body. */
  uploadAvatar: (image: Blob) =>
    call<{ profile: ProfileDto }>(() =>
      http.post("/customer/profile/avatar", image, { headers: { "Content-Type": image.type || "image/jpeg" }, timeout: 30_000 }),
    ).then((d) => d.profile),
  removeAvatar: () => call<{ profile: ProfileDto }>(() => http.delete("/customer/profile/avatar")).then((d) => d.profile),
  getPreferences: () =>
    call<{ preferences: PreferencesDto }>(() => http.get("/customer/preferences")).then((d) => d.preferences),
  updatePreferences: (patch: PreferencesPatch) =>
    call<{ preferences: PreferencesDto }>(() => http.patch("/customer/preferences", patch)).then((d) => d.preferences),
  /** Permanently deletes the signed-in customer's account. */
  deleteAccount: () => call<{ deleted: boolean }>(() => http.delete("/customer/profile")),
  changePassword: (input: ChangePasswordInput) =>
    call<{ changed: boolean }>(() => http.post("/auth/change-password", input)),
};

/** Retry blips and 5xx; a 4xx can't be fixed by trying again. */
const retryTransient = (count: number, error: NormalizedApiError) => count < 2 && (error.status === 0 || error.status >= 500);

/** GET /customer/profile */
export function useProfile() {
  const { user } = useAuth();
  return useQuery<ProfileDto, NormalizedApiError>({
    queryKey: profileKeys.profile(user?.id),
    queryFn: profileApi.get,
    staleTime: 30_000,
    retry: retryTransient,
  });
}

/** After a profile change: cache it, mirror name/email/phone into the signed-in session, refresh the dashboard. */
function useApplyProfile() {
  const qc = useQueryClient();
  const { user, updateProfile } = useAuth();
  return (profile: ProfileDto) => {
    qc.setQueryData(profileKeys.profile(user?.id), profile);
    updateProfile({ name: profile.name, email: profile.email, phone: profile.phone });
    void qc.invalidateQueries({ queryKey: customerKeys.dashboard(user?.id) });
  };
}

/** PATCH /customer/profile. A taken email/phone comes back as a 409 with a field-level detail. */
export function useUpdateProfile() {
  const apply = useApplyProfile();
  return useMutation<ProfileDto, NormalizedApiError, ProfilePatch>({ mutationFn: profileApi.update, onSuccess: apply });
}

export function useUploadAvatar() {
  const apply = useApplyProfile();
  return useMutation<ProfileDto, NormalizedApiError, Blob>({ mutationFn: profileApi.uploadAvatar, onSuccess: apply });
}

export function useRemoveAvatar() {
  const apply = useApplyProfile();
  return useMutation<ProfileDto, NormalizedApiError, void>({ mutationFn: profileApi.removeAvatar, onSuccess: apply });
}

/** POST /auth/change-password */
export function useChangePassword() {
  return useMutation<{ changed: boolean }, NormalizedApiError, ChangePasswordInput>({ mutationFn: profileApi.changePassword });
}

/** DELETE /customer/profile. A 409 explains what blocks it (an open booking or a wallet balance). */
export function useDeleteAccount() {
  return useMutation<{ deleted: boolean }, NormalizedApiError, void>({ mutationFn: profileApi.deleteAccount });
}

/** GET /customer/preferences (notification matrix + language) */
export function usePreferences() {
  const { user } = useAuth();
  return useQuery<PreferencesDto, NormalizedApiError>({
    queryKey: profileKeys.preferences(user?.id),
    queryFn: profileApi.getPreferences,
    staleTime: 30_000,
    retry: retryTransient,
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation<PreferencesDto, NormalizedApiError, PreferencesPatch>({
    mutationFn: profileApi.updatePreferences,
    onSuccess: (prefs) => qc.setQueryData(profileKeys.preferences(user?.id), prefs),
  });
}

/**
 * Turns a failed request into messages for the form: per-field messages when the server sent them (409 email/phone,
 * 400 validation), otherwise one message for the whole form.
 */
export function describeError(err: NormalizedApiError | null | undefined): { fields: Record<string, string>; form?: string } {
  if (!err) return { fields: {} };
  const fields: Record<string, string> = {};
  for (const d of (err.details ?? []) as { field?: string; path?: string; message: string }[]) {
    const key = d.field ?? d.path;
    if (key && !fields[key]) fields[key] = d.message;
  }
  if (err.code === "EMAIL_ALREADY_EXISTS") fields.email ??= "That email is already in use";
  if (err.code === "PHONE_ALREADY_EXISTS") fields.phone ??= "That phone number is already in use";
  if (err.code === "INVALID_CURRENT_PASSWORD") fields.currentPassword ??= "Current password is incorrect";
  if (err.code === "AVATAR_TOO_LARGE" || err.code === "AVATAR_UNSUPPORTED_TYPE") fields.avatar = err.message;

  if (Object.keys(fields).length) return { fields };
  if (err.code === "NETWORK_ERROR" || err.status === 0) return { fields, form: "We couldn't reach the server. Check your connection and try again." };
  if (err.status >= 500) return { fields, form: "Something went wrong on our side. Please try again." };
  return { fields, form: err.message || "Something went wrong. Please try again." };
}
