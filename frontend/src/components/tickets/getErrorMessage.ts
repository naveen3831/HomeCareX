/** Pulls a readable message out of an unknown thrown value (axios-style or Error). */
export function getErrorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (typeof err === "object" && err !== null && "response" in err) {
    const response = (err as { response?: { data?: { message?: unknown; error?: unknown } } })
      .response;
    const msg = response?.data?.message ?? response?.data?.error;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** HTTP status from an axios-style error, if any. */
export function getErrorStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null && "response" in err) {
    const status = (err as { response?: { status?: unknown } }).response?.status;
    if (typeof status === "number") return status;
  }
  return undefined;
}
