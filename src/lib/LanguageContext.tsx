import React, { createContext, useContext, useState, useCallback } from 'react';
import { type Language, type TranslationKey, getTranslation } from './i18n';

const LANG_KEY = 'app_language';

function getStoredLanguage(): Language {
  const stored = localStorage.getItem(LANG_KEY);
  if (stored === 'vi' || stored === 'ja') return stored;
  return 'vi';
}

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'vi',
  setLanguage: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(LANG_KEY, lang);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => getTranslation(language, key),
    [language],
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
