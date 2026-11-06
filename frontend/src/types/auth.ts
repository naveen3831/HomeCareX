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

/** POST /auth/register result. Partners get no session: `pendingApproval` is set and accessToken is absent. */
export interface RegisterResult {
  user: AuthUser;
  accessToken?: string;
  pendingApproval?: boolean;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword?: string;
  referralCode?: string;
  role?: "customer" | "partner";

  /* ---- Partner registration: personal ---- */
  /** Profile photo as a data URL. */
  avatar?: string;
  gender?: string;
  /** Date of birth, YYYY-MM-DD. */
  dob?: string;

  /* ---- Partner registration: identity proof ---- */
  idProofType?: string;
  idProofNumber?: string;
  idProofDocument?: string;

  /* ---- Partner registration: address proof ---- */
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  addressProofDocument?: string;

  /* ---- Partner registration: professional ---- */
  category?: string;
  skills?: string[];
  experienceYears?: number;
  bio?: string;
  serviceRadiusKm?: number;
  workingDays?: string[];
  workingHoursStart?: string;
  workingHoursEnd?: string;

  /* ---- Partner registration: payout ---- */
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

/** One active login session as returned by GET /auth/sessions. Never contains tokens. */
export interface UserSession {
  id: string;
  device: string;
  browser: string;
  os?: string;
  ipAddress: string;
  lastActiveAt: string; // ISO date
  isCurrent: boolean;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResult {
  changed: boolean;
}

export interface RevokeResult {
  revoked: boolean;
}