export type UserRole = "admin" | "customer" | "partner";
 
export const ADMIN_ROLES: UserRole[] = ["admin"];
 
/** 'expired' = a previously valid session ended (401 / refresh failed). */
export type AuthStatus = "loading" | "authenticated" | "unauthenticated" | "expired";
 
export interface AuthUser {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  /** resource:action keys; ['*'] for admin. */
  permissions: string[];
  /** Landing route for the role: /customer, /partner or /admin. */
  home: string;
}
 
export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword?: string;
  referralCode?: string;
  role?: "customer" | "partner";
  avatar?: string;
  dob?: string;
  gender?: 'male' | 'female' | 'other' | string;
  idProofType?: string;
  idProofNumber?: string;
  idProofDocument?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  addressProofDocument?: string;
  category?: string;
  categories?: string[];
  skills?: string[];
  experienceYears?: number;
  serviceRadiusKm?: number;
  workingDays?: string[];
  workingHoursStart?: string;
  workingHoursEnd?: string;
  accountHolder?: string;
  accountNumber?: string;
  ifsc?: string;
  upiId?: string;
}

export type ProfilePatch = Partial<Pick<AuthUser, "name" | "email" | "phone">>;

export interface AuthContextValue {
  user: AuthUser | null;
  status: AuthStatus;
  isAuthenticated: boolean;
  /** Signs in and returns the user so the caller can redirect by role. */
  login: (input: LoginInput) => Promise<AuthUser>;
  /** Registers a new account and establishes a session. */
  register: (input: RegisterInput) => Promise<AuthUser>;
  /** Shared logout: ends the session on the server and clears local state. */
  logout: () => Promise<void>;
  /** Updates the signed-in user's editable details in the local session (no backend endpoint yet). */
  updateProfile: (patch: ProfilePatch) => void;
}

export interface UserSession {
  id: string;
  device?: string;
  browser?: string;
  os?: string;
  ipAddress?: string;
  lastActiveAt: string;
  createdAt?: string;
  isCurrent?: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}

export interface ChangePasswordResult {
  changed: boolean;
}

export interface SessionRevokeResult {
  revoked: boolean;
}

export interface LogoutAllResult {
  revoked: boolean;
}

export interface RevokeUserSessionsResult {
  revoked: boolean;
}

