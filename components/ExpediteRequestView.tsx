"use client";

import React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { HERO_IMAGES } from "@/lib/images";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import {
  ExclamationTriangleIcon,
  LockClosedIcon,
  BoltIcon,
  CurrencyDollarIcon,
  HeartIcon,
  BuildingOfficeIcon,
  UserIcon,
  UsersIcon,
  BuildingOffice2Icon,
} from "@heroicons/react/24/solid";
import { PremiumUpsell } from "./PremiumUpsell";
import { getRepresentatives } from "@/lib/services/representativesService";
import ExpediteSuccessChart from "@/components/charts/ExpediteSuccessChart";

// Representative model matching iOS
interface Representative {
  id: string;
  name: string;
  chamber: "Senate" | "House";
  state: string;
  district?: string;
  phone?: string;
  email?: string;
  website?: string;
}

// Expedite reasons matching iOS enum
enum USCISExpediteReason {
  FINANCIAL_LOSS = "Severe Financial Loss (Person or Company)",
  HUMANITARIAN = "Emergency or Urgent Humanitarian Reasons",
  NONPROFIT = "Nonprofit Cultural or Social Interest of the United States",
  GOV_INTERESTS = "U.S. Government Interests",
  USCIS_ERROR = "Clear USCIS Error",
}

const expediteReasons = [
  { value: USCISExpediteReason.FINANCIAL_LOSS, icon: CurrencyDollarIcon, label: USCISExpediteReason.FINANCIAL_LOSS },
  { value: USCISExpediteReason.HUMANITARIAN, icon: HeartIcon, label: USCISExpediteReason.HUMANITARIAN },
  { value: USCISExpediteReason.NONPROFIT, icon: BuildingOfficeIcon, label: USCISExpediteReason.NONPROFIT },
  { value: USCISExpediteReason.GOV_INTERESTS, icon: BuildingOffice2Icon, label: USCISExpediteReason.GOV_INTERESTS },
  { value: USCISExpediteReason.USCIS_ERROR, icon: ExclamationTriangleIcon, label: USCISExpediteReason.USCIS_ERROR },
];

// ZIP code to state mapping (matching iOS logic exactly)
function stateFromZipPrefix(prefix: string): string | null {
  const value = parseInt(prefix);
  if (isNaN(value)) return null;
  
  // Match iOS switch statement exactly
  if (value >= 350 && value <= 369) return "AL";
  if (value >= 995 && value <= 999 || (value >= 850 && value <= 865)) return value >= 995 ? "AK" : "AZ";
  if (value >= 716 && value <= 729) return "AR";
  if (value >= 900 && value <= 966) return "CA";
  if (value >= 800 && value <= 816) return "CO";
  if (value >= 60 && value <= 69) return "CT"; // iOS: 060...069
  if (value >= 197 && value <= 199) return "DE";
  if (value >= 320 && value <= 349) return "FL";
  if ((value >= 300 && value <= 319) || (value >= 398 && value <= 399)) return "GA";
  if (value >= 967 && value <= 969) return "HI";
  if (value >= 832 && value <= 838) return "ID";
  if (value >= 600 && value <= 629) return "IL";
  if (value >= 460 && value <= 479) return "IN";
  if (value >= 500 && value <= 528) return "IA";
  if (value >= 660 && value <= 679) return "KS";
  if (value >= 400 && value <= 427) return "KY";
  if (value >= 700 && value <= 714) return "LA";
  if (value >= 39 && value <= 49) return "ME"; // iOS: 039...049
  if (value >= 206 && value <= 219) return "MD";
  if ((value >= 10 && value <= 27) || value === 55) return "MA"; // iOS: 010...027, 055
  if (value >= 480 && value <= 499) return "MI";
  if (value >= 550 && value <= 567) return "MN";
  if (value >= 386 && value <= 397) return "MS";
  if (value >= 630 && value <= 658) return "MO";
  if (value >= 590 && value <= 599) return "MT";
  if (value >= 270 && value <= 289) return "NC";
  if (value >= 580 && value <= 588) return "ND";
  if (value >= 680 && value <= 693) return "NE";
  if (value >= 30 && value <= 38) return "NH"; // iOS: 030...038
  if (value >= 70 && value <= 89) return "NJ"; // iOS: 070...089
  if (value >= 870 && value <= 884) return "NM";
  if (value >= 889 && value <= 898) return "NV";
  if (value >= 100 && value <= 149) return "NY";
  if (value >= 430 && value <= 459) return "OH";
  if (value >= 730 && value <= 749) return "OK";
  if (value >= 970 && value <= 979) return "OR";
  if (value >= 150 && value <= 196) return "PA";
  if (value >= 28 && value <= 29) return "RI"; // iOS: 028...029
  if (value >= 290 && value <= 299) return "SC";
  if (value >= 570 && value <= 577) return "SD";
  if (value >= 370 && value <= 385) return "TN";
  if ((value >= 750 && value <= 799) || value === 885) return "TX";
  if (value >= 840 && value <= 847) return "UT";
  if (value >= 50 && value <= 59) return "VT"; // iOS: 050...059
  if (value >= 201 && value <= 246) return "VA";
  if (value >= 980 && value <= 994) return "WA";
  if (value >= 247 && value <= 268) return "WV";
  if (value >= 530 && value <= 549) return "WI";
  if (value >= 820 && value <= 831) return "WY";
  
  return null;
}

