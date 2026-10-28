import { describe, expect, it } from "vitest";
import { withOverdueInUpcoming } from "@/services/bookingApi";

const base = { page: 1, limit: 10 };

describe("withOverdueInUpcoming", () => {
  it("asks the server for upcoming AND overdue when on the Upcoming tab", () => {
    const q = withOverdueInUpcoming({ ...base, tab: "upcoming" });
    expect(q.tab).toBeUndefined();
    expect(q.status).toBe("upcoming,overdue");
  });

  it("keeps a status the customer picked, without the tab's schedule cut-off", () => {
    const q = withOverdueInUpcoming({ ...base, tab: "upcoming", status: "assigned" });
    expect(q.tab).toBeUndefined();
    expect(q.status).toBe("assigned");
  });

  it("leaves the other tabs untouched", () => {
    for (const tab of ["live", "completed", "cancelled"] as const) {
      const input = { ...base, tab, status: "" };
      expect(withOverdueInUpcoming(input)).toBe(input);
    }
  });
});
