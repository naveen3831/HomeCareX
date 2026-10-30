import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
import { ADMIN_TABS, activeTabKey } from './adminMobileNav';

/**
 * Admin mobile bottom bar (below 1024px, where the sidebar is hidden):
 * Home / Bookings / Categories / Finance / Profile.
 * Categories also covers Services (opened from a category) and Finance covers
 * Payments, Refunds and Payouts. Every other admin page is on the Profile tab.
 * Tabs the admin has no permission for are left out.
 */
export const AdminBottomNav: React.FC = () => {
  const { pathname } = useLocation();
  const { can } = usePermissions();

  const tabs = ADMIN_TABS.flatMap((tab) => {
    if (!can(tab.permission)) return [];
    const to = typeof tab.to === 'function' ? tab.to(can) : tab.to;
    return to ? [{ ...tab, to }] : [];
  });

  const activeKey = activeTabKey(pathname, tabs);

  return (
    <nav className="hcx-bottomnav" aria-label="Primary">
      <ul className="hcx-bottomnav__list">
        {tabs.map(({ key, label, to, icon: Icon }) => {
          const active = key === activeKey;
          return (
            <li key={key} className="hcx-bottomnav__item">
              <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                className={`hcx-bottomnav__link${active ? ' is-active' : ''}`}
              >
                <span className="hcx-bottomnav__icon" aria-hidden="true">
                  <Icon size={22} strokeWidth={active ? 2.2 : 1.9} />
                </span>
                <span className="hcx-bottomnav__label">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};

export default AdminBottomNav;
