import React, { lazy, Suspense } from "react";
import { useBanners } from "@/hooks/useBanners";

const BannerSlider = lazy(() => import("./BannerSlider"));

/**
 * Banners added by the admin (Admin > Marketing) for the Home page.
 * Renders nothing while loading, on error, or when there is no live banner, so the
 * built-in sample slides of BannerSlider never show up on the real Home page.
 *
 * slot="middle" (default): HOME, HOME_TOP and HOME_MIDDLE banners, under the hero.
 * slot="bottom": HOME_BOTTOM banners, at the end of the page just above "Need help with your home?".
 */
const HomeBanners: React.FC<{
  className?: string;
  slot?: "middle" | "bottom";
  heightClass?: string;
}> = ({
  className,
  slot = "middle",
  heightClass,
}) => {
  const { data, isLoading, isError } = useBanners();

  if (isLoading || isError || !data || data.length === 0) return null;

  const banners = data.filter((banner) =>
    slot === "bottom"
      ? banner.placement === "HOME_BOTTOM"
      : banner.placement !== "HOME_BOTTOM",
  );

  if (banners.length === 0) return null;

  return (
    <div className={className}>
      <Suspense fallback={null}>
        <BannerSlider banners={banners} heightClass={heightClass} />
      </Suspense>
    </div>
  );
};

export default HomeBanners;