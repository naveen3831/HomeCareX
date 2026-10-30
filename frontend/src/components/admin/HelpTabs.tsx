import React from 'react';
import { Headset, ClipboardList } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';

const TABS = [
  { to: '/admin/support', label: 'Support', icon: Headset, permission: 'tickets:view' },
  { to: '/admin/leads', label: 'Leads', icon: ClipboardList, permission: 'leads:view' },
];

/**
 * Switch between the two pages of the sidebar's Help group (Support and Leads).
 * Tabs the admin has no permission for are left out.
 */
export const HelpTabs: React.FC = () => {
  const { can } = usePermissions();
  const tabs = TABS.filter((tab) => can(tab.permission));
  if (tabs.length < 2) return null;

  return (
    <nav className="help-tabs" aria-label="Help sections">
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `help-tabs__link${isActive ? ' is-active' : ''}`}>
          <Icon size={16} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
};

export default HelpTabs;
