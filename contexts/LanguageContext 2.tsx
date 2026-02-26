"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Language = "en" | "es";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: string) => key,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  useEffect(() => {
    // Load saved language preference or detect browser language
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("appLanguage") as Language | null;
      if (saved === "en" || saved === "es") {
        setLanguageState(saved);
        document.documentElement.lang = saved;
      } else {
        // Detect browser language
        const browserLang = navigator.language.split("-")[0];
        const detectedLang = browserLang === "es" ? "es" : "en";
        setLanguageState(detectedLang);
        document.documentElement.lang = detectedLang;
      }
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem("appLanguage", lang);
      // Set HTML lang attribute
      document.documentElement.lang = lang;
    }
  };

  const t = (key: string): string => {
    const { translations } = require("@/lib/i18n/translations");
    return translations[language]?.[key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