// Find representatives by ZIP code (matching iOS logic exactly)
function findRepresentatives(zipCode: string, country: string): Representative[] {
  // Basic, offline placeholder mapping for demo. In production, integrate a civic API.
  // Matching iOS ExpediteRequestView.swift representatives(for:country:) function exactly
  const trimmedZip = zipCode.trim().replace(/\D/g, ""); // Remove non-digits, matching iOS filter({ $0.isNumber })
  const isUS = !country || country.toLowerCase().includes("united states") || 
               country.toLowerCase() === "usa" || country.toLowerCase() === "us";
  
  // Guard: only for US with 3+ digit ZIP prefix (matching iOS guard statement)
  if (!isUS || trimmedZip.length < 3) {
    return [];
  }
  
  const prefix = trimmedZip.substring(0, 3);
  
  // Sample representatives for specific ZIP codes (matching iOS switch cases)
  switch (prefix) {
    case "100": // NYC sample
      return [
        { id: "1", name: "Sen. Kirsten Gillibrand", chamber: "Senate", state: "NY", district: undefined, phone: "(212) 688-6262", email: undefined, website: "https://www.gillibrand.senate.gov/contact/email-me/" },
        { id: "2", name: "Sen. Chuck Schumer", chamber: "Senate", state: "NY", district: undefined, phone: "(212) 486-4430", email: undefined, website: "https://www.schumer.senate.gov/contact/email-chuck" },
        { id: "3", name: "Rep. Jerry Nadler", chamber: "House", state: "NY", district: "12", phone: "(212) 367-7350", email: undefined, website: "https://nadler.house.gov/contact/" },
      ];
      
    case "733": // Austin, TX sample
      return [
        { id: "4", name: "Sen. Ted Cruz", chamber: "Senate", state: "TX", district: undefined, phone: "(512) 916-5834", email: undefined, website: "https://www.cruz.senate.gov/contact/" },
        { id: "5", name: "Sen. John Cornyn", chamber: "Senate", state: "TX", district: undefined, phone: "(512) 469-6034", email: undefined, website: "https://www.cornyn.senate.gov/share-your-opinion/" },
        { id: "6", name: "Rep. Lloyd Doggett", chamber: "House", state: "TX", district: "37", phone: "(512) 916-5921", email: undefined, website: "https://doggett.house.gov/contact" },
      ];
      
    case "950": // Bay Area, CA sample
      return [
        { id: "7", name: "Sen. Alex Padilla", chamber: "Senate", state: "CA", district: undefined, phone: "(408) 558-8340", email: undefined, website: "https://www.padilla.senate.gov/connected/share-your-opinion/" },
        { id: "8", name: "Sen. Laphonza Butler", chamber: "Senate", state: "CA", district: undefined, phone: "(213) 235-5555", email: undefined, website: "https://www.butler.senate.gov/contact/contact-form/" },
        { id: "9", name: "Rep. Ro Khanna", chamber: "House", state: "CA", district: "17", phone: "(408) 436-2720", email: undefined, website: "https://khanna.house.gov/contact/email" },
      ];
      
    default:
      // If we can infer state, provide state-level senators and a generic House placeholder
      const state = stateFromZipPrefix(prefix);
      if (state) {
        return [
          { id: `sen1-${state}`, name: `Your U.S. Senator #1 (${state})`, chamber: "Senate", state, district: undefined, phone: undefined, email: undefined, website: "https://www.senate.gov/senators/senators-contact.htm" },
          { id: `sen2-${state}`, name: `Your U.S. Senator #2 (${state})`, chamber: "Senate", state, district: undefined, phone: undefined, email: undefined, website: "https://www.senate.gov/senators/senators-contact.htm" },
          { id: `rep-${state}`, name: `Your U.S. Representative (${state})`, chamber: "House", state, district: undefined, phone: undefined, email: undefined, website: "https://www.house.gov/representatives/find-your-representative" },
        ];
      }
      
      // Generic placeholders when we don't have a prefix match
      return [
        { id: "sen1", name: "Your U.S. Senator #1", chamber: "Senate", state: "—", district: undefined, phone: undefined, email: undefined, website: "https://www.senate.gov/senators/senators-contact.htm" },
        { id: "sen2", name: "Your U.S. Senator #2", chamber: "Senate", state: "—", district: undefined, phone: undefined, email: undefined, website: "https://www.senate.gov/senators/senators-contact.htm" },
        { id: "rep", name: "Your U.S. Representative", chamber: "House", state: "—", district: undefined, phone: undefined, email: undefined, website: "https://www.house.gov/representatives/find-your-representative" },
      ];
  }
}

