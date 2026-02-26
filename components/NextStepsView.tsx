"use client";

import React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES } from "@/lib/images";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import {
  LockClosedIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon,
  ClipboardIcon,
  MicrophoneIcon,
  BuildingOfficeIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  CheckIcon,
} from "@heroicons/react/24/solid";
import { PremiumUpsell } from "./PremiumUpsell";
import { loadAllCountries, type CountryInfo } from "@/lib/utils/countries";
import ProgressChart from "@/components/charts/ProgressChart";
import StageCompletionChart from "@/components/charts/StageCompletionChart";
import ProcessFlowDiagram from "@/components/ProcessFlowDiagram";

type Section = "nvc" | "dq" | "interview";

interface StepData {
  nvc: string[];
  dq: string[];
  interview: string[];
}

// Default steps matching iOS
const defaultSteps: StepData = {
  nvc: [
    "Receive your case number and invoice.",
    "Pay fees online promptly.",
    "Submit the DS-260 immigrant visa application form.",
    "Wait for NVC document review and approval.",
  ],
  dq: [
    "Prepare and gather all required civil documents.",
    "Obtain police certificates and medical exams.",
    "Make sure translations and notarizations are done correctly.",
  ],
  interview: [
    "Schedule your consular interview.",
    "Attend the interview with all original documents.",
    "Answer questions honestly and provide additional documents if requested.",
    "Wait for visa approval and passport return.",
  ],
};

// Country-specific overrides matching iOS
const countryOverrides: Record<string, StepData> = {
  India: {
    nvc: [
      "Get your case number and fee invoice via email.",
      "Pay fees through designated Indian payment centers.",
      "Complete and submit your DS-260 form online.",
      "Wait for NVC's confirmation to proceed.",
    ],
    dq: [
      "Gather your birth and marriage certificates translated to English.",
      "Complete all police clearances including local and regional.",
      "Undergo medical exam only at authorized panel physicians.",
    ],
    interview: [
      "Schedule your interview at the U.S. Embassy in New Delhi or consulates.",
      "Bring all originals plus two sets of scanned copies.",
      "Prepare for additional questions about financial support and intent.",
    ],
  },
  Pakistan: {
    nvc: [
      "You will receive your case number and fee instructions by mail or email.",
      "Pay the fees at designated banks or online portals.",
      "Complete the DS-260 visa application carefully.",
      "Wait for NVC document review and instructions.",
    ],
    dq: [
      "Collect all required civil documents with proper translations.",
      "Police certificates must be obtained from all places of residence.",
      "Panel physician medical exams must be scheduled in advance.",
    ],
    interview: [
      "Interview usually takes place at the U.S. Embassy in Islamabad.",
      "Bring all required paperwork organized and originals.",
      "Be prepared to discuss your background and visa intent.",
    ],
  },
  Philippines: {
    nvc: [
      "Check your case number and pay fees through the NVC website.",
      "Complete and submit your DS-260 online.",
      "Wait for NVC to schedule your document review.",
    ],
    dq: [
      "Gather birth, marriage, and police certificates duly authenticated.",
      "Complete your medical exam with an accredited physician.",
      "Ensure all documents meet U.S. Embassy standards.",
    ],
    interview: [
      "Attend your interview at the U.S. Embassy in Manila.",
      "Prepare original documents and photocopies.",
      "Answer all consular questions clearly and truthfully.",
    ],
  },
  Bangladesh: {
    nvc: [
      "Receive case number and follow fee instructions.",
      "Pay fees via approved methods; keep receipts.",
      "Complete DS-260 carefully and submit.",
      "Await NVC document review.",
    ],
    dq: [
      "Collect civil documents and translations as needed.",
      "Obtain police certificates from all jurisdictions.",
      "Schedule medical exam with panel physician.",
    ],
    interview: [
      "Interview typically at U.S. Embassy Dhaka.",
      "Bring originals and photocopies; organize by category.",
      "Follow post-interview passport return instructions.",
    ],
  },
  Nepal: {
    nvc: [
      "Confirm case number and pay fees online.",
      "Submit DS-260 with accurate biographic data.",
      "Upload civil documents per NVC guidance.",
    ],
    dq: [
      "Police certificates from local authorities.",
      "Certified translations to English if required.",
      "Book medical with panel physician in Kathmandu.",
    ],
    interview: [
      "Interview at U.S. Embassy Kathmandu.",
      "Carry appointment letter, DS-260 confirmation, and photos.",
      "Collect passport via courier after approval.",
    ],
  },
  Mexico: {
    nvc: [
      "Receive case number and pay fees via portal.",
      "Complete DS-260 accurately; verify addresses.",
      "Upload civil docs per NVC checklist.",
    ],
    dq: [
      "Police certificates if applicable.",
      "Translations to English where required.",
      "Schedule medical exam with panel physician.",
    ],
    interview: [
      "Interview often at U.S. Consulate Ciudad Juárez (varies).",
      "Bring financial support evidence (I-864, tax docs).",
      "Follow consulate's security and passport return process.",
    ],
  },
};

