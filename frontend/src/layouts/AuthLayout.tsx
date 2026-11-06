import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  IndianRupee,
  Clock,
  Handshake,
  TrendingUp,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const partnerHighlightSlides = [
  [
    { icon: TrendingUp, title: 'Get More Bookings' },
    { icon: IndianRupee, title: 'Increase Your Earnings' },
  ],
  [
    { icon: CalendarDays, title: 'Flexible Work Schedule' },
    { icon: ShieldCheck, title: 'Verified & Trusted Platform' },
  ],
];

const AuthLayout: React.FC = () => {
  const location = useLocation();
  const isPartner = location.pathname.startsWith('/register/partner');
  const isRegister = location.pathname.startsWith('/register') && !isPartner;

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Prevent outer browser window scrollbar on desktop auth screens
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        document.documentElement.style.overflowY = 'hidden';
        document.body.style.overflowY = 'hidden';
      } else {
        document.documentElement.style.overflowY = '';
        document.body.style.overflowY = '';
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => {
      document.documentElement.style.overflowY = '';
      document.body.style.overflowY = '';
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!isPartner || isPaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % partnerHighlightSlides.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [isPartner, isPaused]);

  // Background image assignment:
  // Login: auth-bg-1.png (modern white coffee table with smooth wall arch)
  // Register: auth-bg-2.png (warm wood coffee table with double flowing waves)
  // Partner Registration: auth-bg-partner.png (uploaded background with service trio & house watermark)
  const bgImage = isPartner
    ? '/images/auth/auth-bg-partner.png'
    : isRegister
    ? '/images/auth/auth-bg-2.png'
    : '/images/auth/auth-bg-1.png';

  return (
    <div
      className={`auth-layout-root w-full ${
        isPartner
          ? 'min-h-[100dvh] lg:h-screen lg:max-h-screen lg:min-h-0 lg:overflow-hidden p-0 sm:py-4 lg:py-6 sm:px-6 lg:px-12 xl:px-16'
          : 'min-h-[100dvh] lg:h-screen lg:max-h-screen lg:min-h-0 lg:overflow-hidden p-0 sm:py-3 lg:py-3 sm:px-6 lg:px-8'
      } relative flex flex-col items-center justify-center bg-white lg:bg-transparent`}
    >
      {/* Mobile Background: Seamless clean background without framing card */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none lg:hidden bg-white"
      />

      {/* Desktop Fullscreen Illustration Background: only visible on lg (1024px+) screens */}
      <div
        className={`fixed inset-0 -z-10 pointer-events-none hidden lg:block ${
          isPartner ? 'bg-[#F7FAFF]' : 'bg-[#FAF7F2]'
        } bg-no-repeat transition-all duration-300 ${
          isPartner
            ? 'bg-cover bg-left-bottom'
            : 'bg-center lg:bg-bottom lg:bg-[length:100%_auto] 2xl:bg-cover'
        }`}
        style={{ backgroundImage: `url(${bgImage})` }}
      />
      {/* Main container: wide container with left context aside to left and right card on right */}
      <div
        className="w-full max-w-7xl 2xl:max-w-[1440px] mx-auto relative z-10 flex flex-col lg:flex-row items-center justify-between gap-0 lg:gap-10 xl:gap-14 my-auto px-0 sm:px-4 lg:px-6"
      >
        {/* LEFT COLUMN: Clean visual branding panel matching the mockup */}
        <div
          className="hidden lg:flex flex-col justify-start self-start w-full max-w-md lg:max-w-lg xl:max-w-xl select-none relative space-y-2 xl:space-y-2.5 shrink-0 pt-2 lg:pt-3 pl-1 sm:pl-3"
        >
          {/* Top Row: Logo & Join as Partner in one row */}
          <div className="flex items-center gap-4 sm:gap-5 shrink-0">
            <Link to="/" className="inline-flex transition-transform duration-200 hover:scale-105" aria-label="HomeCareX Home">
              <img
                src="/logo.webp"
                alt="HomeCareX"
                className="h-7 sm:h-7.5 md:h-8 xl:h-8.5 w-auto object-contain"
              />
            </Link>

            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50/90 border border-blue-200/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-2xs">
              {isPartner ? (
                <Handshake className="h-3.5 w-3.5 text-blue-600" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              )}
              <span>{isPartner ? 'Join as a Partner' : 'Trusted Home Service Platform'}</span>
            </div>
          </div>

          {/* Main Headline */}
          <h1 className="text-xl sm:text-2xl xl:text-3xl 2xl:text-[36px] font-black text-slate-900 tracking-tight leading-tight whitespace-nowrap">
            {isPartner ? (
              <>
                Partner with <span className="text-blue-600">HomeCare</span><span className="text-[#ff8a3d]">X</span>
              </>
            ) : (
              <>
                Professional<br />
                <span className="text-blue-600">Home Services</span><br />
                at Your Doorstep
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm xl:text-base text-slate-600 font-medium max-w-md leading-relaxed">
            {isPartner
              ? 'Grow your business with a trusted home service platform.'
              : 'Book, manage, and track trusted home services easily.'}
          </p>

          {/* Trust feature bullets: 2 points in 1 row carousel animation for partner */}
          {isPartner ? (
            <div
              className="pt-1.5 w-full select-none"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {/* Carousel Viewport: 1 row with 2 points */}
              <div className="overflow-hidden w-full relative py-0.5">
                <div
                  className="flex transition-transform duration-500 ease-out"
                  style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                >
                  {partnerHighlightSlides.map((slide, sIdx) => (
                    <div
                      key={sIdx}
                      className="w-full shrink-0 flex items-center gap-4 sm:gap-6 xl:gap-8"
                    >
                      {slide.map((item, iIdx) => (
                        <div
                          key={iIdx}
                          className="flex items-center gap-2 xl:gap-2.5 shrink-0"
                        >
                          <span className="flex h-6 w-6 xl:h-7 xl:w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100/90 text-blue-600 shadow-2xs">
                            <item.icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="text-xs sm:text-[13px] xl:text-sm font-bold text-slate-800 tracking-tight whitespace-nowrap">
                            {item.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Carousel Indicators & Controls */}
              <div className="flex items-center gap-2 pt-2">
                <div className="flex items-center gap-1.5">
                  {partnerHighlightSlides.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentSlide(idx)}
                      aria-label={`Go to slide ${idx + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        currentSlide === idx
                          ? 'w-6 bg-blue-600 shadow-2xs'
                          : 'w-2 bg-blue-200 hover:bg-blue-300'
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-0.5 ml-2 text-slate-400">
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentSlide((prev) =>
                        prev === 0 ? partnerHighlightSlides.length - 1 : prev - 1
                      )
                    }
                    aria-label="Previous slide"
                    className="p-1 hover:text-blue-600 rounded transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setCurrentSlide((prev) =>
                        prev === partnerHighlightSlides.length - 1 ? 0 : prev + 1
                      )
                    }
                    aria-label="Next slide"
                    className="p-1 hover:text-blue-600 rounded transition-colors"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="pt-2 space-y-2.5">
              <div className="flex">
                <div className="inline-flex items-center gap-3 px-3.5 py-2 rounded-full bg-white/95 border border-slate-200/80 shadow-2xs text-xs sm:text-sm font-bold text-slate-800">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <ShieldCheck className="h-3.5 w-3.5" />
                  </span>
                  <span>Verified Professionals</span>
                </div>
              </div>
              <div className="flex">
                <div className="inline-flex items-center gap-3 px-3.5 py-2 rounded-full bg-white/95 border border-slate-200/80 shadow-2xs text-xs sm:text-sm font-bold text-slate-800">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <IndianRupee className="h-3.5 w-3.5" />
                  </span>
                  <span>Transparent Pricing</span>
                </div>
              </div>
              <div className="flex">
                <div className="inline-flex items-center gap-3 px-3.5 py-2 rounded-full bg-white/95 border border-slate-200/80 shadow-2xs text-xs sm:text-sm font-bold text-slate-800">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <Clock className="h-3.5 w-3.5" />
                  </span>
                  <span>On-Time Service</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Full width on mobile without card framing, card area on desktop */}
        <div className="flex justify-center lg:justify-end items-center w-full lg:w-auto shrink-0 p-0 sm:pr-4 xl:pr-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
