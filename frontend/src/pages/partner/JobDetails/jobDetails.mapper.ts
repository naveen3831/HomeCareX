import type { ApiJob, JobDetails } from "./jobDetails.types";

export const bookingCode = (id: string): string => `#${id.slice(-6).toUpperCase()}`;

export const mapJob = (api: ApiJob): JobDetails => {
  const address = [api.location.line1, api.location.area, api.location.city]
    .filter(Boolean)
    .join(", ");

  return {
    id: api.id,
    bookingCode: bookingCode(api.id),
    status: api.status,
    customer: {
      name: api.customer.name,
      phoneMasked: api.customer.phone || "—",
    },
    service: {
      name: api.service.name,
      quantity: api.service.quantity,
      durationMinutes: api.service.durationMinutes,
    },
    location: {
      address,
      city: api.location.city,
      pincode: api.location.pincode ?? null,
      coordinates: api.location.coordinates,
    },
    schedule: {
      scheduledAt: api.schedule.scheduledAt,
      slot: api.schedule.slot ?? null,
      startedAt: api.schedule.startedAt ?? null,
    },
    price: {
      total: api.price.total,
      partnerEarning: api.price.partnerEarning,
      currency: api.price.currency,
    },
    payment: {
      status: api.payment.status,
      amount: api.price.total,
    },
    addOns: api.addOns,
    instructions: api.instructions,
    checklist: api.checklist,
    actions: api.actions,
    otpRequired: api.otpRequired,
    history: api.statusHistory.map((entry) => ({
      status: entry.to,
      at: entry.at,
      actor: entry.actorRole === "system" ? "System" : entry.actorRole,
    })),
  };
};
