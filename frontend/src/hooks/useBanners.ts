import { useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { BANNERS } from "@/constants/mock/public";
import { fetchHomeBanners, type ApiBanner } from "@/services/bannerApi";
import { retryTransient } from "@/services/catalogApi";

export interface SliderBanner {
  id: string;
  title: string;
  description: string;
  image: string;
  link: string;
  category: string;
  alt: string;
}

// Mocks are opt-in only, so a missing env var can never ship mock data to production.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const DEFAULT_CATEGORY = "Home services";

const mockBannerSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  image: z.string(),
  buttonText: z.string().optional(),
  link: z.string(),
});

const mockBannersSchema = z.array(mockBannerSchema);

function toSliderBanner(
  banner: Pick<ApiBanner, "id" | "title" | "description" | "image" | "link"> &
    Partial<Pick<ApiBanner, "category" | "alt">>,
): SliderBanner {
  return {
    id: banner.id,
    title: banner.title,
    description: banner.description,
    image: banner.image,
    link: banner.link,
    category: banner.category ?? DEFAULT_CATEGORY,
    alt: banner.alt ?? banner.title,
  };
}

function getMockBanners(): SliderBanner[] {
  return mockBannersSchema.parse(BANNERS).map(toSliderBanner);
}

// The error type retryTransient expects (NormalizedApiError), so no cast is needed.
type RetryError = Parameters<typeof retryTransient>[1];

export function useBanners() {
  return useQuery<SliderBanner[], RetryError>({
    // Including the data source keeps mock and real data from sharing a cache entry.
    queryKey: ["public", "banners", "home", USE_MOCKS ? "mock" : "api"],

    queryFn: async ({ signal }) => {
      if (USE_MOCKS) {
        return getMockBanners();
      }
      const banners = await fetchHomeBanners(signal);
      return banners.map(toSliderBanner);
    },

    staleTime: 60_000,

    retry: (failureCount, error) => retryTransient(failureCount, error),
  });
}