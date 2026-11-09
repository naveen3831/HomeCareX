import React, { useState, useEffect, useContext, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  Star,
  Heart,
  ShieldCheck,
  Flower2,
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Home as HomeIcon,
  Percent,
  PaintRoller,
  Armchair,
  Wrench,
  LayoutGrid,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";
import { fetchPublicReviews } from "@/services/reviewsApi";
import HomeBanners from "../../../components/public/HomeBanners";

/* =========================================================
   CUSTOM CATEGORY ICONS MATCHING MOCKUP DESIGN
========================================================= */

// Clean Vacuum / Mop Cleaner Icon
const VacuumIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 3v9" />
    <path d="M7 12h10l-1.5 7H8.5L7 12z" />
    <circle cx="12" cy="3" r="1" />
    <path d="M5 21h14" />
  </svg>
);

// Clean AC / Appliance Split Unit Icon
const AcIcon: React.FC<{ className?: string }> = ({ className = "h-6 w-6" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="5" width="18" height="9" rx="2" />
    <path d="M7 14v2" />
    <path d="M17 14v2" />
    <path d="M6 10h12" />
    <path d="M6 18l2 2" />
    <path d="M18 18l-2 2" />
    <path d="M12 18v3" />
  </svg>
);

/* =========================================================
   DATA DEFINITIONS
========================================================= */

interface ServiceCardData {
  id: string;
  title: string;
  rating: number;
  reviewsCount: string;
  price: number;
  image: string;
  link: string;
}

const popularServicesData: ServiceCardData[] = [
  {
    id: "ac-service",
    title: "AC Service",
    rating: 4.8,
    reviewsCount: "2.1K",
    price: 499,
    image: "/images/background.webp",
    link: "/services/ac-service-gas-refill",
  },
  {
    id: "home-cleaning",
    title: "Home Cleaning",
    rating: 4.7,
    reviewsCount: "3.4K",
    price: 299,
    image: "/images/home-cleaning.webp",
    link: "/services/deep-home-cleaning",
  },
  {
    id: "washing-machine-repair",
    title: "Washing Machine Repair",
    rating: 4.6,
    reviewsCount: "1.8K",
    price: 399,
    image: "/images/washing-machine-repair.webp",
    link: "/services/washing-machine-repair",
  },
  {
    id: "salon-at-home",
    title: "Salon at Home",
    rating: 4.8,
    reviewsCount: "1.2K",
    price: 399,
    image: "/images/mobile/salon-thumb.png",
    link: "/services?category=salon-spa",
  },
];

// 8 Service Categories matching exact 4x2 grid from mockup
const categoryIcons = [
  {
    id: "home-cleaning",
    name: "Home Cleaning",
    icon: VacuumIcon,
    iconColor: "text-blue-500",
    link: "/services?category=home-cleaning",
  },
  {
    id: "appliance-repair",
    name: "Appliance Repair",
    icon: AcIcon,
    iconColor: "text-blue-500",
    link: "/services?category=appliance-repair-service",
  },
  {
    id: "salon-spa",
    name: "Salon & Spa",
    icon: Flower2,
    iconColor: "text-pink-500",
    link: "/services?category=salon-spa",
  },
  {
    id: "electrical-plumbing",
    name: "Electrical & Plumbing",
    icon: Wrench,
    iconColor: "text-amber-500",
    link: "/services?category=electrical-plumbing",
  },
  {
    id: "painting-waterproofing",
    name: "Painting & Waterproofing",
    icon: PaintRoller,
    iconColor: "text-emerald-500",
    link: "/services?category=painting-waterproofing",
  },
  {
    id: "pest-control",
    name: "Pest Control",
    icon: Bug,
    iconColor: "text-rose-500",
    link: "/services?category=pest-control",
  },
  {
    id: "carpentry-assembly",
    name: "Carpentry & Assembly",
    icon: Armchair,
    iconColor: "text-indigo-500",
    link: "/services?category=carpentry-assembly",
  },
  {
    id: "more-services",
    name: "More Services",
    icon: LayoutGrid,
    iconColor: "text-blue-600",
    link: "/services",
  },
];

const stepperSteps = [
  {
    number: "01",
    title: "Choose a Service",
    desc: "Explore verified cleaning, repair, and wellness services with 100% upfront pricing.",
    tag: "50+ Services",
    tagColor: "bg-blue-50 text-blue-700 border-blue-100",
    nodeColor: "bg-blue-600 ring-blue-100",
  },
  {
    number: "02",
    title: "Schedule Date & Time",
    desc: "Pick your preferred date, convenient 2-hour arrival window, and confirm your address.",
    tag: "Same-Day Slots",
    tagColor: "bg-indigo-50 text-indigo-700 border-indigo-100",
    nodeColor: "bg-indigo-600 ring-indigo-100",
  },
  {
    number: "03",
    title: "Verified Expert Arrives",
    desc: "A background-checked professional arrives on time equipped with genuine tools & kit.",
    tag: "100% Verified",
    tagColor: "bg-purple-50 text-purple-700 border-purple-100",
    nodeColor: "bg-purple-600 ring-purple-100",
  },
  {
    number: "04",
    title: "Inspect & Pay with Ease",
    desc: "Inspect the completed job, approve the work, and pay securely via cash, card, or UPI.",
    tag: "30-Day Guarantee",
    tagColor: "bg-orange-50 text-orange-700 border-orange-100",
    nodeColor: "bg-[#ff8a3d] ring-orange-100",
  },
];

const mobileFaqs = [
  {
    question: "What services does HomeCareX provide?",
    answer: "HomeCareX provides home cleaning, plumbing, electrical repairs, appliance servicing, AC maintenance, painting, pest control, and salon at home.",
  },
  {
    question: "How can I book a service?",
    answer: "Browse our catalog, pick your preferred service, select a date and convenient time slot, and confirm your address.",
  },
  {
    question: "Are the service professionals verified?",
    answer: "Yes, 100% of our service partners undergo thorough background checks, identity verification, and professional skills training.",
  },
  {
    question: "What if I'm not satisfied with the work?",
    answer: "Every service is backed by our 30-day HomeCareX Service Guarantee. We will revisit and resolve any issue free of cost.",
  },
  {
    question: "When and how do I pay?",
    answer: "You can pay securely online via UPI, card, net banking, or pay via cash/UPI after inspecting the completed job.",
  },
];

const getGreetingDetails = () => {
  const hour = new Date().getHours();
  if (hour < 12) {
    return {
      text: "Good Morning",
    };
  }
  if (hour < 17) {
    return {
      text: "Good Afternoon",
    };
  }
  return {
    text: "Good Evening",
  };
};

export const MobileHome: React.FC = () => {
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const greeting = getGreetingDetails();

  const [activeSlide, setActiveSlide] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [copiedCoupon, setCopiedCoupon] = useState(false);
  const [faqSlide, setFaqSlide] = useState<number>(0);
  const faqTouchStartX = useRef<number | null>(null);
  const faqTouchEndX = useRef<number | null>(null);

  const handleFaqTouchStart = (e: React.TouchEvent) => {
    faqTouchStartX.current = e.targetTouches[0].clientX;
  };
  const handleFaqTouchMove = (e: React.TouchEvent) => {
    faqTouchEndX.current = e.targetTouches[0].clientX;
  };
  const handleFaqTouchEnd = () => {
    if (faqTouchStartX.current === null || faqTouchEndX.current === null) return;
    const distance = faqTouchStartX.current - faqTouchEndX.current;
    if (distance > 40) {
      // Swiped left -> next
      setFaqSlide((prev) => (prev + 1) % mobileFaqs.length);
    } else if (distance < -40) {
      // Swiped right -> prev
      setFaqSlide((prev) => (prev - 1 + mobileFaqs.length) % mobileFaqs.length);
    }
    faqTouchStartX.current = null;
    faqTouchEndX.current = null;
  };
  const [hoveredStepperStep, setHoveredStepperStep] = useState<number | null>(null);
  const [mobileReviews, setMobileReviews] = useState<
    Array<{
      id: string;
      name: string;
      city: string;
      service: string;
      rating: number;
      quote: string;
    }>
  >([]);

  useEffect(() => {
    let isMounted = true;
    async function loadReviews() {
      try {
        const res = await fetchPublicReviews({ limit: 6 });
        if (isMounted && res?.reviews && Array.isArray(res.reviews) && res.reviews.length > 0) {
          setMobileReviews(
            res.reviews.map((r) => ({
              id: r.id,
              name: r.name,
              city: r.city,
              service: r.service,
              rating: r.rating || 5,
              quote: r.review || r.headline || "",
            }))
          );
        }
      } catch (err) {
        console.warn("Could not load mobile reviews:", err);
      }
    }
    loadReviews();
    return () => {
      isMounted = false;
    };
  }, []);

  const [activePromoSlide, setActivePromoSlide] = useState(0);
  const promoTouchStartX = useRef<number | null>(null);

  // Auto rotate bottom promo cards carousel every 4.5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActivePromoSlide((prev) => (prev === 0 ? 1 : 0));
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  const handlePromoTouchStart = (e: React.TouchEvent) => {
    promoTouchStartX.current = e.touches[0].clientX;
  };

  const handlePromoTouchEnd = (e: React.TouchEvent) => {
    if (promoTouchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - promoTouchStartX.current;
    promoTouchStartX.current = null;
    if (Math.abs(deltaX) > 40) {
      if (deltaX < 0) {
        setActivePromoSlide(1);
      } else {
        setActivePromoSlide(0);
      }
    }
  };

  // Auto rotate hero carousel every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/services?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/services");
    }
  };

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyCoupon = () => {
    navigator.clipboard?.writeText("HOME20");
    setCopiedCoupon(true);
    setTimeout(() => setCopiedCoupon(false), 2500);
  };

  return (
    <div className="block md:hidden bg-[#fdfdfd] pb-2 px-4 pt-2.5 space-y-4">
      {/* ================= GREETING HEADER (EXACT MOCKUP STYLE) ================= */}
      <div className="pt-0.5">
        <p className="text-xs sm:text-sm font-semibold text-slate-500">
          {greeting.text},
        </p>
        <h2 className="mt-0.5 text-[22px] sm:text-2xl font-black text-slate-900 tracking-tight leading-snug">
          {user?.name ? (
            <>Welcome, <span className="text-blue-600">{user.name.split(" ")[0]}</span></>
          ) : (
            <>Welcome to <span className="text-blue-600">HomeCareX</span></>
          )}
        </h2>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium leading-relaxed">
          Book trusted professionals for your home needs.
        </p>
      </div>

      {/* ================= ADMIN BANNERS (Admin > Marketing) ================= */}
      <HomeBanners className="-mx-4 overflow-hidden" />

      {/* ================= HERO CAROUSEL CARD (EXACT MOCKUP STYLE) ================= */}
      <div className="space-y-2">
        <div className="relative overflow-hidden rounded-3xl shadow-xs border border-slate-100">
          <div
            className="flex transition-transform duration-500 ease-out will-change-transform"
            style={{ transform: `translateX(-${activeSlide * 100}%)` }}
          >
            {/* Slide 1: Home Cleaning Services (Crisp vector text + sofa image, no duplicate dots) */}
            <div className="w-full shrink-0">
              <div className="relative w-full aspect-[436/216] overflow-hidden rounded-3xl bg-gradient-to-r from-[#edf2f8] via-[#eef3f8] to-[#f4f7fb] shadow-xs">
                {/* Left Column: 100% Vector Crisp Text */}
                <div className="absolute inset-y-0 left-0 w-[58%] sm:w-[60%] p-3.5 sm:p-4.5 flex flex-col justify-between z-10">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 shadow-2xs border border-blue-100/60">
                      <ShieldCheck className="h-3 w-3 text-blue-600 shrink-0" />
                      <span>Verified Professionals</span>
                    </div>
                    <h2 className="mt-1.5 text-base sm:text-lg font-black text-slate-900 leading-tight">
                      Home Cleaning<br />Services
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-600 font-medium leading-snug line-clamp-2">
                      Deep cleaning for a healthier and happier home.
                    </p>
                  </div>
                  <div>
                    <Link
                      to="/services?category=home-cleaning"
                      className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3.5 py-1.5 text-[11px] sm:text-xs font-bold text-white shadow-xs transition-transform active:scale-95 hover:bg-blue-700"
                    >
                      <span>Book Now</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* Right Image: Sofa & Plant smoothly blended into background with smooth curves, no borders */}
                <div className="absolute inset-y-0 right-0 w-[48%] sm:w-[45%] flex items-end justify-end pointer-events-none overflow-hidden rounded-r-3xl">
                  <img
                    src="/images/mobile/sofa-clean.png"
                    alt="Home Cleaning Living Room"
                    className="h-full w-auto object-contain object-bottom-right select-none"
                    style={{
                      maskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 100%)',
                      WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 15%, black 100%)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Slide 2: Appliance Repair Services */}
            <div className="w-full shrink-0">
              <div className="relative w-full aspect-[436/216] overflow-hidden rounded-3xl bg-gradient-to-br from-blue-50 via-sky-50 to-indigo-100/70 shadow-xs">
                {/* Left Column: 100% Vector Crisp Text */}
                <div className="absolute inset-y-0 left-0 w-[58%] sm:w-[56%] p-3.5 sm:p-4.5 flex flex-col justify-between z-10">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold text-blue-700 shadow-2xs border border-blue-100/60">
                      <ShieldCheck className="h-3 w-3 text-blue-600 shrink-0" />
                      <span>30-Day Warranty</span>
                    </div>
                    <h2 className="mt-1.5 text-base sm:text-lg font-black text-slate-900 leading-tight">
                      Appliance Repair<br />Services
                    </h2>
                    <p className="mt-1 text-[11px] sm:text-xs text-slate-600 font-medium leading-snug line-clamp-2">
                      Expert technician at your doorstep within 60 minutes.
                    </p>
                  </div>
                  <div>
                    <Link
                      to="/services?category=appliance-repair-service"
                      className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3.5 py-1.5 text-[11px] sm:text-xs font-bold text-white shadow-xs transition-transform active:scale-95 hover:bg-blue-700"
                    >
                      <span>Book Now</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* Right Image: Smoothly blended in the background with curves, zero borders, completely fits section */}
                <div className="absolute inset-y-0 right-0 w-[48%] sm:w-[45%] pointer-events-none overflow-hidden rounded-r-3xl">
                  <img
                    src="/images/card/appliance-repair.webp"
                    alt="Appliance Repair Technician"
                    className="h-full w-full object-cover object-center select-none"
                    style={{
                      maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 22%, black 65%)',
                      WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 22%, black 65%)',
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-50/90 via-blue-50/20 to-transparent pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Slide 3: Electrical & Plumbing Care */}
            <div className="w-full shrink-0">
              <div className="relative w-full aspect-[436/216] overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-orange-50/50 to-amber-100/60 shadow-xs">
                {/* Left Column: 100% Vector Crisp Text */}
                <div className="absolute inset-y-0 left-0 w-[58%] sm:w-[56%] p-3.5 sm:p-4.5 flex flex-col justify-between z-10">
                  <div>
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 shadow-2xs border border-amber-100/60">
                      <ShieldCheck className="h-3 w-3 text-amber-600 shrink-0" />
                      <span>Certified Experts</span>
                    </div>
                    <h2 className="mt-1.5 text-base sm:text-lg font-black text-slate-900 leading-tight">
                      Electrical &amp;<br />Plumbing Care
                    </h2>
                    <p className="mt-1 text-[11px] text-slate-600 font-medium leading-snug line-clamp-2">
                      Quick fixes, safety checks, and emergency home care.
                    </p>
                  </div>
                  <div>
                    <Link
                      to="/services?category=electrical-plumbing"
                      className="inline-flex items-center gap-1 rounded-full bg-[#f97316] px-3.5 py-1.5 text-[11px] sm:text-xs font-bold text-white shadow-xs transition-transform active:scale-95 hover:bg-orange-600"
                    >
                      <span>Book Now</span>
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* Right Image: Smoothly blended in the background with curves, zero borders, completely fits section */}
                <div className="absolute inset-y-0 right-0 w-[48%] sm:w-[45%] pointer-events-none overflow-hidden rounded-r-3xl">
                  <img
                    src="/images/card/electrical.webp"
                    alt="Electrical and plumbing"
                    className="h-full w-full object-cover object-center select-none"
                    style={{
                      maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 22%, black 65%)',
                      WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.5) 22%, black 65%)',
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-50/90 via-amber-50/20 to-transparent pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-0.5">
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveSlide(idx)}
              aria-label={`Go to slide ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activeSlide === idx
                  ? "w-6 bg-blue-600"
                  : "w-1.5 bg-blue-200 hover:bg-blue-300"
              }`}
            />
          ))}
        </div>
      </div>

      {/* ================= SEARCH & FILTER BAR (EXACT MOCKUP STYLE) ================= */}
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 sm:py-3 shadow-2xs focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
          <Search className="h-4 w-4 text-slate-400 shrink-0" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for services (e.g. AC service, cleaning...)"
            className="w-full bg-transparent text-xs font-medium text-slate-800 placeholder:text-slate-400 outline-none"
          />
        </div>

        <Link
          to="/services"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-700 shadow-2xs transition-all active:scale-95 hover:bg-slate-50"
          aria-label="Filter services"
        >
          <SlidersHorizontal className="h-4.5 w-4.5 text-slate-700" />
        </Link>
      </form>

      {/* ================= SERVICE CATEGORIES (EXACT 4x2 GRID FROM MOCKUP) ================= */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Service Categories
          </h2>
          <Link
            to="/services"
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-2 sm:gap-2.5">
          {categoryIcons.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.id}
                to={cat.link}
                className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-[#f8fafc] hover:bg-white hover:border-slate-200/80 p-2 text-center shadow-2xs transition-all duration-200 active:scale-95 group min-h-[92px]"
              >
                <div className="flex h-9 w-9 items-center justify-center transition-transform duration-200 group-hover:scale-110">
                  <Icon className={`h-6 w-6 ${cat.iconColor}`} />
                </div>
                <span className="mt-1 text-[10px] font-bold text-slate-800 leading-tight text-center">
                  {cat.name}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ================= PROMO / DISCOUNT BANNER (EXACT MOCKUP STYLE) ================= */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-[#eff6ff] via-[#f0f7ff] to-[#e0f2fe]/80 p-3.5 sm:p-4 shadow-2xs">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Percent className="h-5 w-5" strokeWidth={2.5} />
            </div>

            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                Flat 20% OFF
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">
                On Your First Booking
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyCoupon}
            className="shrink-0 rounded-full border border-dashed border-blue-600 bg-white px-3.5 py-1.5 text-xs font-bold text-blue-600 shadow-2xs transition-all active:scale-95 hover:bg-blue-50/50"
            aria-label="Copy coupon code HOME20"
          >
            <span>{copiedCoupon ? "Copied! ✓" : "Use Code: HOME20"}</span>
          </button>
        </div>
      </div>

      {/* ================= POPULAR SERVICES ================= */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Popular <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">Services</span>
          </h2>
          <Link
            to="/services"
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Horizontal Carousel */}
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
          {popularServicesData.map((service) => {
            const isFav = !!favorites[service.id];

            return (
              <Link
                key={service.id}
                to={service.link}
                className="group relative flex min-w-[158px] max-w-[158px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs transition-all duration-200 hover:shadow-md active:scale-[0.98]"
              >
                {/* Thumbnail Image */}
                <div className="relative h-28 w-full overflow-hidden bg-slate-100">
                  <img
                    src={service.image}
                    alt={service.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Favorite Heart Button */}
                  <button
                    type="button"
                    onClick={(e) => toggleFavorite(service.id, e)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 shadow-2xs backdrop-blur-xs transition-transform active:scale-90"
                    aria-label={`Favorite ${service.title}`}
                  >
                    <Heart
                      className={`h-4 w-4 transition-colors ${
                        isFav ? "fill-rose-500 text-rose-500" : "text-slate-400 hover:text-rose-400"
                      }`}
                    />
                  </button>
                </div>

                {/* Card Content */}
                <div className="flex flex-1 flex-col justify-between p-2.5">
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 leading-snug line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {service.title}
                    </h3>

                    {/* Rating */}
                    <div className="mt-1 flex items-center gap-1 text-[11px]">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-slate-800">{service.rating}</span>
                      <span className="text-slate-400 font-normal">({service.reviewsCount})</span>
                    </div>
                  </div>

                  {/* Price & Action Row */}
                  <div className="mt-2.5 flex items-center justify-between pt-1.5 border-t border-slate-100">
                    <span className="text-sm font-extrabold text-slate-900">
                      ₹{service.price}
                    </span>

                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-600 transition-transform group-hover:bg-blue-600 group-hover:text-white group-hover:translate-x-0.5">
                      <ArrowRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* ================= HOW HOMECAREX WORKS (CLEAN STEPPER FLOW) ================= */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 ring-1 ring-blue-500/15">
              <span>⚡</span>
              <span>SIMPLE 4-STEP PROCESS</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              How HomeCareX <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">Works</span>
            </h2>
          </div>
          <Link
            to="/services"
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <span>Explore All</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Clean Professional Stepper Card */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-2xs">
          <div className="relative">
            {/* Continuous Stepper Connector Line */}
            <div
              className="absolute left-[17px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-blue-500 via-indigo-500 to-[#ff8a3d] rounded-full"
              aria-hidden="true"
            />

            <div className="space-y-3.5">
              {stepperSteps.map((step, idx) => {
                const isExpanded = hoveredStepperStep === idx;

                return (
                  <div
                    key={step.number}
                    className="relative flex items-start gap-3.5 group cursor-pointer rounded-xl p-1.5 -m-1.5 transition-colors hover:bg-slate-50/70"
                    onMouseEnter={() => setHoveredStepperStep(idx)}
                    onMouseLeave={() => setHoveredStepperStep(null)}
                    onClick={() => setHoveredStepperStep(hoveredStepperStep === idx ? null : idx)}
                  >
                    {/* Step Number Circle */}
                    <div
                      className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-extrabold text-xs shadow-xs ring-4 transition-transform duration-200 group-hover:scale-105 ${step.nodeColor}`}
                    >
                      {step.number}
                    </div>

                    {/* Step Details */}
                    <div className="flex-1 pt-0.5 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {step.title}
                        </h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold border ${step.tagColor}`}
                          >
                            {step.tag}
                          </span>
                          <ChevronDown
                            className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${
                              isExpanded ? "rotate-180 text-blue-600" : "group-hover:rotate-180"
                            }`}
                          />
                        </div>
                      </div>

                      {/* Step Description: shown on hover / tap */}
                      <div
                        className={`grid transition-all duration-300 ease-out overflow-hidden ${
                          isExpanded
                            ? "grid-rows-[1fr] opacity-100 mt-1"
                            : "grid-rows-[0fr] opacity-0 group-hover:grid-rows-[1fr] group-hover:opacity-100 group-hover:mt-1"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <p className="text-[11px] text-slate-500 leading-relaxed font-normal pt-0.5">
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stepper Footer Action */}
          <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between bg-gradient-to-r from-blue-50/50 to-orange-50/50 rounded-xl px-3 py-2">
            <span className="text-[11px] font-semibold text-slate-700">
              Ready for hassle-free service?
            </span>
            <Link
              to="/services"
              className="inline-flex items-center gap-1 rounded-lg bg-[#4338ca] px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs transition-transform active:scale-95 hover:bg-indigo-700"
            >
              <span>Book a Service</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ================= WHAT CUSTOMERS SAY ================= */}
      {mobileReviews.length > 0 && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div>
              <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-400/20">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>TESTIMONIALS</span>
              </div>
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">
                What Customers Say
              </h2>
            </div>

            <Link
              to="/reviews"
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <span>View All</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Testimonials Horizontal Carousel */}
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {mobileReviews.map((t) => (
              <div
                key={t.id}
                className="flex min-w-[260px] max-w-[270px] shrink-0 flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs"
              >
                <div>
                  {/* Author Info & Rating */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-[11px] font-bold text-white shadow-2xs">
                        {t.name
                          .split(" ")
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 leading-tight">
                          {t.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {t.city}
                        </div>
                      </div>
                    </div>

                    {/* 5 Stars */}
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {[...Array(Math.round(t.rating || 5))].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  {/* Service Tag */}
                  <div className="mt-2.5">
                    <span className="inline-block rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
                      {t.service}
                    </span>
                  </div>

                  {/* Quote */}
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 italic">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>

                {/* Verified Badge */}
                <div className="mt-3 flex items-center gap-1 text-[10px] font-semibold text-emerald-600 pt-2 border-t border-slate-100">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Verified Customer Booking</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= FREQUENTLY ASKED QUESTIONS (CLEAN NO-CARD CAROUSEL) ================= */}
      <div className="py-2 select-none">
        {/* Centered Heading Matching Desktop Text Color */}
        <div className="text-center">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-0.5 text-[11px] font-bold text-orange-700 ring-1 ring-orange-400/20 shadow-2xs">
            <span className="flex h-1.5 w-1.5 rounded-full bg-[#ff8a3d] animate-pulse" />
            <span>GOT QUESTIONS?</span>
          </div>
          <h2 className="text-[17px] sm:text-2xl font-extrabold tracking-tight text-[#1e1b4b] leading-tight whitespace-nowrap">
            Frequently Asked{" "}
            <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
        </div>

        {/* Q&A Carousel with Left/Right Arrows (No Card Border, No Background Color) */}
        <div
          className="relative mt-5 min-h-[140px] flex flex-col justify-center px-1"
          onTouchStart={handleFaqTouchStart}
          onTouchMove={handleFaqTouchMove}
          onTouchEnd={handleFaqTouchEnd}
        >
          {/* Left Chevron Button */}
          <button
            type="button"
            onClick={() => setFaqSlide((prev) => (prev - 1 + mobileFaqs.length) % mobileFaqs.length)}
            aria-label="Previous question"
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-800 active:scale-90 transition cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Right Chevron Button */}
          <button
            type="button"
            onClick={() => setFaqSlide((prev) => (prev + 1) % mobileFaqs.length)}
            aria-label="Next question"
            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-800 active:scale-90 transition cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Slide Question & Answer */}
          <div className="px-8 sm:px-10 text-center transition-all duration-300">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
              {mobileFaqs[faqSlide].question}
            </h3>
            <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 max-w-sm mx-auto">
              {mobileFaqs[faqSlide].answer}
            </p>
          </div>

          {/* Dot Indicators */}
          <div className="mt-5 flex items-center justify-center gap-2">
            {mobileFaqs.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setFaqSlide(idx)}
                aria-label={`Go to question ${idx + 1}`}
                className={`rounded-full transition-all duration-300 cursor-pointer ${
                  faqSlide === idx
                    ? "h-2 w-2.5 bg-[#4338ca] scale-110"
                    : "h-1.5 w-1.5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Bottom Navigation Links */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-4 text-xs font-bold">
          <Link
            to="/faq"
            className="text-[#4338ca] hover:text-indigo-800 transition inline-flex items-center gap-1"
          >
            <span>More FAQs</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
          <span className="text-slate-300">•</span>
          <button
            type="button"
            onClick={() => navigate("/contact")}
            data-testid="mobile-faq-support-btn"
            className="text-[#ff8a3d] hover:text-[#ea580c] transition inline-flex items-center gap-1 cursor-pointer"
          >
            <span>Contact Support</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ================= PROMO / ACTION CARDS CAROUSEL ================= */}
      <div className="space-y-2 pt-1">
        <div
          className="relative overflow-hidden rounded-2xl border border-slate-200/80 shadow-xs"
          onTouchStart={handlePromoTouchStart}
          onTouchEnd={handlePromoTouchEnd}
        >
          <div
            className="flex transition-transform duration-500 ease-out will-change-transform"
            style={{ transform: `translateX(-${activePromoSlide * 100}%)` }}
          >
            {/* Slide 1: Need Help With Your Home? */}
            <div className="w-full shrink-0 bg-[#eef0ff] p-4 flex flex-col justify-between min-h-[175px]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4338ca] text-white shadow-xs">
                  <HomeIcon className="h-5 w-5" />
                </span>

                <div className="flex-1">
                  <h2 className="text-base font-bold text-[#1e1b6e] leading-snug">
                    Need help with your{" "}
                    <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">
                      home?
                    </span>
                  </h2>

                  <p className="mt-1 text-xs leading-relaxed text-[#5b5b7a] font-normal">
                    Find reliable home services and make home maintenance simple, quick, and convenient.
                  </p>

                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <Link
                      to="/services"
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#ff8a3d] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-transform active:scale-95 hover:bg-[#ff7a22]"
                    >
                      <span>Explore Services</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      onClick={() => navigate("/contact")}
                      className="inline-flex items-center rounded-xl border border-[#4338ca] px-3.5 py-2 text-xs font-bold text-[#4338ca] transition-transform active:scale-95 hover:bg-[#4338ca] hover:text-white cursor-pointer"
                      aria-label="Contact Us"
                    >
                      <span>Contact Us</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Slide 2: Are You A Service Professional? */}
            <div className="w-full shrink-0 bg-gradient-to-br from-[#fff7ed] via-[#fff3ea] to-[#ffedd5] p-4 flex flex-col justify-between min-h-[175px]">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff8a3d] text-white shadow-xs">
                  <Wrench className="h-5 w-5" />
                </span>

                <div className="flex-1">
                  <h2 className="text-base font-bold text-[#1e1b6e] leading-snug">
                    Are you a service{" "}
                    <span className="bg-gradient-to-r from-[#4338ca] via-indigo-600 to-[#6366f1] bg-clip-text text-transparent">
                      professional?
                    </span>
                  </h2>

                  <p className="mt-1 text-xs leading-relaxed text-slate-600 font-normal">
                    Join HomeCareX and connect with customers looking for your skills. Get flexible hours, transparent rates &amp; reliable payouts.
                  </p>

                  <div className="mt-3.5 flex flex-wrap items-center gap-2">
                    <Link
                      to="/register/partner"
                      className="group inline-flex items-center gap-1.5 rounded-xl bg-[#4338ca] px-4 py-2 text-xs font-bold text-white shadow-xs transition-transform active:scale-95 hover:bg-[#1e1b6e]"
                    >
                      <span>Join as a Professional</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Carousel Dots */}
        <div className="flex items-center justify-center gap-1.5 pt-0.5">
          {[0, 1].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActivePromoSlide(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activePromoSlide === idx
                  ? "w-5 bg-indigo-600"
                  : "w-1.5 bg-slate-300 hover:bg-slate-400"
              }`}
              aria-label={`Go to promo slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MobileHome;