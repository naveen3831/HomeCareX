
import React, { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, X } from "lucide-react";

import { useUIStore } from "@/store/useUIStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useAuth } from "@/context/AuthContext";
import {
  adminNavGroups,
  findAdminPage,
} from "@/config/adminNav";
import { HomeCarexMark } from "@/components/band/Homecarexmark";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { usePermissions } from "@/hooks/usePermissions";

const visibleGroups = adminNavGroups.filter(
  (group) => !group.hidden,
);

/**
 * Admin sidebar.
 * Desktop: sticky navigation with optional icon-only collapse.
 * Mobile: off-canvas drawer closed on navigation, overlay click, or Escape.
 */
export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const { can } = usePermissions();

  const storedCollapsed = useUIStore(
    (state) => state.isSidebarCollapsed,
  );
  const isMobileMenuOpen = useUIStore(
    (state) => state.isMobileMenuOpen,
  );
  const closeMobileMenu = useUIStore(
    (state) => state.closeMobileMenu,
  );

  const isCollapsed = storedCollapsed && isDesktop;

  const user = useAuthStore((state) => state.user);
  const { logout } = useAuth();

  const displayName = String(user?.name ?? "Admin");
  const currentPage = findAdminPage(pathname);

  const [openGroup, setOpenGroup] = useState(
    currentPage?.groupName ?? "Overview",
  );

  // Keep the active page's navigation group open.
  useEffect(() => {
    const page = findAdminPage(pathname);

    if (page && !page.groupName.includes("Account")) {
      setOpenGroup(page.groupName);
    }

    closeMobileMenu();
  }, [pathname, closeMobileMenu]);

  // Allow Escape to close the mobile navigation drawer.
  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen, closeMobileMenu]);

  const handleSignOut = () => {
    void logout().finally(() => {
      navigate("/login", { replace: true });
    });
  };

  const sidebarClassName = [
    "admin-sidebar",
    isCollapsed ? "is-collapsed" : "",
    isMobileMenuOpen ? "is-mobile-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {isMobileMenuOpen && (
        <div
          className="sidebar-overlay"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}

      <aside
        className={sidebarClassName}
        aria-label="Admin navigation"
      >
        <div className="sidebar-brand">
          <div className="sidebar-brand__top">
            <div className="sidebar-brand__logo">
              <span className="sidebar-brand__icon">
                <HomeCarexMark size={22} />
              </span>

              {!isCollapsed && (
                <span className="sidebar-brand__name">
                  HomeCareX
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={closeMobileMenu}
              className="sidebar-close-btn"
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleGroups.map((group) => {
            const items = group.items.filter((item) =>
              can(item.permission),
            );

            if (items.length === 0) {
              return null;
            }

            const isOpen =
              isCollapsed || openGroup === group.groupName;

            return (
              <div
                key={group.groupName}
                className="nav-group"
              >
                {!isCollapsed && (
                  <button
                    type="button"
                    className="nav-group__title nav-group__toggle"
                    aria-expanded={isOpen}
                    onClick={() =>
                      setOpenGroup((current) =>
                        current === group.groupName
                          ? ""
                          : group.groupName,
                      )
                    }
                  >
                    <span>{group.groupName}</span>

                    <ChevronDown
                      size={14}
                      aria-hidden="true"
                      className={`nav-group__chevron${
                        isOpen ? " is-open" : ""
                      }`}
                    />
                  </button>
                )}

                {isOpen && (
                  <ul className="nav-list">
                    {items.map((item) => {
                      const Icon = item.icon;

                      return (
                        <li key={item.path}>
                          <NavLink
                            to={item.path}
                            end={item.path === "/admin"}
                            title={
                              isCollapsed
                                ? item.label
                                : undefined
                            }
                            className={({ isActive }) =>
                              `nav-link${
                                isActive ? " is-active" : ""
                              }`
                            }
                          >
                            <Icon
                              className="nav-link__icon"
                              size={20}
                              aria-hidden="true"
                            />

                            {!isCollapsed && (
                              <span className="nav-link__label">
                                {item.label}
                              </span>
                            )}

                            {isCollapsed && (
                              <span className="sr-only">
                                {item.label}
                              </span>
                            )}
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            type="button"
            className="sidebar-footer__user sidebar-footer__user-btn"
            title={isCollapsed ? displayName : undefined}
            onClick={() => navigate("/admin/profile")}
          >
            <span className="avatar">
              {displayName.charAt(0).toUpperCase()}
            </span>

            {!isCollapsed && (
              <span className="profile-name">
                {displayName}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="sidebar-signout-btn"
            title="Sign out"
          >
            <LogOut size={18} aria-hidden="true" />

            {!isCollapsed && <span>Sign out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
