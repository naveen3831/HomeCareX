import React, { useEffect, useRef, useState } from "react";
import { CalendarCheck, Clock, Home, Sparkles } from "lucide-react";

interface StatItem {
  id: string;
  icon: string;
  title: string;
  description: string;
}

/*
 * Initial / fallback statistics.
 * Clean, professional highlights displayed across the platform.
 */
const INITIAL_STATS: StatItem[] = [
  {
    id: "STAT001",
    icon: "calendar",
    title: "Easy Booking",
    description: "Find and book the service you need with ease.",
  },
  {
    id: "STAT002",
    icon: "clock",
    title: "Flexible Scheduling",
    description: "Choose a convenient time for your service.",
  },
  {
    id: "STAT003",
    icon: "home",
    title: "Home Convenience",
    description: "Get the services you need at your doorstep.",
  },
  {
    id: "STAT004",
    icon: "sparkles",
    title: "Simple Experience",
    description: "Manage your home service journey in one place.",
  },
];

/**
 * True once the element has scrolled into view.
 * Runs only once.
 */
function useSeen<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin: "0px 0px -40px 0px",
      }
    );

    observer.observe(el);

    return () => observer.disconnect();
  }, [threshold]);

  return [ref, seen] as const;
}

const getStatTheme = (id: string, title: string) => {
  const t = title.toLowerCase();
  if (id === "STAT001" || t.includes("booking") || t.includes("calendar")) {
    return {
      icon: <CalendarCheck className="h-5 w-5" />,
      badge: "bg-blue-50 text-blue-600 ring-1 ring-blue-500/15 group-hover:bg-blue-600 group-hover:text-white",
    };
  }
  if (id === "STAT002" || t.includes("schedul") || t.includes("time") || t.includes("clock")) {
    return {
      icon: <Clock className="h-5 w-5" />,
      badge: "bg-orange-50 text-[#f97316] ring-1 ring-orange-500/15 group-hover:bg-[#f97316] group-hover:text-white",
    };
  }
  if (id === "STAT003" || t.includes("home") || t.includes("doorstep") || t.includes("convenience")) {
    return {
      icon: <Home className="h-5 w-5" />,
      badge: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/15 group-hover:bg-indigo-600 group-hover:text-white",
    };
  }
  return {
    icon: <Sparkles className="h-5 w-5" />,
    badge: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-500/15 group-hover:bg-emerald-600 group-hover:text-white",
  };
};

const StatsStrip: React.FC = () => {
  const [stats, setStats] = useState<StatItem[]>(INITIAL_STATS);
  const [ref, seen] = useSeen<HTMLDivElement>();

  useEffect(() => {
    if (!seen) return undefined;

    let active = true;

    const fetchStats = async () => {
      try {
        const response = await fetch("/api/stats");
        if (!response.ok) return;

        const data: StatItem[] = await response.json();
        if (active && Array.isArray(data) && data.length > 0) {
          setStats(data);
        }
      } catch (error) {
        console.log("Using initial statistics:", error);
      }
    };

    fetchStats();

    return () => {
      active = false;
    };
  }, [seen]);

  if (stats.length === 0) {
    return null;
  }

  return (
    <section className="relative overflow-hidden bg-white pt-4 pb-2 sm:pt-5 sm:pb-2">
      <div ref={ref} className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
          {stats.map((stat, index) => {
            const theme = getStatTheme(stat.id, stat.title);
            return (
              <div
                key={stat.id}
                className="group relative flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-4.5 sm:p-5 shadow-xs transition-all duration-300 hover:-translate-y-1 hover:border-blue-400/50 hover:shadow-md"
                style={{
                  opacity: seen ? 1 : 0,
                  transform: seen ? "none" : "translateY(18px)",
                  transition: `opacity .6s ease ${index * 80}ms, transform .6s cubic-bezier(.2,.7,.2,1) ${index * 80}ms, box-shadow .3s, border-color .3s`,
                }}
              >
                {/* Icon */}
                <div
                  className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl shadow-xs transition-all duration-300 group-hover:scale-105 ${theme.badge}`}
                  aria-hidden="true"
                >
                  {theme.icon}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 transition-colors duration-200 group-hover:text-blue-600 leading-snug">
                    {stat.title}
                  </h3>
                  <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed font-normal">
                    {stat.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default StatsStrip;
