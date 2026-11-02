import React, { useEffect, useRef, useState } from "react";
import { ShieldCheck, CalendarCheck, Home, Award } from "lucide-react";

/**
 * Scroll reveal helper for TrustStrip
 */
function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return [ref, seen] as const;
}

const Reveal: React.FC<{ children: React.ReactNode; delay?: number; className?: string }> = ({
  children,
  delay = 0,
  className = "",
}) => {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`hcx-reveal ${seen ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

const points = [
  {
    icon: <ShieldCheck className="h-6 w-6" />,
    badgeColor: "bg-blue-50 text-blue-600 ring-1 ring-blue-500/15 group-hover:bg-blue-600 group-hover:text-white",
    title: "Reliable professionals",
    text: "Connect with skilled, verified people who take care of your home.",
  },
  {
    icon: <CalendarCheck className="h-6 w-6" />,
    badgeColor: "bg-orange-50 text-[#ff8a3d] ring-1 ring-orange-500/15 group-hover:bg-[#ff8a3d] group-hover:text-white",
    title: "Easy booking",
    text: "Find a service and choose a time that suits your schedule.",
  },
  {
    icon: <Home className="h-6 w-6" />,
    badgeColor: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/15 group-hover:bg-indigo-600 group-hover:text-white",
    title: "Convenient service",
    text: "Manage all your home service needs smoothly in one place.",
  },
  {
    icon: <Award className="h-6 w-6" />,
    badgeColor: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/15 group-hover:bg-emerald-600 group-hover:text-white",
    title: "Quality focused",
    text: "Reliable, professional work you can count on, every time.",
  },
];

const TrustStrip: React.FC = () => (
  <section className="bg-white py-8 sm:py-10 relative overflow-hidden">
    {/* Subtle ambient lighting */}
    <div className="pointer-events-none absolute -top-24 right-10 -z-10 h-72 w-72 rounded-full bg-orange-100/30 blur-3xl hcx-pulse-ambient" aria-hidden="true" />
    <div className="pointer-events-none absolute -bottom-24 left-10 -z-10 h-72 w-72 rounded-full bg-blue-100/30 blur-3xl hcx-pulse-ambient" aria-hidden="true" />

    <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
      <Reveal className="mx-auto mb-6 sm:mb-7 max-w-2xl text-center">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-600 ring-1 ring-blue-500/15 shadow-xs">
          <span>✦</span>
          <span>The HomeCareX Difference</span>
        </div>
        <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#1e1b4b] tracking-tight leading-tight">
          Why choose <span className="text-[#4338ca]">Home</span><span className="bg-gradient-to-r from-[#ff8a3d] to-[#f97316] bg-clip-text text-transparent">Care</span><span className="text-[#4338ca]">X</span>?
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-[#5b5b7a] leading-relaxed">
          We make home maintenance easier, faster and more convenient for everyone.
        </p>
      </Reveal>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 sm:gap-6">
        {points.map((p, i) => (
          <Reveal key={p.title} delay={i * 80}>
            <div className="group h-full rounded-2xl bg-[#eef0ff]/70 border border-[#4338ca]/10 p-6 sm:p-7 transition-all duration-300 hover:-translate-y-1.5 hover:bg-white hover:border-blue-400/40 hover:shadow-lg">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl shadow-xs transition-all duration-300 group-hover:scale-105 ${p.badgeColor}`}
                aria-hidden="true"
              >
                {p.icon}
              </div>
              <h3 className="mt-5 text-base sm:text-lg font-bold text-[#1e1b6e] group-hover:text-blue-600 transition-colors">
                {p.title}
              </h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-[#5b5b7a]">
                {p.text}
              </p>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  </section>
);

export default TrustStrip;
