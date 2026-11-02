import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Wrench, Zap } from "lucide-react";

interface CategoryCardProps {
  id: string;
  name: string;
  description: string;
  image: string;
  serviceCount?: number;
  link: string;
  icon?: string | React.ReactNode;
}

// Custom Faucet Icon for plumbing
export const FaucetIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M7 12h10M12 12v4a3 3 0 01-3 3H8" />
    <path d="M7 8h10a2 2 0 012 2v2H5v-2a2 2 0 012-2z" />
    <path d="M12 4v4" />
    <path d="M9 4h6" />
  </svg>
);

// Custom Broom / Mop Icon for cleaning
export const BroomIcon: React.FC<{ className?: string }> = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 3l3 3-9.5 9.5a2.5 2.5 0 01-1.5.7l-4 1 1-4a2.5 2.5 0 01.7-1.5L18 3z" />
    <path d="M3 21l3-3" />
    <path d="M6 18l-3 3" />
    <path d="M9 15l-3 3" />
    <path d="M14 8l2 2" />
  </svg>
);

const CategoryCard: React.FC<CategoryCardProps> = ({
  id,
  name,
  description,
  image,
  link,
}) => {
  // Theme per category ID matching Image 1
  const getTheme = () => {
    switch (id) {
      case "home-cleaning":
        return {
          icon: <BroomIcon className="w-5 h-5 text-blue-500" />,
          colorClasses: "bg-blue-50 text-blue-500",
        };
      case "plumbing":
        return {
          icon: <FaucetIcon className="w-5 h-5 text-blue-500" />,
          colorClasses: "bg-blue-50 text-blue-500",
        };
      case "electrical":
        return {
          icon: <Zap className="w-5 h-5 text-amber-500" />,
          colorClasses: "bg-amber-50 text-amber-500",
        };
      case "appliance-repair":
        return {
          icon: <Wrench className="w-5 h-5 text-emerald-500" />,
          colorClasses: "bg-emerald-50 text-emerald-500",
        };
      default:
        return {
          icon: <Sparkles className="w-5 h-5 text-blue-500" />,
          colorClasses: "bg-blue-50 text-blue-500",
        };
    }
  };

  const theme = getTheme();

  return (
    <Link
      to={link}
      aria-label={name}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white border border-slate-200/80 shadow-xs transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg hover:border-blue-400/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
    >
      {/* Photo */}
      <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-slate-100">
        <img
          src={image}
          alt={name}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-106"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      {/* Card Content - Compact & Minimal without wasted space */}
      <div className="p-4 sm:p-5 flex flex-col bg-white">
        {/* Icon Badge */}
        <div
          className={`w-8 h-8 rounded-xl flex items-center justify-center mb-2.5 shadow-xs transition-all duration-300 group-hover:scale-110 ${theme.colorClasses}`}
        >
          {theme.icon}
        </div>

        {/* Title */}
        <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug transition-colors duration-200 group-hover:text-blue-600">
          {name}
        </h3>

        {/* Description */}
        <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed line-clamp-2">
          {description}
        </p>

        {/* Bottom Action */}
        <div className="mt-3.5 flex items-center justify-between pt-2.5 border-t border-slate-100">
          <span className="text-xs font-semibold text-blue-600 transition-colors group-hover:text-blue-700">
            View services
          </span>
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-300 group-hover:translate-x-1 shadow-xs ${theme.colorClasses}`}
            aria-hidden="true"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
};

export default CategoryCard;
