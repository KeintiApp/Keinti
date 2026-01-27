import React, { createContext, useContext, useMemo } from 'react';
import type { Language, TranslationKey } from './translations';
import { translations } from './translations';

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  language,
  setLanguage,
  children,
}: {
  language: Language;
  setLanguage: (language: Language) => void;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(() => {
    const table = translations[language] || translations.es;
    return {
      language,
      setLanguage,
      t: (key: TranslationKey) => table[key] ?? translations.es[key] ?? String(key),
    };
  }, [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return ctx;
}
