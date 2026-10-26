import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useBanners } from "@/hooks/useBanners";
import { safeAlt, safeText } from "@/lib/querySanitize";
/* =====================================================================
 * TYPES & DATA
 * ===================================================================== */

export interface Banner {
  id: string;
  category: string;
  title: string;
  description: string;
  image: string;
  alt: string;
  link: string;
}

const defaultBanners: Banner[] = [
  {
    id: "BANNER001",
    category: "Home maintenance",
    title: "Quality home services, from people you can trust",
    description:
      "Find reliable professionals for your everyday home service needs.",
    image: "/images/home-maintenance.webp",
    alt: "Technician carrying out home maintenance work",
    link: "/services",
  },
  {
    id: "BANNER002",
    category: "Home cleaning",
    title: "A cleaner home, booked in minutes",
    description:
      "Choose a service, pick a convenient slot, and we take care of the rest.",
    image: "/images/home-cleaning.webp",
    alt: "Professional cleaning a living room",
    link: "/services",
  },
  {
    id: "BANNER003",
    category: "Plumbing",
    title: "Leaks and blockages fixed right the first time",
    description:
      "Experienced plumbers for repairs, fittings and emergency callouts.",
    image: "/images/plumbing-1200.webp",
    alt: "Plumber repairing a pipe",
    link: "/services",
  },
  {
    id: "BANNER004",
    category: "Electrical",
    title: "Safe, certified electrical work at home",
    description:
      "From a single switch to full rewiring, book a qualified electrician.",
    image: "/images/electrical.webp",
    alt: "Electrician working on a wiring panel",
    link: "/services",
  },
  {
    id: "BANNER005",
    category: "Painting",
    title: "Give your walls a fresh, clean finish",
    description:
      "Skilled painters for interiors and exteriors, with minimal mess.",
    image: "/images/painting.webp",
    alt: "Painter painting a wall",
    link: "/services",
  },
  {
    id: "BANNER006",
    category: "Appliance repair",
    title: "Appliance repair at your doorstep",
    description:
      "Get your washing machine, fridge or AC working again without the hassle.",
    image: "/images/appliance-repair.webp",
    alt: "Technician repairing a home appliance",
    link: "/services",
  },
];

const AUTOPLAY_MS = 3000;
const SWIPE_THRESHOLD_PX = 50;

/**
 * Banner links come from the API. Only an in-site path ("/services") or an
 * http(s) URL is allowed; "javascript:", "data:" and "//evil.com" fall back to /services.
 */
const safeLink = (value: unknown): string => {
  if (typeof value !== "string") return "/services";

  const link = value.trim();

  if (/^\/(?!\/)/.test(link)) return link;
  if (/^https?:\/\//i.test(link)) return link;

  return "/services";
};

/* =====================================================================
 * ICONS
 * ===================================================================== */

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.25,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
};

