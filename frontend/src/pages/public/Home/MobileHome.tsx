import React, { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  Star,
  Heart,
  Tag,
  ShieldCheck,
  Clock,
  Headphones,
  Sparkles,
  Wrench,
  Flower2,
  Paintbrush,
  Bug,
  Tv,
  ChevronDown,
  CheckCircle2,
  Home as HomeIcon,
} from "lucide-react";
import { AuthContext } from "@/context/AuthContext";

/* =========================================================
   MOBILE HOME VIEW
   Native mobile app experience matching reference mockup
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

const categoryIcons = [
  {
    id: "home-cleaning",
    name: "Home Cleaning",
    icon: Sparkles,
    bgClass: "bg-purple-100/80 text-purple-600 border-purple-200/50",
    link: "/services?category=home-cleaning",
  },
  {
    id: "appliance-repair",
    name: "Appliance Repair",
    icon: Tv,
    bgClass: "bg-blue-100/80 text-blue-600 border-blue-200/50",
    link: "/services?category=appliance-repair-service",
  },
  {
    id: "salon-spa",
    name: "Salon & Spa",
    icon: Flower2,
    bgClass: "bg-pink-100/80 text-pink-500 border-pink-200/50",
    link: "/services?category=salon-spa",
  },
  {
    id: "electrical-plumbing",
    name: "Electrical & Plumbing",
    icon: Wrench,
    bgClass: "bg-amber-100/80 text-amber-600 border-amber-200/50",
    link: "/services?category=electrical-plumbing",
  },
  {
    id: "painting-waterproofing",
    name: "Painting & Waterproofing",
    icon: Paintbrush,
    bgClass: "bg-teal-100/80 text-teal-600 border-teal-200/50",
    link: "/services?category=painting-waterproofing",
  },
  {
    id: "pest-control",
    name: "Pest Control",
    icon: Bug,
    bgClass: "bg-rose-100/80 text-rose-500 border-rose-200/50",
    link: "/services?category=pest-control",
  },
];

const heroSlides = [
  {
    eyebrow: "CLEANER HOMES, HAPPIER LIVES",
    titlePrimary: "Professional",
    titleAccent: "Home Services",
    titleSuffix: "at Your Doorstep",
    subtitle: "Verified professionals. Transparent pricing. Hassle-free booking.",
    cta: "Book a Service",
    link: "/services",
  },
  {
    eyebrow: "REPAIR & INSTALLATION",
    titlePrimary: "Expert AC &",
    titleAccent: "Appliance Repair",
    titleSuffix: "Starting at ₹399",
    subtitle: "Trained mechanics with genuine spare parts & 30-day warranty.",
    cta: "Explore Repairs",
    link: "/services?category=appliance-repair-service",
  },
  {
    eyebrow: "HYGIENE & DISINFECTION",
    titlePrimary: "Deep Home",
    titleAccent: "Cleaning & Spa",
    titleSuffix: "Right at Home",
    subtitle: "Safe, chemical-grade deep clean for kitchens, bathrooms & sofas.",
    cta: "Book Cleaning",
    link: "/services?category=home-cleaning",
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

const mobileTestimonials = [
  {
    id: "t1",
    name: "Priya Sharma",
    city: "Bengaluru",
    service: "Full Home Deep Cleaning",
    rating: 5,
    quote: "HomeCareX arrived on time, left every tile and window spotless. Booking was effortless!",
  },
  {
    id: "t2",
    name: "Rahul Kumar",
    city: "Hyderabad",
    service: "Emergency Plumbing",
    rating: 5,
    quote: "Pipe burst fixed in 40 mins with zero surge pricing. Honest, prompt, and highly professional.",
  },
  {
    id: "t3",
    name: "Vikramaditya V.",
    city: "Mumbai",
    service: "AC Deep Servicing",
    rating: 5,
    quote: "Rescued us in peak heat. Quick diagnosis, genuine parts, and ice cold cooling within an hour.",
  },
  {
    id: "t4",
    name: "Ananya Reddy",
    city: "Chennai",
    service: "Electrical Safety Check",
    rating: 5,
    quote: "Polite technicians, total safety gear, and great service. I trust them completely for my parents.",
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
      text: "Good morning",
      icon: "☀️",
      sub: "Start your day with sparkling doorstep services",
    };
  }
  if (hour < 17) {
    return {
      text: "Good afternoon",
      icon: "🌤️",
      sub: "Book trusted professionals for today's maintenance",
    };
  }
  return {
    text: "Good evening",
    icon: "🌙",
    sub: "Relax while our verified experts handle your home care",
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
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Auto rotate hero carousel every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % heroSlides.length);
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

  const currentSlide = heroSlides[activeSlide];

  return (
    <div className="block md:hidden bg-[#fdfdfd] pb-24 px-4 pt-3 space-y-4">
      {/* ================= GREETING CARD ================= */}
      <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-r from-white via-indigo-50/40 to-orange-50/50 border border-slate-200/80 p-3.5 shadow-2xs">
        {/* Soft background ambient glow */}
        <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-orange-100/40 blur-xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-indigo-100/30 blur-xl" aria-hidden="true" />

        <div className="relative z-10">
          {/* Top Row: Greeting Pill & Quick Action Button */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 shadow-2xs border border-slate-200/70 text-[11px] font-semibold text-slate-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span>{greeting.text} {greeting.icon}</span>
              <span className="text-slate-300">•</span>
              <span className="text-[10px] font-bold text-emerald-600">Active in Hyderabad</span>
            </div>

            <Link
              to={user ? "/bookings" : "/services"}
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#ff8a3d] to-[#f97316] px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs transition-transform active:scale-95 hover:opacity-95"
            >
              <span>{user ? "Bookings" : "Flat 20% OFF"}</span>
              <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>

          {/* Bottom Row: Full-width Headline & Subtext (NO TRUNCATION) */}
          <div className="mt-2.5">
            <h2 className="text-[17px] font-extrabold tracking-tight text-slate-900 leading-snug">
              {user?.name ? (
                <>Hey, <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">{user.name.split(" ")[0]}</span>! 👋</>
              ) : (
                <>Welcome to <span className="bg-gradient-to-r from-[#4338ca] via-indigo-600 to-[#ff8a3d] bg-clip-text text-transparent">HomeCareX</span> 👋</>
              )}
            </h2>
            <p className="mt-1 text-xs text-slate-500 font-medium leading-relaxed">
              {greeting.sub}
            </p>
          </div>
        </div>
      </div>

      {/* ================= HERO CAROUSEL CARD ================= */}
      <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#eff3ff] via-[#e5edfb] to-[#f5f2ff] border border-indigo-100/70 p-4 sm:p-5 shadow-xs">
        {/* Soft background ambient gradient glow */}
        <div
          className="pointer-events-none absolute -right-10 -bottom-10 h-44 w-44 rounded-full bg-indigo-200/40 blur-2xl"
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col justify-between min-h-[185px]">
          {/* Text Content */}
          <div className="max-w-[62%]">
            <span className="text-[10px] font-extrabold tracking-wider text-[#4f46e5] uppercase">
              {currentSlide.eyebrow}
            </span>

            <h2 className="mt-1 text-[21px] font-black leading-[1.18] tracking-tight text-slate-900">
              {currentSlide.titlePrimary}{" "}
              <span className="text-[#4338ca]">{currentSlide.titleAccent}</span>{" "}
              {currentSlide.titleSuffix}
            </h2>

            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-600 font-medium line-clamp-2">
              {currentSlide.subtitle}
            </p>

            <Link
              to={currentSlide.link}
              className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-[#ff8a3d] px-3.5 py-2 text-xs font-bold text-white shadow-[0_4px_12px_rgba(255,138,61,0.35)] transition-transform active:scale-95 hover:bg-[#f97316]"
            >
              <span>{currentSlide.cta}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Cleaner Technician Cutout Image */}
          <div className="absolute -right-2 bottom-0 w-[42%] max-w-[195px] pointer-events-none select-none">
            <img
              src="/images/mobile/hero-cleaner.png"
              alt="Verified home service professional"
              className="h-[185px] w-auto object-contain object-bottom ml-auto"
              onError={(e) => {
                // Fallback if cropped asset not loaded
                e.currentTarget.src = "/images/home-cleaning.webp";
              }}
            />
          </div>

          {/* Floating Verified Professionals Badge */}
          <div className="absolute right-3 top-3 z-20 flex items-center gap-1.5 rounded-xl bg-white/95 px-2.5 py-1 shadow-sm border border-slate-100 backdrop-blur-xs">
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <div className="text-[9px] font-bold text-slate-800 leading-tight">
              Verified<br />Professionals
            </div>
          </div>

          {/* Carousel Dots */}
          <div className="flex items-center justify-center gap-1.5 pt-4">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setActiveSlide(index)}
                aria-label={`Go to slide ${index + 1}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  activeSlide === index
                    ? "w-4 bg-slate-900"
                    : "w-1.5 bg-indigo-200 hover:bg-indigo-300"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ================= SEARCH & FILTER BAR ================= */}
      <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2.5 rounded-2xl border border-slate-200/90 bg-[#f8fafc] px-3.5 py-2.5 shadow-2xs focus-within:border-blue-500 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition-all">
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
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-[#f1f5f9] text-slate-700 shadow-2xs transition-all active:scale-95 hover:bg-slate-200"
          aria-label="Filter services"
        >
          <SlidersHorizontal className="h-4 w-4 text-slate-700" />
        </Link>
      </form>

      {/* ================= QUICK CATEGORY ICONS ================= */}
      <div className="py-1">
        <div className="grid grid-cols-6 gap-2 text-center">
          {categoryIcons.map((cat) => {
            const Icon = cat.icon;
            return (
              <Link
                key={cat.id}
                to={cat.link}
                className="group flex flex-col items-center transition-transform active:scale-95"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border shadow-xs transition-transform duration-200 group-hover:scale-105 ${cat.bgClass}`}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <span className="mt-1.5 block text-[10px] font-semibold text-slate-700 leading-tight">
                  {cat.name}
                </span>
              </Link>
            );
          })}
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

      {/* ================= PROMO / DISCOUNT BANNER ================= */}
      <div className="relative overflow-hidden rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-100/90 via-amber-50 to-orange-50/80 p-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="max-w-[62%]">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-white shadow-xs">
              <Tag className="h-4 w-4" />
            </span>

            <h3 className="mt-1.5 text-base font-black text-slate-900 leading-tight">
              Flat <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">20% OFF</span>
            </h3>

            <p className="text-[11px] font-medium text-slate-600">
              On Your First Booking
            </p>

            <button
              type="button"
              onClick={handleCopyCoupon}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#f97316] bg-white/90 px-2.5 py-1 text-[10px] font-bold text-[#f97316] shadow-2xs transition-all active:scale-95 hover:bg-white"
            >
              <span>{copiedCoupon ? "Copied! ✓" : "Use Code: HOME20"}</span>
            </button>
          </div>

          <div className="w-[36%] max-w-[130px] shrink-0 select-none">
            <img
              src="/images/mobile/promo-woman.png"
              alt="Special discount offer"
              className="h-auto w-full rounded-xl object-cover shadow-2xs"
              onError={(e) => {
                e.currentTarget.src = "/images/home-cleaning.webp";
              }}
            />
          </div>
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

            <div className="space-y-4">
              {stepperSteps.map((step) => (
                <div key={step.number} className="relative flex items-start gap-3.5 group">
                  {/* Step Number Circle */}
                  <div
                    className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white font-extrabold text-xs shadow-xs ring-4 ${step.nodeColor}`}
                  >
                    {step.number}
                  </div>

                  {/* Step Details */}
                  <div className="flex-1 pt-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {step.title}
                      </h3>
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold border shrink-0 ${step.tagColor}`}
                      >
                        {step.tag}
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 leading-relaxed font-normal">
                      {step.desc}
                    </p>
                  </div>
                </div>
              ))}
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

      {/* ================= WHY CHOOSE HOMECAREX? ================= */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-500/15">
              <ShieldCheck className="h-3 w-3" />
              <span>TRUST &amp; GUARANTEE</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Why Choose <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">HomeCareX?</span>
            </h2>
          </div>
          <Link
            to="/about"
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* 2 Rows (2x2 Grid) */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Verified Professionals */}
          <div className="flex items-start gap-2.5 rounded-2xl bg-white border border-slate-200/80 p-3 shadow-2xs">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600 shrink-0 shadow-2xs">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-tight">
                Verified Professionals
              </div>
              <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                Trained &amp; background checked
              </div>
            </div>
          </div>

          {/* Transparent Pricing */}
          <div className="flex items-start gap-2.5 rounded-2xl bg-white border border-slate-200/80 p-3 shadow-2xs">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-100 text-blue-600 font-bold text-sm shrink-0 shadow-2xs">
              ₹
            </span>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-tight">
                Transparent Pricing
              </div>
              <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                Upfront &amp; no hidden charges
              </div>
            </div>
          </div>

          {/* On-Time Service */}
          <div className="flex items-start gap-2.5 rounded-2xl bg-white border border-slate-200/80 p-3 shadow-2xs">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shrink-0 shadow-2xs">
              <Clock className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-tight">
                On-Time Service
              </div>
              <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                Prompt doorstep arrival
              </div>
            </div>
          </div>

          {/* 24/7 Support */}
          <button
            type="button"
            onClick={() => navigate("/contact")}
            className="flex items-start text-left gap-2.5 rounded-2xl bg-white border border-slate-200/80 p-3 shadow-2xs transition-all active:scale-95 hover:border-orange-200 group w-full"
            aria-label="24/7 Support"
            data-testid="mobile-support-card"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-orange-600 shrink-0 shadow-2xs transition-transform group-hover:scale-105">
              <Headphones className="h-4 w-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-900 leading-tight group-hover:text-orange-600 transition-colors">
                24/7 Support
              </div>
              <div className="text-[10px] text-slate-500 mt-1 leading-tight">
                Dedicated help desk
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* ================= WHAT CUSTOMERS SAY ================= */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700 ring-1 ring-amber-500/20">
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              <span>REAL EXPERIENCES</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              What Customers <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">Say</span>
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
          {mobileTestimonials.map((t) => (
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
                    {[...Array(5)].map((_, i) => (
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

      {/* ================= FREQUENTLY ASKED QUESTIONS ================= */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between">
          <div>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-0.5 text-[10px] font-bold text-orange-700 ring-1 ring-orange-400/20">
              <span>💬</span>
              <span>GOT QUESTIONS?</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">
              Frequently Asked <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">Questions</span>
            </h2>
          </div>
          <Link
            to="/faq"
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <span>More FAQs</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* FAQ Accordion List */}
        <div className="space-y-2">
          {mobileFaqs.map((faq, index) => {
            const isOpen = openFaq === index;
            return (
              <div
                key={faq.question}
                className={`overflow-hidden rounded-2xl border transition-all ${
                  isOpen
                    ? "border-orange-300 bg-orange-50/20 shadow-xs"
                    : "border-slate-200/80 bg-white"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left transition-colors"
                  aria-expanded={isOpen}
                >
                  <span className="text-xs font-bold text-slate-900 leading-snug">
                    {faq.question}
                  </span>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ${
                      isOpen
                        ? "rotate-180 bg-orange-500 text-white shadow-2xs"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                </button>

                {isOpen && (
                  <div className="px-3 pb-3 pt-0 text-[11px] leading-relaxed text-slate-600 border-t border-orange-100/60 mt-1">
                    <p className="pt-2">{faq.answer}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Still Have Questions Box */}
        <div className="mt-3 flex items-center justify-between rounded-2xl bg-indigo-50/70 border border-indigo-100 p-3 shadow-2xs">
          <div>
            <div className="text-xs font-bold text-slate-900">Have more questions?</div>
            <div className="text-[10px] text-slate-500 mt-0.5">We reply in ~5 mins</div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/contact")}
            className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition-transform active:scale-95 hover:bg-indigo-700"
            aria-label="Contact Support"
            data-testid="mobile-faq-support-btn"
          >
            <span>Contact Support</span>
            <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* ================= NEED HELP WITH YOUR HOME? ================= */}
      <div className="relative overflow-hidden rounded-2xl bg-[#eef0ff] border border-indigo-200/60 p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4338ca] text-white shadow-xs">
            <HomeIcon className="h-5 w-5" />
          </span>

          <div className="flex-1">
            <h2 className="text-base font-bold text-[#1e1b6e] leading-snug">
              Need help with your <span className="bg-gradient-to-r from-[#ff8a3d] via-[#f97316] to-[#ff6b00] bg-clip-text text-transparent">home?</span>
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
                className="inline-flex items-center rounded-xl border border-[#4338ca] px-3.5 py-2 text-xs font-bold text-[#4338ca] transition-transform active:scale-95 hover:bg-[#4338ca] hover:text-white"
                aria-label="Contact Us"
              >
                <span>Contact Us</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= ARE YOU A SERVICE PROFESSIONAL? ================= */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#fff7ed] via-[#fff3ea] to-[#ffedd5] border border-orange-200/80 p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ff8a3d] text-white shadow-xs">
            <Wrench className="h-5 w-5" />
          </span>

          <div className="flex-1">
            <h2 className="text-base font-bold text-[#1e1b6e] leading-snug">
              Are you a service <span className="bg-gradient-to-r from-[#4338ca] via-indigo-600 to-[#6366f1] bg-clip-text text-transparent">professional?</span>
            </h2>

            <p className="mt-1 text-xs leading-relaxed text-slate-600 font-normal">
              Join HomeCareX and connect with customers looking for your skills. Get flexible hours, transparent rates &amp; reliable payouts.
            </p>

            <div className="mt-3">
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
  );
};

export default MobileHome;