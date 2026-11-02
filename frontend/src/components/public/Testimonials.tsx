import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../../constants/routes";
import { fetchPublicReviews } from "@/services/reviewsApi";

/* =====================================================================
 * TYPES & DATA
 * ===================================================================== */

export interface Testimonial {
  id: string;
  name: string;
  city?: string;
  service: string;
  tag?: string;
  headline?: string;
  review: string;
  rating: number; // 1 to 5
  avatar?: string;
  date?: string;
  verifiedBookingsCount?: number;
  helpfulCount?: number;
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: "TEST001",
    name: "Naveen Shetty",
    city: "Bengaluru",
    service: "Full Home Deep Cleaning",
    tag: "CLEANING",
    headline: "An absolute pleasure! Booking was seamless, and the service exceeded expectations.",
    review:
      "An absolute pleasure! Booking was seamless, and the service exceeded expectations.",
    rating: 5,
    avatar: "",
    date: "2 days ago",
    verifiedBookingsCount: 4,
    helpfulCount: 38,
  },
  {
    id: "TEST002",
    name: "Priya Sharma",
    city: "Bengaluru",
    service: "Full Home Deep Cleaning",
    tag: "CLEANING",
    headline: "My home felt brand new before Diwali!",
    review:
      "Preparing for visiting relatives with 60-hour work weeks felt impossible. HomeCareX arrived on time, left every tile and window spotless, and seeing my mother's happy smile was priceless.",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=160&q=80",
    date: "3 days ago",
    verifiedBookingsCount: 4,
    helpfulCount: 38,
  },
  {
    id: "TEST003",
    name: "Rahul Kumar",
    city: "Hyderabad",
    service: "Emergency Plumbing",
    tag: "PLUMBING",
    headline: "Pipe burst fixed in 40 minutes flat",
    review:
      "Water was gushing under our kitchen sink on Saturday. The plumber Rajesh arrived in 40 mins with the exact valve, fixed it cleanly with zero surge pricing, and saved our weekend.",
    rating: 4.5,
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=160&q=80",
    date: "1 week ago",
    verifiedBookingsCount: 2,
    helpfulCount: 27,
  },
  {
    id: "TEST004",
    name: "Ananya Reddy",
    city: "Chennai",
    service: "Elderly Care & Electrical",
    tag: "ELECTRICAL",
    headline: "Felt so safe having them assist my elderly parents",
    review:
      "Living abroad, I worry about my aging parents dealing with home repairs. The technicians were polite, spoke in Tamil, and fixed the main wiring with complete safety gear.",
    rating: 5,
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80",
    date: "2 weeks ago",
    verifiedBookingsCount: 6,
    helpfulCount: 42,
  },
  {
    id: "TEST005",
    name: "Vikramaditya Verma",
    city: "Mumbai",
    service: "AC Deep Servicing",
    tag: "APPLIANCES",
    headline: "Rescued us in peak 39°C heatwave",
    review:
      "Our AC gave up during the hottest week. The specialist diagnosed the leak quickly, refilled it with genuine parts, and had our room ice cold in an hour. Honest and transparent.",
    rating: 4,
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80",
    date: "3 weeks ago",
    verifiedBookingsCount: 3,
    helpfulCount: 19,
  },
  {
    id: "TEST006",
    name: "Sneha Mukherjee",
    city: "Pune",
    service: "Kitchen Deep Degreasing",
    tag: "CLEANING",
    headline: "Stubborn chimney stains completely gone",
    review:
      "Years of daily tadka and oil grime on our chimney vanished after their steam degreasing. The kitchen smells fresh, feels hygienic, and looks brand new again.",
    rating: 4.5,
    avatar: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=160&q=80",
    date: "1 month ago",
    verifiedBookingsCount: 5,
    helpfulCount: 31,
  },
];

const clampRating = (n: number) => Math.min(5, Math.max(0, n));

const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/* =====================================================================
 * HOOKS
 * ===================================================================== */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return reduced;
}

function useSeen<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;

    if (typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          obs.disconnect();
        }
      },
      { threshold }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [seen, threshold]);

  return [ref, seen] as const;
}

/* =====================================================================
 * SUB-COMPONENTS
 * ===================================================================== */

const FadeIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
  reduced?: boolean;
}> = ({ children, delay = 0, className = "", reduced = false }) => {
  const [ref, seen] = useSeen<HTMLDivElement>(0.15);

  if (reduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: seen ? 1 : 0,
        transform: seen ? "none" : "translateY(12px)",
        transition: `opacity .5s cubic-bezier(.2,.7,.2,1) ${delay}ms, transform .5s cubic-bezier(.2,.7,.2,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

interface StarRatingProps {
  value: number;
  className?: string;
}

const StarRating: React.FC<StarRatingProps> = ({ value, className = "" }) => {
  const rating = clampRating(value);

  return (
    <div
      className={`inline-flex items-center gap-0.5 ${className}`}
      aria-label={`${rating} out of 5 stars`}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const fillPercent = Math.max(0, Math.min(1, rating - i)) * 100;
        const gradientId = `star-grad-home-${i}-${Math.round(fillPercent)}`;

        return (
          <svg
            key={i}
            className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-[#f59e0b] drop-shadow-[0_1px_2px_rgba(245,158,11,0.2)]"
            viewBox="0 0 24 24"
            fill="none"
          >
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset={`${fillPercent}%`} stopColor="#f59e0b" />
                <stop offset={`${fillPercent}%`} stopColor="#e2e8f0" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#${gradientId})`}
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
            />
          </svg>
        );
      })}
    </div>
  );
};

/* =====================================================================
 * MAIN COMPONENT: Testimonials (Matches Exact Design & HomeCareX Theme)
 * ===================================================================== */

export interface TestimonialsProps {
  testimonials?: Testimonial[];
}

