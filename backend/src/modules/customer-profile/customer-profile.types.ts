import type { Language, NotificationMatrix } from './customer-profile.constants';

export interface ProfileView {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
}

export interface PreferencesView {
  language: Language;
  notifications: NotificationMatrix;
}

export interface ProfilePatch {
  name?: string;
  email?: string;
  phone?: string | null;
}

export interface PreferencesPatch {
  language?: Language;
  notifications?: Partial<{ [T in keyof NotificationMatrix]: Partial<NotificationMatrix[T]> }>;
}

/** The slice of a user document this module reads and writes. */
export interface ProfileDoc {
  _id: unknown;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  avatar?: string | null;
  language?: string | null;
  notificationPrefs?: unknown;
}
