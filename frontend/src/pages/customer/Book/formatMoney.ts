/** Whole rupees, e.g. 1499 -> "₹1,499". Display only; the client never does price arithmetic. */
export function formatINR(amount?: number | null): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) {
    return "₹0";
  }
  return `₹${amount.toLocaleString("en-IN")}`;
}