// Embassy info matching iOS
const embassyInfo: Record<string, { location: string; contactURL: string }> = {
  India: {
    location: "U.S. Embassy New Delhi; Consulates: Mumbai, Chennai, Hyderabad, Kolkata",
    contactURL: "https://in.usembassy.gov/visas/",
  },
  Pakistan: {
    location: "U.S. Embassy Islamabad; Consulates: Karachi, Lahore",
    contactURL: "https://pk.usembassy.gov/visas/",
  },
  Philippines: {
    location: "U.S. Embassy Manila",
    contactURL: "https://ph.usembassy.gov/visas/",
  },
  Bangladesh: {
    location: "U.S. Embassy Dhaka",
    contactURL: "https://bd.usembassy.gov/visas/",
  },
  Nepal: {
    location: "U.S. Embassy Kathmandu",
    contactURL: "https://np.usembassy.gov/visas/",
  },
  Mexico: {
    location: "U.S. Consulate Ciudad Juárez (varies)",
    contactURL: "https://mx.usembassy.gov/visas/",
  },
};

// Country flag emojis
function flagEmoji(country: string): string {
  const flags: Record<string, string> = {
    India: "🇮🇳",
    Pakistan: "🇵🇰",
    Philippines: "🇵🇭",
    Bangladesh: "🇧🇩",
    Nepal: "🇳🇵",
    "Sri Lanka": "🇱🇰",
    Mexico: "🇲🇽",
    China: "🇨🇳",
    Nigeria: "🇳🇬",
    "United Kingdom": "🇬🇧",
    Canada: "🇨🇦",
  };
  return flags[country] || "🌍";
}

