import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutGrid, CalendarCheck, MessageCircle, User } from "lucide-react";

export interface MobileBottomNavProps {
  className?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ className = "" }) => {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const navItems = [
    {
      to: "/",
      label: "Home",
      icon: Home,
      isActive: pathname === "/",
    },
    {
      to: "/services",
      label: "Services",
      icon: LayoutGrid,
      isActive: pathname.startsWith("/services"),
    },
    {
      to: "/customer/bookings",
      label: "Bookings",
      icon: CalendarCheck,
      isActive: pathname.startsWith("/customer/bookings"),
    },
    {
      to: "/contact",
      label: "Support",
      icon: MessageCircle,
      isActive: pathname === "/contact" || pathname === "/support" || pathname.startsWith("/customer/support"),
    },
    {
      to: "/customer/profile",
      label: "Profile",
      icon: User,
      isActive: pathname.startsWith("/customer/profile") || pathname === "/login",
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className={`fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] px-2 py-1.5 pb-[max(8px,env(safe-area-inset-bottom))] md:hidden ${className}`}
    >
      <div className="mx-auto flex max-w-md items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.isActive;

          return (
            <button
              key={item.label}
              type="button"
              onClick={() => navigate(item.to)}
              className={`group flex min-w-[54px] flex-col items-center justify-center gap-1 rounded-xl py-1 transition-all duration-200 active:scale-95 ${
                active ? "text-blue-600 font-bold" : "text-slate-500 hover:text-slate-900 font-medium"
              }`}
              aria-current={active ? "page" : undefined}
              aria-label={item.label}
              data-testid={`mobile-nav-${item.label.toLowerCase()}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center transition-transform duration-200 ${
                  active ? "scale-105" : "group-hover:scale-105"
                }`}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.4 : 1.9}
                  fill={active && item.label === "Home" ? "currentColor" : "none"}
                />
              </span>
              <span className="text-[10px] leading-none tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
