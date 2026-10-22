
import { z } from "zod";
import http from "@/lib/http";
import { normalizeApiError } from "./bookingApi";

const bannerSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  description: z.string().default(""),
  image: z.string(),
  buttonText: z.string().optional(),
  category: z.string().optional(),
  alt: z.string().optional(),
  link: z.string().default("/services"),
});

const bannerResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(bannerSchema),
});

export type ApiBanner = z.infer<typeof bannerSchema>;

export async function fetchHomeBanners(
  signal?: AbortSignal,
): Promise<ApiBanner[]> {
  try {
    const response = await http.get("/banners", {
      params: { placement: "home" },
      signal,
    });

    return bannerResponseSchema.parse(response.data).data;
  } catch (error) {
    throw normalizeApiError(error);
  }
}
