// Backend Config: environment
// Getters read process.env lazily because dotenv.config() runs after the app modules are imported.
export const environmentConfig = {
  get nodeEnv(): string {
    return process.env.NODE_ENV ?? 'development';
  },
  get jwtSecret(): string | undefined {
    return process.env.JWT_SECRET || undefined;
  },
  get redisUrl(): string | undefined {
    return process.env.REDIS_URL || undefined;
  },
  /** HomeCareX UPI ID the customer pays to when the partner shows the QR code (e.g. homecarex@okhdfcbank). */
  get upiPayeeId(): string | undefined {
    return process.env.UPI_PAYEE_ID?.trim() || undefined;
  },
  get upiPayeeName(): string {
    return process.env.UPI_PAYEE_NAME?.trim() || 'HomeCareX';
  },
};