export default function NextStepsView() {
  const { profile } = useProfile();
  const { isSubscribed, hasUsedTrial } = useSubscription();
  
  const [selectedSection, setSelectedSection] = useState<Section>("nvc");
  const [selectedCountry, setSelectedCountry] = useState(profile?.country || "");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearchText, setCountrySearchText] = useState("");
  const [allCountries, setAllCountries] = useState<CountryInfo[]>([]);
  
  // Load all countries on mount
  useEffect(() => {
    const countries = loadAllCountries();
    setAllCountries(countries);
  }, []);
  
  // Filter countries based on search
  const filteredCountries = React.useMemo(() => {
    if (!countrySearchText.trim()) {
      return allCountries;
    }
    const searchLower = countrySearchText.toLowerCase();
    return allCountries.filter(
      (country) =>
        country.name.toLowerCase().includes(searchLower) ||
        country.code.toLowerCase().includes(searchLower)
    );
  }, [allCountries, countrySearchText]);
  
  const effectiveCountry = selectedCountry || profile?.country || "";
  
  // Get steps for selected section and country
  const getSteps = (): string[] => {
    const countrySteps = countryOverrides[effectiveCountry];
    if (countrySteps) {
      return countrySteps[selectedSection] || defaultSteps[selectedSection];
    }
    return defaultSteps[selectedSection];
  };
  
  const steps = getSteps();
  
  // Check if form type is I-130 (Action Plan is for I-130 only)
  const isI130 = profile?.formType?.toUpperCase() === "I-130" || !profile?.formType;
  
  if (!isSubscribed) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--hero-dark)] via-[var(--hero-dark-soft)] to-[var(--hero-dark)] border-b border-white/10">
          <div className="absolute inset-0 w-full">
            <Image src={HERO_IMAGES.familyTravel} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
            <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.12)_0%,_transparent_50%)]" aria-hidden />
          </div>
          <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shrink-0 shadow-lg">
                <ClipboardIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#ffffff" }}>Action Plan</h1>
                <p className="text-sm sm:text-base mt-1" style={{ color: "#ffffff" }}>Your personalized step-by-step guide—NVC, DQ, interview</p>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          {/* Preview: Process flow diagram (Travel.State.Gov style) */}
          <div className="mb-8">
            <ProcessFlowDiagram
              selectedCountry={profile?.country || ""}
              selectedSection="nvc"
              onSectionSelect={() => {}}
            />
          </div>
          <div className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)]/50 shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
            <div className="p-12 sm:p-16 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/25">
                <LockClosedIcon className="w-10 h-10 text-white" />
              </div>
              <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-emerald-500 dark:text-emerald-400 mb-4">Premium</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-3 tracking-tight">Your Personalized Action Plan</h2>
              <p className="text-base text-[var(--text-secondary)] mb-8 max-w-lg mx-auto leading-relaxed">
                Never miss a step: custom plan, country-specific guidance, NVC & DQ checklists, interview prep.
              </p>
              <Link
                href="/subscribe"
                className="inline-flex flex-col items-center gap-2 px-8 py-4 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white text-base font-semibold rounded-2xl hover:from-emerald-700 hover:to-emerald-800 transition-all shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-2">
                  <span>Subscribe to Unlock</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                </div>
                {!hasUsedTrial && (
                  <span className="text-xs font-medium text-white/90 bg-white/20 px-3 py-1 rounded-full">
                    3-Day Free Trial
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="relative overflow-hidden bg-gradient-to-br from-[var(--hero-dark)] via-[var(--hero-dark-soft)] to-[var(--hero-dark)] border-b border-white/10">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.familyTravel} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.12)_0%,_transparent_50%)]" aria-hidden />
        </div>
        <div className="relative w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shrink-0 shadow-lg">
              <ClipboardIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#ffffff" }}>Action Plan</h1>
              <p className="text-sm sm:text-base mt-1" style={{ color: "#ffffff" }}>Your personalized step-by-step guide—NVC, DQ, interview</p>
            </div>
          </div>
        </div>
      </div>
      <div className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)]/50 shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
          <div className="p-6 sm:p-8 lg:p-10 space-y-8">
            {/* I-130 Only Notice */}
            {!isI130 && (
              <div className="rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800/60 p-5">
                <div className="flex items-start gap-3">
                  <InformationCircleIcon className="w-5 h-5 text-gray-700 dark:text-gray-300 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] mb-1">
                      Action Plan is for I-130 Form Type Only
                    </h3>
                    <p className="text-sm text-[var(--text-secondary)]">
                      This feature provides step-by-step guidance specifically for I-130 (Family Petition) cases. Your current form type is {profile?.formType || "Unknown"}.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Country Selector - Expandable with full country list */}
            <div className="space-y-3">
              <button
                onClick={() => setShowCountryPicker(!showCountryPicker)}
                className="w-full rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface-alt)]/40 p-5 hover:bg-[var(--bg-surface-alt)]/60 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{flagEmoji(effectiveCountry)}</span>
                  <div className="flex-1 text-left">
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Country</p>
                    <p className="font-semibold text-[var(--text-primary)]">
                      {effectiveCountry || "General (No country)"}
                    </p>
                  </div>
                  <ChevronDownIcon
                    className={`w-5 h-5 text-[var(--text-secondary)] transition-transform ${
                      showCountryPicker ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              {/* Country Picker Dropdown */}
              {showCountryPicker && (
                <div className="rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface-alt)]/40 p-5 max-h-96 overflow-hidden flex flex-col">
                  {/* Search */}
                  <div className="mb-4">
                    <div className="relative">
                      <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
                      <input
                        type="text"
                        placeholder="Search countries..."
                        value={countrySearchText}
                        onChange={(e) => setCountrySearchText(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)] text-[var(--text-primary)] placeholder-[var(--text-secondary)]"
                      />
                    </div>
                  </div>

                  {/* Country List */}
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {/* General option */}
                    <button
                      onClick={() => {
                        setSelectedCountry("");
                        setShowCountryPicker(false);
                        setCountrySearchText("");
                      }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors ${
                        effectiveCountry === "" ? "bg-[var(--uscis-blue)]/10" : ""
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🌍</span>
                        <span className="text-sm font-medium text-[var(--text-primary)]">
                          General (No country)
                        </span>
                      </div>
                      {effectiveCountry === "" && (
                        <CheckIcon className="w-5 h-5 text-[var(--text-primary)]" />
                      )}
                    </button>

                    {/* All countries */}
                    {filteredCountries.map((country) => (
                      <button
                        key={country.code}
                        onClick={() => {
                          setSelectedCountry(country.name);
                          setShowCountryPicker(false);
                          setCountrySearchText("");
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-lg hover:bg-[var(--bg-surface-alt)] transition-colors ${
                          effectiveCountry === country.name ? "bg-[var(--uscis-blue)]/10" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{flagEmoji(country.name)}</span>
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {country.name}
                          </span>
                        </div>
                        {effectiveCountry === country.name && (
                          <CheckIcon className="w-5 h-5 text-[var(--text-primary)]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Embassy Info Link */}
              {embassyInfo[effectiveCountry] && (
                <a
                  href={embassyInfo[effectiveCountry].contactURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface-alt)]/40 p-5 hover:bg-[var(--bg-surface-alt)]/60 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <BuildingOfficeIcon className="w-5 h-5 text-[var(--text-primary)]" />
                      <div>
                        <p className="text-sm font-semibold text-[var(--text-primary)]">Embassy Info</p>
                        <p className="text-xs text-[var(--text-secondary)]">{embassyInfo[effectiveCountry].location}</p>
                      </div>
                    </div>
                    <span className="text-sm text-gray-800 dark:text-gray-200">→</span>
                  </div>
                </a>
              )}
            </div>
            
            {/* Process Flow Diagram — Travel.State.Gov style, country-specific */}
            <ProcessFlowDiagram
              selectedCountry={effectiveCountry}
              selectedSection={selectedSection}
              onSectionSelect={setSelectedSection}
            />
            
            {/* Section Explanation Box */}
            <div className="rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface-alt)]/40 p-6 overflow-hidden">
              <div className="flex items-start gap-3">
                <InformationCircleIcon className="w-5 h-5 text-gray-800 dark:text-gray-200 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-[var(--text-primary)] mb-1.5">Understanding the Stages</p>
                  <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 leading-relaxed">
                    <li><strong className="text-[var(--text-primary)]">NVC (National Visa Center):</strong> After USCIS approves your case, NVC handles your paperwork. You'll get a case number and pay fees here.</li>
                    <li><strong className="text-[var(--text-primary)]">DQ (Documentarily Qualified):</strong> NVC checks all your documents. Once everything is approved, you're "DQ" and ready for interview.</li>
                    <li><strong className="text-[var(--text-primary)]">Interview:</strong> The final step! You'll meet with a consular officer who will ask questions and review your documents.</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Section Tabs */}
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">Select a Stage</p>
              <div className="flex gap-1 p-1 rounded-xl bg-[var(--bg-surface-alt)]/50 border border-[var(--border-color)]/50">
                {(["nvc", "dq", "interview"] as Section[]).map((section) => (
                  <button
                    key={section}
                    onClick={() => setSelectedSection(section)}
                    className={`flex-1 px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
                      selectedSection === section
                        ? "bg-[var(--uscis-blue)] text-white shadow-sm"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)]"
                    }`}
                  >
                    {section.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Steps List */}
            <div className="rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface-alt)]/30 p-6 sm:p-8 overflow-hidden border-l-4 border-l-[var(--uscis-blue)]">
              <div className="space-y-4 mb-6">
                <h2 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  {selectedSection === "nvc" && (
                    <>
                      <ArrowDownTrayIcon className="w-5 h-5 text-[var(--text-primary)]" />
                      NVC Stage
                    </>
                  )}
                  {selectedSection === "dq" && (
                    <>
                      <ClipboardIcon className="w-5 h-5 text-[var(--text-primary)]" />
                      Documentarily Qualified (DQ)
                    </>
                  )}
                  {selectedSection === "interview" && (
                    <>
                      <MicrophoneIcon className="w-5 h-5 text-[var(--text-primary)]" />
                      Interview Stage
                    </>
                  )}
                </h2>
                
                {/* Section Subtitle */}
                {selectedSection === "nvc" && (
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed pl-7">
                    <strong className="text-[var(--text-primary)]">What is NVC?</strong> The National Visa Center is the office that processes your case after USCIS approves it. They'll give you a case number, collect fees, and review your documents before sending everything to the embassy.
                  </p>
                )}
                {selectedSection === "dq" && (
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed pl-7">
                    <strong className="text-[var(--text-primary)]">What does "Documentarily Qualified" mean?</strong> It means NVC has reviewed all your documents and confirmed everything is complete and correct. Once you're DQ, you're ready to schedule your interview at the embassy!
                  </p>
                )}
                {selectedSection === "interview" && (
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed pl-7">
                    <strong className="text-[var(--text-primary)]">The Interview:</strong> This is the final step! A consular officer will ask you questions about your relationship, background, and visa intent. Bring all original documents and answer honestly. If approved, you'll receive your visa!
                  </p>
                )}
              </div>
              
              <div className="space-y-4">
                <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-2">Step-by-Step Instructions</p>
                {steps.map((step, index) => {
                  // Extract key terms and add explanations
                  let stepWithExplanation = step;
                  let subtitle = "";
                  
                  // Add helpful explanations for common terms
                  if (selectedSection === "nvc") {
                    if (step.includes("case number")) {
                      subtitle = "Your case number is like a tracking number. You'll receive it by email from NVC. Keep it safe - you'll need it for everything!";
                    } else if (step.includes("DS-260")) {
                      subtitle = "DS-260 is the online immigrant visa application form. Fill it out carefully with accurate information - mistakes can cause delays.";
                    } else if (step.includes("fees")) {
                      subtitle = "You'll pay two fees: the visa application fee and the affidavit of support fee. Pay online through the NVC portal.";
                    }
                  } else if (selectedSection === "dq") {
                    if (step.includes("civil documents")) {
                      subtitle = "Civil documents include birth certificates, marriage certificates, divorce decrees, and police certificates. All must be original or certified copies.";
                    } else if (step.includes("police certificate")) {
                      subtitle = "Police certificates prove you have no criminal record. You need one from every country where you've lived for 6+ months since age 16.";
                    } else if (step.includes("medical exam")) {
                      subtitle = "A panel physician (approved doctor) will conduct your medical exam. Results are sent directly to the embassy - you won't get them.";
                    } else if (step.includes("translations")) {
                      subtitle = "If documents aren't in English, they must be translated by a certified translator. The translation must be notarized or certified.";
                    }
                  } else if (selectedSection === "interview") {
                    if (step.includes("schedule")) {
                      subtitle = "You can schedule online once you're DQ. Interview dates depend on embassy availability - book early if possible!";
                    } else if (step.includes("original documents")) {
                      subtitle = "Bring ALL original documents, even if you already uploaded copies. The officer will compare originals to what NVC reviewed.";
                    } else if (step.includes("answer questions")) {
                      subtitle = "The officer will ask about your relationship, background, and intent to immigrate. Be honest and calm - there are no trick questions.";
                    } else if (step.includes("passport return")) {
                      subtitle = "If approved, the embassy will keep your passport to attach the visa. They'll return it via courier in 1-2 weeks.";
                    }
                  }
                  
                  return (
                    <div key={index} className="relative">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-[var(--uscis-blue)] text-white flex items-center justify-center font-semibold text-sm shadow-sm">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[var(--text-primary)] font-medium leading-relaxed">{step}</p>
                          {subtitle && (
                            <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed pl-0.5 italic">
                              💡 {subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                      {index < steps.length - 1 && (
                        <div className="ml-4 mt-3 mb-2 h-px bg-[var(--border-color)] opacity-50" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            
            {/* Embassy Info */}
            {embassyInfo[effectiveCountry] && selectedSection === "interview" && (
              <div className="rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface-alt)]/40 p-6">
                <h3 className="font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                  <BuildingOfficeIcon className="w-5 h-5 text-gray-800 dark:text-gray-200" />
                  U.S. Embassy Information
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-1 leading-relaxed">
                  <strong className="text-[var(--text-primary)]">Where to go:</strong> {embassyInfo[effectiveCountry].location}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mb-4 leading-relaxed">
                  This is where your interview will take place. Check the embassy website for specific directions, parking, and security requirements.
                </p>
                <a
                  href={embassyInfo[effectiveCountry].contactURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200 hover:underline"
                >
                  Visit Embassy Website for Details →
                </a>
              </div>
            )}
            
            {/* Helpful Tips Box */}
            <div className="rounded-2xl border border-[var(--uscis-green)]/30 bg-[var(--uscis-green)]/5 p-6">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-lg font-bold shadow-sm">
                  ✓
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-[var(--text-primary)] mb-2">Important Tips</h3>
                  <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 leading-relaxed">
                    <li>• <strong className="text-[var(--text-primary)]">Keep copies:</strong> Always make copies of everything you submit. You'll need them at the interview.</li>
                    <li>• <strong className="text-[var(--text-primary)]">Stay organized:</strong> Keep all your documents in one folder, organized by stage (NVC, DQ, Interview).</li>
                    <li>• <strong className="text-[var(--text-primary)]">Check emails regularly:</strong> NVC and the embassy will communicate via email. Don't miss important updates!</li>
                    <li>• <strong className="text-[var(--text-primary)]">Be patient:</strong> Processing times vary. Each stage can take weeks or months - this is normal.</li>
                    <li>• <strong className="text-[var(--text-primary)]">Ask for help:</strong> If you're confused, check the embassy website or contact NVC directly.</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
              <div className="rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface-alt)]/40 p-6">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Stage progress</h2>
                <p className="text-xs text-[var(--text-secondary)] mb-4">Completion rate across stages</p>
                <ProgressChart />
              </div>
              <div className="rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface-alt)]/40 p-6">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Step completion</h2>
                <p className="text-xs text-[var(--text-secondary)] mb-4">Completed vs remaining by stage</p>
                <StageCompletionChart />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
