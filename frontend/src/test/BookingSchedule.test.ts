import { describe, expect, it } from "vitest";
import {
  phaseOf,
  pillFor,
  type BookingListItem,
} from "@/pages/customer/Bookings/bookingModel";

const NOW = new Date("2026-10-21T07:00:00Z").getTime(); // 12:30 IST
const booking = (overrides: Partial<BookingListItem> = {}): BookingListItem =>
  ({
    status: "confirmed",
    date: "2026-10-15",
    slot: "10:00-12:00",
    ...overrides,
  }) as BookingListItem;

describe("booking schedule classification", () => {
  it("shows the old Confirmed bookings from the screenshots as Overdue, never Completed", () => {
    for (const date of ["2026-10-15", "2026-10-16", "2026-10-19"]) {
      const b = booking({ date });
      expect(phaseOf(b, NOW)).toBe("overdue");
      expect(pillFor(b, NOW).label).toBe("Overdue");
      expect(b.status).toBe("confirmed");
    }
  });

  it("keeps future appointments and today's unfinished window Upcoming", () => {
    expect(phaseOf(booking({ date: "2026-10-22" }), NOW)).toBe("upcoming");
    expect(
      phaseOf(booking({ date: "2026-10-21", slot: "12:00-14:00" }), NOW),
    ).toBe("upcoming");
    expect(phaseOf(booking({ date: "2026-10-21" }), NOW)).toBe("overdue");
  });

  it("moves the booking at the slot end, independently of browser timezone", () => {
    const b = booking({ date: "2026-10-21" });
    expect(phaseOf(b, new Date("2026-10-21T06:29:59Z").getTime())).toBe(
      "upcoming",
    );
    expect(phaseOf(b, new Date("2026-10-21T06:30:00Z").getTime())).toBe(
      "overdue",
    );
    expect(
      phaseOf(
        booking({ date: "2026-10-20", slot: "18:00-20:00" }),
        new Date("2026-10-20T18:31:00Z").getTime(),
      ),
    ).toBe("overdue");
  });

  it("preserves Live, Completed, cancellation and expired-hold classifications", () => {
    expect(phaseOf(booking({ status: "in_progress" }), NOW)).toBe("live");
    expect(phaseOf(booking({ status: "completed" }), NOW)).toBe("completed");
    expect(phaseOf(booking({ status: "rated" }), NOW)).toBe("completed");
    expect(phaseOf(booking({ status: "cancelled_by_customer" }), NOW)).toBe(
      "cancelled",
    );
    expect(
      phaseOf(
        booking({
          status: "pending_payment",
          holdExpiresAt: "2026-10-15T06:30:00Z",
        }),
        NOW,
      ),
    ).toBe("cancelled");
  });

  it("handles legacy scheduledAt records without inventing a slot duration", () => {
    expect(
      phaseOf(booking({ date: "", scheduledAt: "2026-10-15T04:30:00Z" }), NOW),
    ).toBe("overdue");
    expect(
      phaseOf(booking({ date: "", scheduledAt: "2026-10-22T04:30:00Z" }), NOW),
    ).toBe("upcoming");
    expect(
      phaseOf(booking({ date: "", scheduledAt: "2026-10-21T04:30:00Z" }), NOW),
    ).toBe("upcoming");
    expect(phaseOf(booking({ date: "", scheduledAt: "invalid" }), NOW)).toBe(
      "upcoming",
    );
  });
});
