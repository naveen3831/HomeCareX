import type { UserRole } from '../../models/User';

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  permissions: string[];
  /** Landing route for this role (/customer, /partner, /admin). */
  home: string;
  /** Staff role chosen at invite time (rbac module will resolve it to a real Role). */
  staffRoleId?: string;
}

export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
  sid?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  v: number;
  sid?: string;
}

export class HttpError extends Error {
  details?: { field: string; message: string }[];

  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}
