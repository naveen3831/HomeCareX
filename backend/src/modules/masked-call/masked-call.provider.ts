/**
 * Masked call provider contract. A real provider (Twilio Proxy, Exotel, ...) implements this
 * interface; the app only ever depends on the interface, so swapping providers touches one file.
 *
 * Neither party's real number is ever returned to the other: the partner dials `proxyNumber`,
 * the provider bridges it to the customer for the lifetime of the session.
 */
export interface MaskedCallRequest {
  bookingId: string;
  /** Real numbers go to the provider only. They must never appear in an API response. */
  partnerPhone: string;
  customerPhone: string;
  /** Session lifetime in seconds. */
  ttlSeconds: number;
}

export interface MaskedCallSession {
  sessionId: string;
  proxyNumber: string;
  expiresAt: Date;
}

export interface MaskedCallProvider {
  readonly name: string;
  createSession(request: MaskedCallRequest): Promise<MaskedCallSession>;
}

/** Development / test provider: no network, always returns the same proxy number. */
export class StubMaskedCallProvider implements MaskedCallProvider {
  readonly name = "stub";

  constructor(
    private readonly proxyNumber = process.env.MASKED_CALL_PROXY_NUMBER ||
      "+918000000000",
  ) {}

  async createSession(request: MaskedCallRequest): Promise<MaskedCallSession> {
    return {
      sessionId: `stub_${request.bookingId}_${Date.now()}`,
      proxyNumber: this.proxyNumber,
      expiresAt: new Date(Date.now() + request.ttlSeconds * 1000),
    };
  }
}

let provider: MaskedCallProvider = new StubMaskedCallProvider();
export const getMaskedCallProvider = (): MaskedCallProvider => provider;
/** Used by tests, and at startup once a real provider is configured. */
export const setMaskedCallProvider = (p: MaskedCallProvider): void => {
  provider = p;
};
