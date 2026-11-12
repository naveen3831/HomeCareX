import { useEffect, useState } from 'react';
import { fetchSiteSettings, type SiteSettings } from '@/services/siteSettingsApi';

// Shared by every component on the page, so the footer asks the server once, not once per render.
let latest: SiteSettings | null = null;
const listeners = new Set<(s: SiteSettings) => void>();

const refresh = async (): Promise<void> => {
  try {
    latest = await fetchSiteSettings();
    listeners.forEach((fn) => fn(latest as SiteSettings));
  } catch {
    // Keep showing the last good values (or the built-in fallbacks) if the server cannot be reached.
  }
};

/**
 * Contact details and social links the admin saved in Settings.
 * Returns null until the first answer arrives. Re-checks when the tab is focused again, so a change
 * made in the admin shows up on the website without a full reload.
 */
export function useSiteSettings(): SiteSettings | null {
  const [settings, setSettings] = useState<SiteSettings | null>(latest);

  useEffect(() => {
    listeners.add(setSettings);
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      listeners.delete(setSettings);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return settings;
}