const ChevronLeft = () => (
  <svg {...iconProps}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg {...iconProps}>
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const ArrowRight = () => (
  <svg {...iconProps} width={18} height={18}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const PauseIcon = () => (
  <svg {...iconProps} fill="currentColor" stroke="none">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);

const PlayIcon = () => (
  <svg {...iconProps} fill="currentColor" stroke="none">
    <path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" />
  </svg>
);

/* =====================================================================
 * COMPONENT
 * ===================================================================== */

interface BannerSliderProps {
  banners?: Banner[];
}

const controlButton =
  "flex h-11 w-11 items-center justify-center rounded-full border border-white/30 bg-white/15 text-white backdrop-blur-sm transition hover:bg-white hover:text-[#4338ca] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#312e81]";

const BannerSlider: React.FC<BannerSliderProps> = ({
  banners: suppliedBanners,
}) => {
  const { data: apiBanners, isError, isLoading } = useBanners();

  const banners =
    suppliedBanners ??
    (isError || (!isLoading && !apiBanners?.length)
      ? defaultBanners
      : apiBanners ?? []);

  const count = banners.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [hoverPaused, setHoverPaused] = useState(false);
  const [focusPaused, setFocusPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] =
    useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const sectionRef = useRef<HTMLElement>(null);
  const progressBarRef = useRef<HTMLSpanElement>(null);
  const elapsedRef = useRef(0);
  const touchStartX = useRef<number | null>(null);

  /* -------------------------------------------------------------------
   * REDUCED MOTION
   * ------------------------------------------------------------------- */

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    const update = () => {
      setPrefersReducedMotion(mediaQuery.matches);
    };

    update();

    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  /* -------------------------------------------------------------------
   * VISIBILITY
   * Autoplay (a requestAnimationFrame loop) only runs while the slider
   * is on screen, so it does not use the main thread while the visitor
   * is still looking at the hero.
   * ------------------------------------------------------------------- */

  useEffect(() => {
    const element = sectionRef.current;

    if (!element) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.2 }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [count]);

  /* -------------------------------------------------------------------
   * PREVIOUS / NEXT
   * ------------------------------------------------------------------- */

  const goToNext = useCallback(() => {
    setCurrentIndex((previous) => (previous + 1) % count);
  }, [count]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(
      (previous) => (previous - 1 + count) % count
    );
  }, [count]);

  /* Keep the index valid if the banner list changes. */

  useEffect(() => {
    if (count > 0 && currentIndex >= count) {
      setCurrentIndex(0);
    }
  }, [count, currentIndex]);

  /* -------------------------------------------------------------------
   * AUTOPLAY
   * ------------------------------------------------------------------- */

  const autoplayActive =
    count > 1 &&
    isVisible &&
    !hoverPaused &&
    !focusPaused &&
    !userPaused &&
    !prefersReducedMotion;

  /* Reset progress when the active slide changes. */

  useEffect(() => {
    elapsedRef.current = 0;

    if (progressBarRef.current) {
      progressBarRef.current.style.transform =
        prefersReducedMotion ? "scaleX(1)" : "scaleX(0)";
    }
  }, [currentIndex, prefersReducedMotion]);

  /* Animate progress and advance the slider. */

  useEffect(() => {
    if (!autoplayActive) return;

    let frameId = 0;
    let last = performance.now();

    const tick = (now: number) => {
      elapsedRef.current += now - last;
      last = now;

      const progress = Math.min(
        elapsedRef.current / AUTOPLAY_MS,
        1
      );

      if (progressBarRef.current) {
        progressBarRef.current.style.transform =
          `scaleX(${progress})`;
      }

      if (progress >= 1) {
        goToNext();
        return;
      }

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [autoplayActive, currentIndex, goToNext]);

  /* -------------------------------------------------------------------
   * HIDE WHEN THERE ARE NO BANNERS
   * ------------------------------------------------------------------- */

  if (count === 0) {
    return null;
  }

  /* -------------------------------------------------------------------
   * PAUSE ON KEYBOARD FOCUS
   * ------------------------------------------------------------------- */

  const handleFocus = (
    event: React.FocusEvent<HTMLElement>
  ) => {
    if (event.target.matches(":focus-visible")) {
      setFocusPaused(true);
    }
  };

  const handleBlur = (
    event: React.FocusEvent<HTMLElement>
  ) => {
    const next = event.relatedTarget as Node | null;

    if (!event.currentTarget.contains(next)) {
      setFocusPaused(false);
    }
  };

  /* -------------------------------------------------------------------
   * KEYBOARD NAVIGATION
   * ------------------------------------------------------------------- */

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLElement>
  ) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToPrevious();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      goToNext();
    }
  };

  /* -------------------------------------------------------------------
   * TOUCH SWIPE
   * ------------------------------------------------------------------- */

  const handleTouchStart = (
    event: React.TouchEvent
  ) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (
    event: React.TouchEvent
  ) => {
    if (touchStartX.current === null) return;

    const deltaX =
      event.changedTouches[0].clientX -
      touchStartX.current;

    touchStartX.current = null;

    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;

    if (deltaX < 0) {
      goToNext();
    } else {
      goToPrevious();
    }
  };

  const showControls = count > 1;

  const slideFade = prefersReducedMotion
    ? ""
    : "transition-opacity duration-700 ease-in-out";

  const contentMotion = prefersReducedMotion
    ? ""
    : "transition-all duration-700 ease-out";

  const imageMotion = prefersReducedMotion
    ? ""
    : "transition-transform duration-[6000ms] ease-out";

  const pad = (number: number) =>
    String(number).padStart(2, "0");

  /* -------------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------------- */

  return (
    <section
      ref={sectionRef}
      className="bg-white py-10 sm:py-14"
      aria-roledescription="carousel"
      aria-label="HomeCareX promotional banners"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div
          className="relative overflow-hidden rounded-3xl bg-[#312e81] shadow-xl shadow-indigo-900/20"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* ===================== SLIDES ===================== */}

          <div className="relative h-[420px] min-h-[420px] sm:h-[480px] sm:min-h-[480px] lg:h-[540px] lg:min-h-[540px]">
            {banners.map((banner, index) => {
              const isActive = index === currentIndex;

              /*
               * Render only the active banner and the next banner.
               * Other slides retain their content and controls but
               * do not create image elements until needed.
               */
              const isNext =
                index === (currentIndex + 1) % count;

              if (!isActive && !isNext) {
                return null;
              }

              return (
                <div
                  key={banner.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${count}`}
                  aria-hidden={!isActive}
                  className={`absolute inset-0 ${slideFade} ${
                    isActive
                      ? "opacity-100"
                      : "pointer-events-none opacity-0"
                  }`}
                >
                  {/* Optimized banner image */}

                  <img
                    src={banner.image}
                    alt={
                      isActive
                        ? safeAlt(
                            banner.alt,
                            safeText(banner.title) || "HomeCareX offer"
                          )
                        : ""
                    }
                    width={1600}
                    height={900}
                    loading={isActive ? "eager" : "lazy"}
                    fetchPriority={isActive ? "high" : "low"}
                    decoding="async"
                    onError={(event) => {
                      console.error("Banner image failed to load:", banner.image);
                      event.currentTarget.style.display = "none";
                    }}
                    className={`absolute inset-0 h-full w-full object-cover ${imageMotion} ${
                      isActive ? "scale-100" : "scale-105"
                    }`}
                  />

                  {/* Readability overlays */}

                  <div className="absolute inset-0 bg-gradient-to-r from-[#1e1b4b]/75 via-[#312e81]/30 to-transparent" />

                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#1e1b4b]/55 to-transparent" />

                  {/* Banner content (React escapes all of this as text, never as HTML) */}

                  <div className="relative flex h-full items-center px-6 pb-28 pt-12 sm:px-12 lg:px-16">
                    <div
                      className={`max-w-xl text-white ${contentMotion} ${
                        isActive
                          ? "translate-y-0 opacity-100"
                          : "translate-y-3 opacity-0"
                      }`}
                    >
                      <span className="inline-block rounded-full border border-white/25 bg-white/15 px-3.5 py-1 text-sm font-semibold text-white backdrop-blur-sm">
                        {banner.category}
                      </span>

                      <h2 className="mt-5 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                        {banner.title}
                      </h2>

                      <p className="mt-4 max-w-md text-base leading-7 text-white/90 sm:text-lg">
                        {banner.description}
                      </p>

                      <a
                        href={safeLink(banner.link)}
                        tabIndex={isActive ? 0 : -1}
                        className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-[#ff8a3d] px-6 py-3.5 font-semibold text-[#1b1b3a] shadow-lg shadow-black/20 transition hover:bg-[#e0600f] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#312e81]"
                      >
                        Explore services

                        <span className="transition-transform group-hover:translate-x-1">
                          <ArrowRight />
                        </span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ===================== CONTROL BAR ===================== */}

          {showControls && (
            <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-4 px-6 pb-6 sm:px-12 lg:px-16">
              {/* Progress segments / slide pickers */}

              <div
                className="flex flex-1 items-center gap-2 sm:max-w-md"
                role="group"
                aria-label="Choose a banner"
              >
                {banners.map((banner, index) => {
                  const isActive = index === currentIndex;

                  return (
                    <button
                      key={banner.id}
                      type="button"
                      onClick={() => setCurrentIndex(index)}
                      aria-label={`Go to banner ${index + 1}: ${banner.category}`}
                      aria-current={
                        isActive ? "true" : undefined
                      }
                      className="group flex h-6 flex-1 items-center focus:outline-none"
                    >
                      <span
                        className={`relative block h-1 w-full overflow-hidden rounded-full bg-white/30 transition group-hover:bg-white/50 group-focus-visible:ring-2 group-focus-visible:ring-white group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-[#312e81] ${
                          isActive ? "h-1.5" : ""
                        }`}
                      >
                        {isActive && (
                          <span
                            ref={progressBarRef}
                            className="absolute inset-0 origin-left rounded-full bg-[#ff8a3d]"
                            style={{
                              transform: prefersReducedMotion
                                ? "scaleX(1)"
                                : "scaleX(0)",
                            }}
                          />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Counter */}

              <p
                className="hidden text-sm font-semibold tabular-nums text-white/90 sm:block"
                aria-hidden="true"
              >
                {pad(currentIndex + 1)} / {pad(count)}
              </p>

              {/* Playback and navigation buttons */}

              <div className="flex items-center gap-2">
                {!prefersReducedMotion && (
                  <button
                    type="button"
                    onClick={() =>
                      setUserPaused((paused) => !paused)
                    }
                    aria-label={
                      userPaused
                        ? "Resume autoplay"
                        : "Pause autoplay"
                    }
                    className={controlButton}
                  >
                    {userPaused ? (
                      <PlayIcon />
                    ) : (
                      <PauseIcon />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={goToPrevious}
                  aria-label="Previous banner"
                  className={controlButton}
                >
                  <ChevronLeft />
                </button>

                <button
                  type="button"
                  onClick={goToNext}
                  aria-label="Next banner"
                  className={controlButton}
                >
                  <ChevronRight />
                </button>
              </div>
            </div>
          )}

          {/* Screen-reader announcement */}

          <p
            className="sr-only"
            aria-live={autoplayActive ? "off" : "polite"}
          >
            {`Banner ${currentIndex + 1} of ${count}: ${
              safeText(banners[currentIndex]?.title)
            }`}
          </p>
        </div>
      </div>
    </section>
  );
};

export default BannerSlider;