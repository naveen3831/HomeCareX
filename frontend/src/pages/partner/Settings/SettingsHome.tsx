import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Bell, ChevronRight, Globe, LogOut, MapPin, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useT } from '@/i18n/LanguageContext';
import { SETTINGS_HOME } from './paths';
import './settings.css';

const QUERY = '(max-width: 900px)';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.matchMedia(QUERY).matches);
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    const onChange = () => setMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return mobile;
}

const ITEMS = [
  { id: 'notifications', label: 'Notifications', hint: 'Push, SMS and email', icon: Bell },
  { id: 'privacy', label: 'Privacy', hint: 'Location and customer contact', icon: MapPin },
  { id: 'security', label: 'Security', hint: 'Login alerts and sessions', icon: Shield },
  { id: 'other', label: 'Other', hint: 'Language, help and legal', icon: Globe },
] as const;

/** /partner/settings: a list of sections on phones, a redirect to Notifications on desktop. */
export default function SettingsHome() {
  const isMobile = useIsMobile();
  const { logout } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  if (!isMobile) return <Navigate to={SETTINGS_HOME} replace />;

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="ps-root">
      <nav className="ps-hub-list" aria-label={t('Settings sections')}>
        {ITEMS.map((it) => {
          const Icon = it.icon;
          return (
            <Link key={it.id} to={`/partner/settings/${it.id}`} className={`ps-hub-item ps-tile-${it.id}`}>
              <span className="ps-hub-tile" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="ps-row-text">
                <span className="ps-hub-label">{t(it.label)}</span>
                <span className="ps-muted">{t(it.hint)}</span>
              </span>
              <ChevronRight size={18} className="ps-chevron" aria-hidden="true" />
            </Link>
          );
        })}
      </nav>

      <div className="ps-group">
        <button type="button" className="ps-btn ps-btn-danger" onClick={() => void signOut()} disabled={signingOut}>
          <LogOut size={18} aria-hidden="true" />
          {signingOut ? t('Signing out...') : t('Log out')}
        </button>
      </div>
    </div>
  );
}