import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid service id");

/** Case-insensitive de-duplication that keeps the first spelling. */
const unique = (items: string[]): string[] => {
  const seen = new Set<string>();
  return items.filter((s) => {
    const key = s.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const servicesBodySchema = z
  .object({
    serviceIds: z
      .array(objectId, {
        required_error: "serviceIds is required",
        invalid_type_error: "serviceIds must be an array",
      })
      .max(50, "Choose at most 50 services")
      .transform((ids) => unique(ids.map((i) => i.toLowerCase()))),
  })
  .strict();

const place = (label: string, max: number) =>
  z
    .string({ invalid_type_error: `${label} must be text` })
    .trim()
    .min(2, `${label} must be at least 2 characters`)
    .max(max, `${label} must be at most ${max} characters`);

export const serviceAreaBodySchema = z
  .object({
    baseLocation: z
      .object(
        {
          lat: z
            .number({
              required_error: "baseLocation.lat is required",
              invalid_type_error: "baseLocation.lat must be a number",
            })
            .min(-90)
            .max(90),
          lng: z
            .number({
              required_error: "baseLocation.lng is required",
              invalid_type_error: "baseLocation.lng must be a number",
            })
            .min(-180)
            .max(180),
          label: z.string().trim().max(120).optional(),
        },
        { required_error: "baseLocation is required" },
      )
      .strict(),
    cities: z
      .array(place("City", 60), {
        required_error: "cities is required",
        invalid_type_error: "cities must be an array",
      })
      .min(1, "Add at least one city")
      .max(20, "Choose at most 20 cities")
      .transform(unique),
    areas: z
      .array(place("Area", 80))
      .max(50, "Choose at most 50 areas")
      .transform(unique)
      .default([]),
    radiusKm: z
      .number({
        required_error: "radiusKm is required",
        invalid_type_error: "radiusKm must be a number",
      })
      .int("radiusKm must be a whole number")
      .min(1, "radiusKm must be at least 1")
      .max(50, "radiusKm must be at most 50"),
  })
  .strict();

export type ServicesBody = z.infer<typeof servicesBodySchema>;
export type ServiceAreaBody = z.infer<typeof serviceAreaBodySchema>;
