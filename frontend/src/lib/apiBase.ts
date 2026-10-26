const configuredBase = (import.meta.env.VITE_API_BASE_URL ?? "/api").trim().replace(/\/+$/, "");

export const apiBaseUrl = /\/api\/v1$/i.test(configuredBase)
  ? configuredBase
  : /\/api$/i.test(configuredBase)
    ? `${configuredBase}/v1`
    : `${configuredBase}/api/v1`;