export default function ExpediteRequestView() {
  const { profile } = useProfile();
  const { isSubscribed, hasUsedTrial } = useSubscription();
  const { user } = useAuth();
  
  const [phone, setPhone] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [details, setDetails] = useState("");
  const [reasonSummary, setReasonSummary] = useState("");
  const [selectedReason, setSelectedReason] = useState<USCISExpediteReason>(USCISExpediteReason.FINANCIAL_LOSS);
  const [representatives, setRepresentatives] = useState<Representative[]>([]);
  const [isLoadingReps, setIsLoadingReps] = useState(false);
  const [copiedItem, setCopiedItem] = useState("");
  const [showCopyAlert, setShowCopyAlert] = useState(false);
  
  const userFullName = user?.displayName || "";
  const caseNumber = profile?.receiptNumber || "";
  const email = user?.email || "";
  const userCountry = profile?.country || "";
  
  // Load representatives when ZIP code changes - NOW USING REAL API!
  // IMPORTANT: Allow ZIP code lookup for ANY 5-digit ZIP code (assume it's a US ZIP)
  // User might be in Pakistan but entering a US ZIP code for expedite purposes
  useEffect(() => {
    const digits = zipCode.replace(/\D/g, "");

    if (digits.length >= 5) {
      setIsLoadingReps(true);

      const fetchReps = async () => {
        try {
          const reps = await getRepresentatives(zipCode, "United States", findRepresentatives);
          setRepresentatives(reps);
        } catch (error) {
          console.error("Error fetching representatives:", error);
          setRepresentatives(findRepresentatives(zipCode, "United States"));
        } finally {
          setIsLoadingReps(false);
        }
      };

      fetchReps();
    } else {
      setRepresentatives([]);
      setIsLoadingReps(false);
    }
  }, [zipCode]);
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(label);
    setShowCopyAlert(true);
    setTimeout(() => setShowCopyAlert(false), 2000);
  };
  
  const generateEmail = () => {
    if (!phone || !zipCode) {
      alert("Please enter phone number and ZIP code");
      return;
    }
    
    const subject = `Expedite Request: Case ${caseNumber || "[Your Case Number]"}`;
    const body = buildEmailBody();
    
    const mailtoLink = `mailto:${email || ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };
  
  const buildEmailBody = (): string => {
    return `Dear [Senator/Representative] [Last Name],

I hope this message finds you well. I am writing to respectfully request your assistance in expediting the review of my pending USCIS case. I understand that your office receives many such inquiries, and I truly appreciate your time and consideration in reviewing mine.

Full Name: ${userFullName || "[Your Full Name]"}
Case Number: ${caseNumber || "[Your Case Number]"}
Email: ${email || "[Your Email]"}
Phone: ${phone}
ZIP Code: ${zipCode}
Country of Residence: ${userCountry || "[Your Country]"}

Reason for Expedited Review (${selectedReason}):
${reasonSummary || "[Describe your reason]"}

Additional Background and Supporting Details:
${details || "[Add additional details about your situation]"}

I have attached supporting documentation to help verify my request, including evidence of hardship or urgency where applicable. My situation may meet one or more of USCIS's expedite criteria, such as:
- Severe financial loss to an individual or company
- Urgent humanitarian reasons
- U.S. government interests (including urgent requests from federal agencies)
- Clear USCIS error or unreasonable delay

I would be deeply grateful if your office could contact USCIS to inquire about the possibility of expediting my case or provide guidance on any additional steps I can take.

Thank you for your time, attention, and continued service to your constituents. Your assistance in this matter means a great deal to me and my family.

With sincere gratitude,
${userFullName || "[Your Full Name]"}`;
  };
  
  if (!isSubscribed) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[var(--hero-dark)] via-[var(--hero-dark-soft)] to-[var(--hero-dark)] border-b border-white/10">
          <div className="absolute inset-0 w-full">
            <Image src={HERO_IMAGES.handsDocuments} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
            <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.12)_0%,_transparent_50%)]" aria-hidden />
          </div>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shrink-0 shadow-lg">
                <BoltIcon className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#ffffff" }}>Expedite Request</h1>
                <p className="text-sm sm:text-base mt-1" style={{ color: "#ffffff" }}>Request faster processing for urgent cases</p>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)]/50 shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
            <div className="p-12 sm:p-16 text-center">
              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/25">
                <LockClosedIcon className="w-10 h-10 text-white" />
              </div>
              <span className="inline-block text-[11px] font-semibold uppercase tracking-widest text-indigo-500 dark:text-indigo-400 mb-4">Premium</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-3 tracking-tight">Expedite Your Case Faster</h2>
              <p className="text-base text-[var(--text-secondary)] mb-8 max-w-md mx-auto leading-relaxed">
                Skip the wait with professional expedite assistance: find your representative, auto-generated emails, and AI-powered drafting.
              </p>
              <Link
                href="/subscribe"
                className="inline-flex flex-col items-center gap-2 px-8 py-4 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white text-base font-semibold rounded-2xl hover:from-indigo-700 hover:to-indigo-800 transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5"
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
          <Image src={HERO_IMAGES.handsDocuments} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.12)_0%,_transparent_50%)]" aria-hidden />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xl flex items-center justify-center border border-white/20 shrink-0 shadow-lg">
              <BoltIcon className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: "#ffffff" }}>Expedite Request</h1>
              <p className="text-sm sm:text-base mt-1" style={{ color: "#ffffff" }}>Request faster processing for urgent cases</p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)]/50 shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
          <div className="p-6 sm:p-8 lg:p-10 space-y-8">
            {/* When to Request Section */}
            <div className="rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface-alt)]/40 p-6 sm:p-7 overflow-hidden border-l-4 border-l-red-500/80">
              <div className="flex items-center gap-4 mb-5">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                  <BoltIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">When to Request an Expedite</h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1">You may request an expedite if you have urgent, documented reasons such as:</p>
                </div>
              </div>
              
              <div className="space-y-2.5 ml-16 sm:ml-0">
                {[
                  "Severe financial loss to company or individual",
                  "Emergent situations (humanitarian reasons)",
                  "Urgent medical treatment needs",
                  "Nonprofit organization furthering cultural or social interests",
                  "U.S. Government interests",
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm text-[var(--text-secondary)]">
                    <span className="w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Your Information */}
            <div className="rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface)] p-6 sm:p-7 overflow-hidden border-l-4 border-l-[var(--uscis-blue)]">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-5 flex items-center gap-3 tracking-tight">
                <UserIcon className="w-6 h-6 text-[var(--text-primary)]" /> Your Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full px-4 py-3 border border-[var(--border-color)]/70 rounded-xl bg-[var(--bg-surface-alt)]/50 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--uscis-blue)]/20 focus:border-[var(--uscis-blue)] transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                    ZIP Code
                  </label>
                  <input
                    type="text"
                    value={zipCode}
                    onChange={(e) => setZipCode(e.target.value)}
                    placeholder="e.g. 10001"
                    className="w-full px-4 py-3 border border-[var(--border-color)]/70 rounded-xl bg-[var(--bg-surface-alt)]/50 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--uscis-blue)]/20 focus:border-[var(--uscis-blue)] transition-all"
                  />
                  <p className="text-xs text-[var(--text-secondary)] mt-1">
                    We'll use this to find your Senators and Representative
                  </p>
                </div>
              </div>
            </div>
            
            {/* Representatives - Show for any valid 5-digit ZIP code */}
            {(() => {
              const digits = zipCode.replace(/\D/g, "");
              const showReps = digits.length >= 5;

              return showReps ? (
                <div className="rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface)] p-6 sm:p-7 overflow-hidden border-l-4 border-l-teal-500/80">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      <UsersIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" /> Your Representatives
                    </h2>
                    <div className="flex items-center gap-3">
                      {isLoadingReps && <span className="text-sm text-[var(--text-secondary)]">Loading...</span>}
                      {!isLoadingReps && representatives.length > 0 && (
                        <a
                          href="https://www.congress.gov/members"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs px-3 py-1.5 bg-[var(--uscis-blue)] text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                        >
                          <span>Contact all</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                  
                  {!isLoadingReps && representatives.length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-[var(--text-secondary)] mb-2">
                        Unable to find representatives for this ZIP code.
                      </p>
                      <p className="text-xs text-[var(--text-tertiary)]">
                        Please verify your ZIP code and try again.
                      </p>
                    </div>
                  )}
                  
                  {!isLoadingReps && representatives.length > 0 && (
                    <>
                      <p className="text-xs text-[var(--text-secondary)] mb-4 pb-2 border-b border-[var(--border-color)]">
                        Tip: Copy your representatives' phone numbers and email — you'll need them when sending your email.
                      </p>
                      
                      <div className="space-y-4">
                        {representatives.map((rep) => (
                          <div key={rep.id} className="border border-[var(--border-color)]/60 rounded-2xl p-5 bg-[var(--bg-surface-alt)]/30 hover:border-[var(--uscis-blue)]/40 hover:bg-[var(--bg-surface-alt)]/50 transition-all">
                            <div className="flex items-start gap-3 mb-3">
                              {rep.chamber === "Senate" ? (
                                <BuildingOfficeIcon className="w-6 h-6 text-[var(--text-primary)] flex-shrink-0 mt-0.5" />
                              ) : (
                                <BuildingOffice2Icon className="w-6 h-6 text-[var(--text-primary)] flex-shrink-0 mt-0.5" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <h3 className="font-semibold text-[var(--text-primary)]">{rep.name}</h3>
                                  <span className="text-xs px-2 py-1 bg-[var(--uscis-blue)]/10 text-[var(--text-primary)] rounded-full font-medium">
                                    {rep.chamber}
                                  </span>
                                </div>
                                {rep.district && (
                                  <p className="text-xs text-[var(--text-secondary)]">
                                    District {rep.district}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            <div className="space-y-2 text-sm ml-9">
                              {rep.phone && (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[var(--text-secondary)]">Phone: </span>
                                    <span className="text-[var(--text-primary)] font-medium">{rep.phone}</span>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(rep.phone!, "Phone number")}
                                    className="px-3 py-2 bg-[var(--uscis-blue)] text-white rounded-xl text-xs font-medium hover:bg-[var(--uscis-blue-dark)] transition-colors shrink-0"
                                  >
                                    Copy
                                  </button>
                                </div>
                              )}
                              
                              {rep.website && (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[var(--text-secondary)]">Website: </span>
                                    <a
                                      href={rep.website}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-800 dark:text-gray-200 hover:underline font-medium"
                                    >
                                      Visit →
                                    </a>
                                  </div>
                                </div>
                              )}
                              
                              {rep.email && (
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex-1 min-w-0">
                                    <span className="text-[var(--text-secondary)]">Email: </span>
                                    <span className="text-[var(--text-primary)] font-medium break-all">{rep.email}</span>
                                  </div>
                                  <button
                                    onClick={() => copyToClipboard(rep.email!, "Email")}
                                    className="px-3 py-2 bg-[var(--uscis-blue)] text-white rounded-xl text-xs font-medium hover:bg-[var(--uscis-blue-dark)] transition-colors shrink-0"
                                  >
                                    Copy
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : null;
            })()}
            
            {/* Expedite Reason */}
            <div className="rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface)] p-6 sm:p-7 overflow-hidden border-l-4 border-l-orange-500/80">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-5 tracking-tight">Expedite Reason</h2>
              
              <div className="space-y-3 mb-4">
                {expediteReasons.map((reason) => (
                  <button
                    key={reason.value}
                    onClick={() => setSelectedReason(reason.value)}
                    className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${
                      selectedReason === reason.value
                        ? "border-[var(--uscis-blue)] bg-[var(--uscis-blue)]/5 dark:bg-[var(--uscis-blue)]/10"
                        : "border-[var(--border-color)]/60 hover:border-[var(--border-color)] hover:bg-[var(--bg-surface-alt)]/30"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {React.createElement(reason.icon, { className: "w-6 h-6 text-[var(--text-secondary)]" })}
                      <span className="font-medium text-[var(--text-primary)]">{reason.label}</span>
                      {selectedReason === reason.value && (
                        <span className="ml-auto w-6 h-6 rounded-full bg-[var(--uscis-blue)] text-white flex items-center justify-center text-xs font-bold">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Brief Reason Summary (optional)
                </label>
                <input
                  type="text"
                  value={reasonSummary}
                  onChange={(e) => setReasonSummary(e.target.value)}
                  placeholder="Brief description of your expedite reason"
                  className="w-full px-4 py-3 border border-[var(--border-color)]/70 rounded-xl bg-[var(--bg-surface-alt)]/50 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--uscis-blue)]/20 focus:border-[var(--uscis-blue)] transition-all"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Additional Details
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide additional details about your situation..."
                  rows={6}
                  className="w-full px-4 py-3 border border-[var(--border-color)]/70 rounded-xl bg-[var(--bg-surface-alt)]/50 text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--uscis-blue)]/20 focus:border-[var(--uscis-blue)] transition-all resize-none"
                />
              </div>
            </div>
            
            <div className="flex gap-4 pt-4">
              <button
                onClick={generateEmail}
                disabled={!phone || !zipCode}
                className="flex-1 px-8 py-4 bg-[var(--uscis-blue)] text-white text-base font-semibold rounded-2xl hover:bg-[var(--uscis-blue-dark)] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--uscis-blue)]/20 hover:shadow-[var(--uscis-blue)]/30 hover:-translate-y-0.5 disabled:hover:translate-y-0 disabled:hover:shadow-[var(--uscis-blue)]/20"
              >
                Generate Email
              </button>
            </div>
            
            {/* Alert */}
            {showCopyAlert && (
              <div className="fixed bottom-6 right-6 bg-green-600 text-white px-5 py-3 rounded-2xl shadow-xl shadow-green-500/20 font-medium">
                {copiedItem} copied to clipboard
              </div>
            )}

            <div className="rounded-2xl border border-[var(--border-color)]/60 bg-[var(--bg-surface-alt)]/40 p-6 sm:p-7 mt-8">
              <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2 tracking-tight">Expedite Success Trends</h2>
              <p className="text-sm text-[var(--text-secondary)] mb-5">Historical success rates and average processing times</p>
              <div>
                <ExpediteSuccessChart />
                <div className="mt-6 grid grid-cols-2 gap-4">
                  <div className="p-5 bg-green-50 dark:bg-green-900/20 rounded-2xl border border-green-200/80 dark:border-green-800/50">
                    <p className="text-xs text-green-700 dark:text-green-300 font-medium mb-1">Average Success Rate</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">74%</p>
                    <p className="text-xs text-green-600 dark:text-green-500 mt-1">Based on last 6 months</p>
                  </div>
                  <div className="p-5 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-200/80 dark:border-blue-800/50">
                    <p className="text-xs text-gray-800 dark:text-gray-200 font-medium mb-1">Average Processing</p>
                    <p className="text-2xl font-bold text-gray-800 dark:text-gray-200">38 days</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300 mt-1">Faster than standard</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-[var(--border-color)]/40">
              <Link href="/tools/case-tools" className="text-sm font-semibold text-[var(--text-primary)] hover:underline inline-flex items-center gap-1.5">
                ← Back to Case Tools
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
