import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translate, type AppLanguage } from './translations';

const STORAGE_KEY = 'app_language';
const SUPPORTED: AppLanguage[] = ['en', 'hi', 'te'];

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (next: AppLanguage) => void;
  /** Translate an English UI string. Falls back to the English text when no translation exists. */
  t: (text: string) => string;
};

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: () => undefined,
  t: (text) => text,
});

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (SUPPORTED as string[]).includes(value);
}

function readStored(): AppLanguage {
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (isAppLanguage(v)) return v;
  } catch {
    // Storage can be blocked (private mode); fall back to English.
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(readStored);

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  // Keep several open tabs in step.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isAppLanguage(e.newValue)) setLanguageState(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t: (text) => translate(text, language) }),
    [language, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
export const useT = () => useContext(LanguageContext).t;