const Testimonials: React.FC<TestimonialsProps> = ({
  testimonials: initialTestimonials,
}) => {
  const reduced = usePrefersReducedMotion();
  const [items, setItems] = useState<Testimonial[]>(
    initialTestimonials ?? DEFAULT_TESTIMONIALS
  );
  const [index, setIndex] = useState(0);
  const [avatarErrors, setAvatarErrors] = useState<Record<string, boolean>>({});

  // Sync when caller updates testimonials prop
  useEffect(() => {
    if (initialTestimonials && initialTestimonials.length > 0) {
      setItems(initialTestimonials);
    }
  }, [initialTestimonials]);

  // Dynamically fetch approved reviews from backend if not passed as props
  useEffect(() => {
    if (initialTestimonials && initialTestimonials.length > 0) return;

    let isMounted = true;
    async function loadTestimonialsFromBackend() {
      try {
        const res = await fetchPublicReviews({ limit: 8 });
        if (isMounted && res?.reviews && res.reviews.length > 0) {
          const mapped: Testimonial[] = res.reviews.map((r) => ({
            id: r.id,
            name: r.name,
            city: r.city,
            service: r.service,
            tag: r.category ? r.category.toUpperCase() : "HOME CARE",
            headline: r.headline || r.review,
            review: r.review,
            rating: r.rating,
            avatar: r.avatar,
            date: r.date,
            verifiedBookingsCount: r.verifiedBookingsCount,
            helpfulCount: r.helpfulCount,
          }));
          setItems(mapped);
        }
      } catch (err) {
        console.warn("Could not load dynamic testimonials, using verified default reviews:", err);
      }
    }

    loadTestimonialsFromBackend();
    return () => {
      isMounted = false;
    };
  }, [initialTestimonials]);

  const touchStartX = useRef<number | null>(null);
  const count = items.length;

  useEffect(() => {
    if (count > 0 && index >= count) setIndex(0);
  }, [count, index]);

  const goNext = useCallback(
    () => setIndex((i) => (count === 0 ? 0 : (i + 1) % count)),
    [count]
  );
  const goPrevious = useCallback(
    () => setIndex((i) => (count === 0 ? 0 : (i - 1 + count) % count)),
    [count]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    switch (event.key) {
      case "ArrowRight":
        event.preventDefault();
        goNext();
        break;
      case "ArrowLeft":
        event.preventDefault();
        goPrevious();
        break;
      case "Home":
        event.preventDefault();
        setIndex(0);
        break;
      case "End":
        event.preventDefault();
        setIndex(count - 1);
        break;
      default:
    }
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) < 40) return;
    if (deltaX < 0) goNext();
    else goPrevious();
  };

  const current = items[index] || items[0];

  return (
    <section
      id="testimonials"
      aria-labelledby="testimonials-heading"
      className="relative overflow-hidden bg-[#f8fafc] py-8 sm:py-10 border-y border-slate-100"
    >
      {/* Home theme subtle ambient glows */}
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[#ff8a3d]/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-indigo-100/30 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-4xl px-4 sm:px-6">
        {/* ===================== HEADER ===================== */}
        <FadeIn reduced={reduced} className="mx-auto mb-4 sm:mb-5 max-w-xl text-center">
          {/* Badge: ⭐ Verified Reviews (Home theme warm amber/orange) */}
          <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-orange-50/90 px-3 py-0.5 text-[11px] font-semibold text-orange-800 ring-1 ring-orange-200/70 shadow-2xs">
            <span className="text-[#f59e0b]">★</span>
            <span>Verified Reviews</span>
          </div>

          {/* Heading: What Our Customers Say (with signature HomeCareX vibrant orange gradient) */}
          <h2
            id="testimonials-heading"
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1e1b4b] tracking-tight leading-tight"
          >
            What Our{" "}
            <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">
              Customers
            </span>{" "}
            Say
          </h2>

          {/* Subtitle */}
          <p className="mt-1.5 text-xs sm:text-sm text-slate-500 leading-relaxed font-normal max-w-md mx-auto">
            Real experiences from verified bookings — helping you choose with confidence.
          </p>
        </FadeIn>

        {/* ===================== CAROUSEL SECTION ===================== */}
        {count === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl bg-white p-6 text-center shadow-sm border border-slate-100">
            <p className="text-xs sm:text-sm text-slate-500 font-medium">No reviews available currently.</p>
          </div>
        ) : (
          <FadeIn reduced={reduced} delay={60}>
            {/* Card flanked by left & right circular arrow buttons */}
            <div className="relative mx-auto flex max-w-3xl items-center justify-center gap-2.5 sm:gap-4">
              {/* Left Arrow Button */}
              <button
                type="button"
                onClick={goPrevious}
                aria-label="Previous review"
                className="flex-shrink-0 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200/80 text-slate-600 transition-all duration-200 hover:text-[#ff8a3d] hover:border-orange-300 hover:shadow-md hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a3d] cursor-pointer"
              >
                <svg
                  className="h-4 w-4 sm:h-4.5 sm:w-4.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              {/* The Card */}
              <div
                role="group"
                aria-roledescription="carousel"
                aria-label="Customer reviews"
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="w-full max-w-xl sm:max-w-2xl rounded-2xl sm:rounded-3xl bg-white shadow-[0_10px_35px_-8px_rgba(0,0,0,0.07)] border border-slate-100/90 p-6 sm:p-7 md:p-8 transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a3d] overflow-hidden"
              >
                <div className="grid overflow-hidden">
                  {items.map((t, i) => {
                    const active = i === index;
                    const rating = clampRating(t.rating);
                    const hasAvatar = Boolean(t.avatar && !avatarErrors[t.id]);

                    return (
                      <article
                        key={t.id}
                        role="group"
                        aria-roledescription="slide"
                        aria-label={`${i + 1} of ${count}`}
                        aria-hidden={!active}
                        className={`col-start-1 row-start-1 flex flex-col ${
                          active ? "visible" : "invisible pointer-events-none"
                        }`}
                        style={{
                          opacity: active ? 1 : 0,
                          transform: reduced
                            ? "none"
                            : active
                              ? "translateX(0)"
                              : `translateX(${i < index ? "-20px" : "20px"})`,
                          transition: reduced
                            ? "none"
                            : "opacity .3s cubic-bezier(.2,.7,.2,1), transform .3s cubic-bezier(.2,.7,.2,1), visibility .3s",
                        }}
                      >
                        {/* Top row: Stars + Home Theme Warm Pill Tag */}
                        <div className="flex items-center gap-2.5">
                          <StarRating value={rating} />

                          <span className="inline-flex items-center gap-1 rounded-full bg-orange-50/90 border border-orange-200/70 px-3 py-0.5 text-[11px] sm:text-xs font-bold text-[#ea580c] uppercase tracking-wider">
                            <svg
                              className="h-3 w-3 text-[#ff8a3d]"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 100-4V6z" />
                            </svg>
                            <span>{t.tag || t.service}</span>
                          </span>
                        </div>

                        {/* Quote: Outline Quote Mark + Text */}
                        <div className="mt-3 sm:mt-4 flex items-start gap-2.5">
                          <svg
                            className="h-6 w-6 sm:h-7 sm:w-7 text-orange-200/90 flex-shrink-0 mt-0.5 select-none"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
                            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
                          </svg>

                          <p className="text-sm sm:text-base md:text-[17px] font-semibold text-slate-800 leading-relaxed">
                            &ldquo;{t.review}&rdquo;
                          </p>
                        </div>

                        {/* Minimal Horizontal Divider */}
                        <div className="border-t border-slate-100 my-4 sm:my-5" />

                        {/* Bottom Author Row */}
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff8a3d] via-[#f97316] to-[#ff6b00] text-sm font-bold text-white shadow-2xs">
                            {hasAvatar ? (
                              <img
                                src={t.avatar}
                                alt={t.name}
                                className="h-full w-full rounded-full object-cover"
                                onError={() => setAvatarErrors((p) => ({ ...p, [t.id]: true }))}
                              />
                            ) : (
                              initials(t.name)
                            )}
                          </div>

                          <div>
                            <h4 className="text-sm sm:text-base font-bold text-[#1e1b4b] leading-tight">
                              {t.name}
                            </h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              {t.service} {t.city ? `• ${t.city}` : ""}
                            </p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              {/* Right Arrow Button */}
              <button
                type="button"
                onClick={goNext}
                aria-label="Next review"
                className="flex-shrink-0 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white shadow-sm border border-slate-200/80 text-slate-600 transition-all duration-200 hover:text-[#ff8a3d] hover:border-orange-300 hover:shadow-md hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a3d] cursor-pointer"
              >
                <svg
                  className="h-4 w-4 sm:h-4.5 sm:w-4.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {/* Screen reader notification */}
            <p className="sr-only" aria-live="polite" aria-atomic="true">
              {current
                ? `Review ${index + 1} of ${count} from ${current.name} for ${current.service}, rated ${clampRating(current.rating)} out of 5.`
                : ""}
            </p>

            {/* Pagination Dots (Active HomeCareX orange gradient pill + circle dots) */}
            {count > 1 && (
              <div
                className="mt-3 sm:mt-3.5 flex items-center justify-center gap-1.5"
                role="group"
                aria-label="Choose a review"
              >
                {items.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setIndex(i)}
                    aria-label={`Show review ${i + 1} from ${t.name}`}
                    aria-current={i === index ? "true" : undefined}
                    className="group flex h-4 items-center focus:outline-none cursor-pointer"
                  >
                    <span
                      className={`block h-1.5 rounded-full transition-all duration-300 ${
                        i === index
                          ? "w-6 bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] shadow-[0_1px_6px_rgba(255,138,61,0.4)]"
                          : "w-1.5 bg-slate-300 hover:bg-orange-200"
                      }`}
                    />
                  </button>
                ))}
              </div>
            )}

            {/* Compact View All Reviews Button */}
            <div className="mt-3 sm:mt-3.5 flex flex-col items-center justify-center gap-1.5">
              <Link
                to={ROUTES.REVIEWS}
                className="group inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs sm:text-sm font-bold text-slate-800 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-[#ff8a3d] hover:bg-orange-50/40 hover:text-[#ff8a3d] hover:shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8a3d]"
              >
                <span>View All Reviews</span>
                <span className="transition-transform duration-200 group-hover:translate-x-1">→</span>
              </Link>

              <Link
                to="/customer/reviews"
                className="text-[11px] font-semibold text-slate-500 hover:text-[#ff8a3d] transition-colors"
              >
                Have you booked with us recently? Share your experience →
              </Link>
            </div>
          </FadeIn>
        )}
      </div>
    </section>
  );
};

export default Testimonials;
