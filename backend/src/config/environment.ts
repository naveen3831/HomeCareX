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
  /** Key for encrypting saved bank account numbers. Set BANK_DATA_KEY in production; development falls back to JWT_SECRET. */
  get bankDataKey(): string | undefined {
    const k = process.env.BANK_DATA_KEY?.trim();
    if (k) return k;
    return process.env.NODE_ENV === 'production' ? undefined : process.env.JWT_SECRET || undefined;
  },
  get upiPayeeName(): string {
    return process.env.UPI_PAYEE_NAME?.trim() || 'HomeCareX';
  },
};