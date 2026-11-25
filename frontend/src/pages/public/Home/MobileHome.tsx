import React, { useState, useEffect, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  Mic,
  ArrowRight,
  Star,
  Copy,
  Check,
  Gift,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";

interface HeroSlide {
  title: string;
  image: string;
  slug: string;
}

const HERO_SLIDES: HeroSlide[] = [
  {
    title: "Appliance Repair & Service",
    image: "/images/background.webp",
    slug: "appliance-repair-service",
  },
  {
    title: "Home Cleaning",
    image: "/images/home-cleaning.webp",
    slug: "home-cleaning",
  },
  {
    title: "Salon & Spa",
    image: "/images/Home-spa-women.webp",
    slug: "salon-spa",
  },
  {
    title: "Electrical & Plumbing",
    image: "/images/electrical.webp",
    slug: "electrical-plumbing",
  },
  {
    title: "Painting & Waterproofing",
    image: "/images/painting-category.webp",
    slug: "painting-waterproofing",
  },
  {
    title: "Pest Control",
    image: "/images/pest-control-clean.webp",
    slug: "pest-control",
  },
];

interface BrowseCategory {
  id: string;
  name: string;
  count: string;
  image: string;
  slug: string;
}

const BROWSE_CATEGORIES: BrowseCategory[] = [
  {
    id: "salon-spa",
    name: "Salon & Spa",
    count: "6 services",
    image: "/images/Home-spa-women.webp",
    slug: "salon-spa",
  },
  {
    id: "appliance-repair",
    name: "Appliance Repair & Service",
    count: "6 services",
    image: "/images/background.webp",
    slug: "appliance-repair-service",
  },
  {
    id: "home-cleaning",
    name: "Home Cleaning",
    count: "5 services",
    image: "/images/home-cleaning.webp",
    slug: "home-cleaning",
  },
  {
    id: "electrical-plumbing",
    name: "Electrical & Plumbing",
    count: "5 services",
    image: "/images/electrical.webp",
    slug: "electrical-plumbing",
  },
];

interface RecommendedService {
  id: string;
  name: string;
  rating: number;
  duration: string;
  price: number;
  image: string;
  slug: string;
}

const RECOMMENDED_SERVICES: RecommendedService[] = [
  {
    id: "ac-service",
    name: "AC Service & Gas Refill",
    rating: 4.8,
    duration: "45 mins",
    price: 499,
    image: "/images/background.webp",
    slug: "ac-service-gas-refill",
  },
  {
    id: "deep-cleaning",
    name: "Deep Home Cleaning",
    rating: 4.7,
    duration: "2 hrs",
    price: 299,
    image: "/images/home-cleaning.webp",
    slug: "deep-home-cleaning",
  },
  {
    id: "washing-machine",
    name: "Washing Machine Repair",
    rating: 4.6,
    duration: "60 mins",
    price: 399,
    image: "/images/washing-machine-repair.webp",
    slug: "washing-machine-repair",
  },
  {
    id: "salon-home",
    name: "Salon at Home",
    rating: 4.8,
    duration: "60 mins",
    price: 399,
    image: "/images/Home-spa-women.webp",
    slug: "salon-spa",
  },
  {
    id: "electrical-check",
    name: "Electrical Safety Check",
    rating: 4.9,
    duration: "30 mins",
    price: 199,
    image: "/images/electrical.webp",
    slug: "electrical-plumbing",
  },
];

const TYPING_PHRASES = [
  "AC repair",
  "deep home cleaning",
  "painting",
  "plumber near me",
  "pest control",
  "haircut at home",
];

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

export const MobileHome: React.FC = () => {
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const greetingText = getGreeting();

  const [heroIndex, setHeroIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Animated search typing
  const [animatedHint, setAnimatedHint] = useState("Search AC repair|");

  useEffect(() => {
    let phraseIndex = 0;
    let charIndex = 0;
    let isForward = true;

    const interval = window.setInterval(() => {
      if (searchQuery.length > 0) return;
      const currentPhrase = TYPING_PHRASES[phraseIndex];

      if (isForward) {
        if (charIndex < currentPhrase.length) {
          charIndex++;
          setAnimatedHint(`Search ${currentPhrase.slice(0, charIndex)}|`);
        } else {
          isForward = false;
        }
      } else {
        if (charIndex > 0) {
          charIndex--;
          setAnimatedHint(`Search ${currentPhrase.slice(0, charIndex)}|`);
        } else {
          isForward = true;
          phraseIndex = (phraseIndex + 1) % TYPING_PHRASES.length;
        }
      }
    }, 110);

    return () => window.clearInterval(interval);
  }, [searchQuery]);

  // Auto rotate hero carousel every 5 seconds
  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const touchStartX = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        setHeroIndex((prev) => (prev + 1) % HERO_SLIDES.length);
      } else {
        setHeroIndex((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
      }
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/services?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/services");
    }
  };

  const handleVoiceSearch = () => {
    setToastMessage('Voice Search: Speak now (e.g. "AC repair")');
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleCopyCoupon = () => {
    navigator.clipboard?.writeText("HOME20");
    setCopiedCoupon(true);
    setToastMessage('Coupon code "HOME20" copied to clipboard!');
    setTimeout(() => {
      setCopiedCoupon(false);
      setToastMessage(null);
    }, 2500);
  };

  const firstName = user?.name ? user.name.split(" ")[0] : null;

  return (
    <div className="block md:hidden bg-[#FAFAFC] pb-12 px-4 pt-3 space-y-5">
      {/* ================= TOAST NOTIFICATION ================= */}
      {toastMessage && (
        <div className="fixed top-14 inset-x-4 z-50 flex items-center justify-center animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="rounded-full bg-[#FF8A3D] px-4 py-2 text-xs font-bold text-white shadow-lg">
            {toastMessage}
          </div>
        </div>
      )}

      {/* ================= 1. GREETING SECTION ================= */}
      <section aria-labelledby="mobile-greeting" className="space-y-2">
        {/* Live status badge: • Good evening */}
        <div className="inline-flex items-center gap-2 rounded-full border border-[#D9DCF7] bg-white py-1 px-3 shadow-2xs">
          <span className="relative flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-slate-800">{greetingText}</span>
        </div>

        {/* Welcome, firstName or Welcome to HomeCareX */}
        <h1
          id="mobile-greeting"
          className="text-[26px] font-extrabold text-[#1E1B2E] tracking-tight leading-tight"
        >
          {firstName ? `Welcome, ${firstName}` : "Welcome to HomeCareX"}
        </h1>

        <p className="text-xs text-[#6B7280] font-normal leading-relaxed">
          Trusted professionals at your door. Transparent prices, no surprises.
        </p>
      </section>

      {/* ================= 2. CATEGORY HERO BANNER CAROUSEL ================= */}
      <section aria-label="Category Hero Banner" className="space-y-2">
        <div
          className="relative w-full aspect-[400/200] overflow-hidden rounded-[24px] bg-slate-100 shadow-sm border border-slate-200/60"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Slides Track */}
          <div
            className="flex h-full w-full transition-transform duration-500 ease-out will-change-transform"
            style={{ transform: `translateX(-${heroIndex * 100}%)` }}
          >
            {HERO_SLIDES.map((slide, idx) => (
              <div
                key={slide.slug}
                onClick={() => navigate(`/services?category=${slide.slug}`)}
                className="relative h-full w-full shrink-0 cursor-pointer overflow-hidden"
              >
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="h-full w-full object-cover object-center select-none"
                  loading={idx === 0 ? "eager" : "lazy"}
                />
                {/* Subtle bottom shadow overlay to keep dots visible */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/50 to-transparent pointer-events-none" />
              </div>
            ))}
          </div>

          {/* Bottom-right indicator dots */}
          <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/35 backdrop-blur-xs px-2.5 py-1 z-10 pointer-events-none">
            {HERO_SLIDES.map((_, i) => (
              <span
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i === heroIndex
                    ? "h-2 w-4 bg-white"
                    : "h-2 w-2 bg-white/50"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Category title below the card */}
        <div className="pt-0.5">
          <h2
            onClick={() => navigate(`/services?category=${HERO_SLIDES[heroIndex].slug}`)}
            className="text-lg font-extrabold text-[#1E1B2E] tracking-tight cursor-pointer hover:text-blue-600 transition-colors"
          >
            {HERO_SLIDES[heroIndex].title}
          </h2>
        </div>
      </section>

      {/* ================= 3. SEARCH BAR ================= */}
      <section aria-label="Search Services">
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex items-center gap-2 rounded-full border border-[#D9DCF7] bg-white px-3 py-1.5 shadow-sm transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"
        >
          <Search className="h-4 w-4 text-slate-400 shrink-0 ml-1" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={searchQuery.length === 0 ? animatedHint : ""}
            className="flex-1 bg-transparent text-xs sm:text-sm text-[#1E1B2E] placeholder:text-slate-400 focus:outline-none"
          />

          {/* Voice Search Mic Button */}
          <button
            type="button"
            onClick={handleVoiceSearch}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#EEECFB] text-[#4338CA] transition-transform active:scale-90"
            aria-label="Voice search"
          >
            <Mic className="h-4 w-4" />
          </button>

          {/* Vibrant Orange Search Submit Button */}
          <button
            type="submit"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FF8A3D] text-white shadow-xs transition-transform active:scale-90"
            aria-label="Submit search"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>
      </section>

      {/* ================= 4. BROWSE CATEGORIES (2x2 PHOTO GRID) ================= */}
      <section aria-label="Browse categories" className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#1E1B2E] tracking-tight">
            Browse categories
          </h2>
          <Link
            to="/categories"
            className="text-xs font-bold text-blue-600 hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          {BROWSE_CATEGORIES.map((c) => (
            <Link
              key={c.id}
              to={`/services?category=${c.slug}`}
              className="group relative block h-[180px] overflow-hidden rounded-[20px] border border-white bg-slate-100 shadow-[0_7px_22px_rgba(30,27,46,.08)] transition-transform duration-300 active:scale-98"
            >
              <img
                src={c.image}
                alt={c.name}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              {/* Gradient Dark Overlay */}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-[rgba(20,18,36,.88)] via-[rgba(20,18,36,.45)] via-[40%] to-transparent"
              />

              {/* White Circle Arrow Button */}
              <div
                aria-hidden="true"
                className="absolute right-2.5 top-2.5 flex h-[28px] w-[28px] items-center justify-center rounded-full bg-white text-[#4338CA] shadow-sm transition-colors group-hover:bg-[#4338CA] group-hover:text-white"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </div>

              {/* Category Name & Count */}
              <div className="absolute inset-x-3 bottom-3 flex flex-col gap-0.5 pointer-events-none">
                <span className="text-[13px] font-bold leading-tight text-white line-clamp-2">
                  {c.name}
                </span>
                <span className="text-[11px] text-white/80 font-medium">
                  {c.count}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ================= 5. SERVICES FOR YOU (HORIZONTAL SCROLL) ================= */}
      <section aria-label="Services for you" className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#1E1B2E] tracking-tight">
            Services for you
          </h2>
        </div>

        <div className="relative -mx-4 flex gap-3.5 overflow-x-auto px-4 pb-2 scrollbar-none">
          {RECOMMENDED_SERVICES.map((s) => (
            <div
              key={s.id}
              className="flex min-w-[210px] w-[210px] shrink-0 flex-col justify-between overflow-hidden rounded-[20px] border border-slate-100 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.05)]"
            >
              {/* Thumbnail with Rating badge */}
              <div className="relative h-28 w-full overflow-hidden bg-slate-100">
                <img
                  src={s.image}
                  alt={s.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-bold text-slate-800 shadow-2xs backdrop-blur-xs">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>{s.rating}</span>
                </div>
              </div>

              {/* Service details */}
              <div className="flex flex-1 flex-col justify-between p-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1">
                    {s.name}
                  </h3>
                  <p className="mt-0.5 text-[10px] text-slate-500 font-medium">
                    • {s.duration}
                  </p>
                </div>

                <div className="mt-3 flex items-center justify-between pt-1 border-t border-slate-50">
                  <span className="text-xs font-extrabold text-[#1E1B2E]">
                    ₹{s.price}
                  </span>
                  <Link
                    to={`/services`}
                    className="rounded-full bg-blue-600 px-3 py-1 text-[10px] font-bold text-white transition-colors hover:bg-blue-700 active:scale-95"
                  >
                    Book
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= 6. OFFERS FOR YOU (HORIZONTAL SCROLL) ================= */}
      <section aria-label="Offers for you" className="space-y-3 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-[#1E1B2E] tracking-tight">
            Offers for you
          </h2>
        </div>

        <div className="relative -mx-4 flex gap-3.5 overflow-x-auto px-4 pb-3 scrollbar-none">
          {/* Offer 1: Flat 20% OFF */}
          <div
            onClick={handleCopyCoupon}
            className="flex min-w-[260px] w-[260px] shrink-0 cursor-pointer flex-col justify-between rounded-[20px] border border-[#DDD6FE] bg-gradient-to-br from-[#EEECFB] to-[#F5F3FF] p-4 shadow-[0_4px_16px_rgba(67,56,202,0.06)] transition-transform active:scale-98"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-[#4338CA] px-2.5 py-1 text-[11px] font-bold text-white tracking-wider">
                  HOME20
                </span>
                {copiedCoupon ? (
                  <Check className="h-4 w-4 text-[#4338CA]" />
                ) : (
                  <Copy className="h-4 w-4 text-[#4338CA]" />
                )}
              </div>
              <h3 className="mt-3 text-base font-extrabold text-[#1E1B2E]">
                Flat 20% OFF
              </h3>
              <p className="mt-0.5 text-xs text-slate-500 font-medium">
                On Your First Booking
              </p>
            </div>
            <div className="mt-3">
              <span className="text-[11px] font-bold text-[#4338CA]">
                {copiedCoupon ? "Copied! ✓" : "Use Code: HOME20"}
              </span>
            </div>
          </div>

          {/* Offer 2: Refer a friend, earn ₹50 */}
          <Link
            to="/customer/referrals"
            className="flex min-w-[260px] w-[260px] shrink-0 flex-col justify-between rounded-[20px] border border-[#FDE68A] bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] p-4 shadow-[0_4px_16px_rgba(180,83,9,0.06)] transition-transform active:scale-98"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="rounded-xl bg-[#F59E0B] px-2.5 py-1 text-[11px] font-bold text-white tracking-wider">
                  REFERRAL
                </span>
                <Gift className="h-4 w-4 text-[#B45309]" />
              </div>
              <h3 className="mt-3 text-base font-extrabold text-[#1E1B2E]">
                Refer a friend, earn ₹50
              </h3>
              <p className="mt-0.5 text-xs text-slate-600 font-medium leading-relaxed">
                Both of you get wallet credit on their first booking.
              </p>
            </div>
            <div className="mt-3">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B45309]">
                Invite Friends <ArrowRight className="h-3 w-3" />
              </span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
};

export default MobileHome;
