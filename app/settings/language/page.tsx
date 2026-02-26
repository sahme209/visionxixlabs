"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/contexts/LanguageContext";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CheckIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";

type Language = "en" | "es";

const languages: { code: Language; name: string; nativeName: string }[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
];

export default function LanguageSettingsPage() {
  const router = useRouter();
  const { language, setLanguage: setLanguageContext } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  const handleLanguageChange = (lang: Language) => {
    setSelectedLanguage(lang);
    setLanguageContext(lang);
    // Small delay to show selection, then go back
    setTimeout(() => {
      router.push("/settings");
    }, 300);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <div className="surface-dark relative bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.04] hidden md:block" aria-hidden="true" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 w-full min-w-0 py-6">
          <div className="flex items-center gap-4 mb-4">
            <Link
              href="/settings"
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-white" />
            </Link>
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center border border-white/30">
              <GlobeAltIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold">Language / Idioma</h1>
              <p className="text-gray-100 text-sm">Select your preferred language</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 w-full min-w-0 py-8">
        <div className="uscis-card p-6">
          <p className="text-sm text-[var(--text-secondary)] mb-6">
            Choose your preferred language. The interface will update immediately.
          </p>

          <div className="space-y-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                  selectedLanguage === lang.code
                    ? "border-[var(--uscis-blue)] bg-[var(--bg-surface-alt)]"
                    : "border-[var(--border-color)] bg-[var(--bg-surface-alt)] hover:border-[var(--uscis-blue)]/50"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl font-semibold ${
                      selectedLanguage === lang.code
                        ? "bg-[var(--uscis-blue)] text-white"
                        : "bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    }`}
                  >
                    {lang.code === "en" ? "🇺🇸" : "🇪🇸"}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-[var(--text-primary)]">
                      {lang.nativeName}
                    </p>
                    <p className="text-sm text-[var(--text-secondary)]">{lang.name}</p>
                  </div>
                </div>
                {selectedLanguage === lang.code && (
                  <div className="w-6 h-6 rounded-full bg-[var(--uscis-blue)] flex items-center justify-center">
                    <CheckIcon className="w-4 h-4 text-white" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
