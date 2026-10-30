import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { buildAdminMenu } from './adminMobileNav';

/**
 * Phone replacement for the sidebar drawer: every sidebar page that is not on the
 * bottom bar, as grouped rounded cards, with Sign out last. Hidden on desktop.
 */
export const AdminAccountMenu: React.FC = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { can } = usePermissions();
  const groups = buildAdminMenu(can);

  const signOut = () => {
    void logout().finally(() => navigate('/login', { replace: true }));
  };

  return (
    <nav className="hcx-acctmenu" aria-label="Admin menu">
      {groups.map((group) => {
        const headingId = `hcx-acct-${group.heading.toLowerCase()}`;
        return (
          <section key={group.heading} aria-labelledby={headingId}>
            <h2 id={headingId} className="hcx-acctmenu__heading">
              {group.heading}
            </h2>
            <ul className="hcx-acctmenu__card">
              {group.items.map(({ label, path, icon: Icon }) => (
                <li key={path}>
                  <Link to={path} className="hcx-acctmenu__row">
                    <span
                      className={`hcx-acctmenu__icon hcx-tint--${group.tint}`}
                      aria-hidden="true"
                    >
                      <Icon size={20} />
                    </span>
                    <span className="hcx-acctmenu__label">{label}</span>
                    <ChevronRight
                      size={16}
                      className="hcx-acctmenu__chev"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <button type="button" className="hcx-acctmenu__signout" onClick={signOut}>
        <LogOut size={18} aria-hidden="true" />
        Sign out
      </button>
    </nav>
  );
};

export default AdminAccountMenu;
