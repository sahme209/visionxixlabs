"use client";

// Force dynamic rendering to prevent SSG issues with Firestore
export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useRef } from "react";
import { doc, getDoc, collection, query, orderBy, limit, getDocs, where } from "firebase/firestore";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { BoltIcon } from "@heroicons/react/24/solid";
import { HERO_IMAGES, ICON_IMAGES } from "@/lib/images";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { generateTimeline } from "@/lib/services/timelineService";
import { mapUSCISStatusToCurrentStage } from "@/lib/services/uscisStatusService";
import { CaseTimeline } from "@/lib/types";
import USCISStatusAPIDebug from "@/components/USCISStatusAPIDebug";
import USCISCaseStatus from "@/components/USCISCaseStatus";
import TimelineView from "@/components/TimelineView";
import USCISAlertBanner from "@/components/USCISAlertBanner";
import USCISDisclaimer from "@/components/USCISDisclaimer";
import USCISFeedbackWidget from "@/components/USCISFeedbackWidget";
import USCISRelatedResources from "@/components/USCISRelatedResources";
import PremiumServices from "@/components/PremiumServices";
import PremiumUnlockCard from "@/components/PremiumUnlockCard";
import QueuePositionCard from "@/components/QueuePositionCard";
import CurrentProcessingTimesCard from "@/components/CurrentProcessingTimesCard";
import DailyApprovalCard from "@/components/DailyApprovalCard";
import EmailVerificationBanner from "@/components/EmailVerificationBanner";
import { analytics } from "@/lib/analytics";
import DataSourceIndicator from "@/components/DataSourceIndicator";
import { isCountryAffectedByPause } from "@/lib/data/visaPauseCountries";
import CardContainer from "@/components/CardContainer";
import CaseCalendar from "@/components/CaseCalendar";
import WeeklySummary from "@/components/WeeklySummary";
import HomeCard, { HomeCardInner } from "@/components/HomeCard";


export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading, status: profileStatus } = useProfile();
  const { isSubscribed, loading: subscriptionLoading, status: subscriptionStatus, isTrialing, hasUsedTrial } = useSubscription();
  const [showPremiumBenefitsModal, setShowPremiumBenefitsModal] = useState(false);
  /** Stage derived from live USCIS API — drives Case Timeline when available */
  const [uscisDerivedStage, setUscisDerivedStage] = useState<string | null>(null);
  /** True when USCIS fetch failed (wrong IOE, case not found, API error) — don't show profile stage on cards */
  const [uscisFetchFailed, setUscisFetchFailed] = useState(false);
  /** True while USCIS status is being fetched — show loading on Case Timeline */
  const [uscisFetching, setUscisFetching] = useState(false);
  
  // Clear USCIS-derived stage when user has no receipt (e.g. removed or logged out)
  useEffect(() => {
    if (!profile?.receiptNumber || profile.receiptNumber.length !== 13) {
      setUscisDerivedStage(null);
      setUscisFetchFailed(false);
    }
  }, [profile?.receiptNumber]);
  
  // Track page view
  useEffect(() => {
    analytics.statsPageViewed(); // Home page is essentially the stats/dashboard
  }, []);
  
  const [currentLatestPD, setCurrentLatestPD] = useState<Date | null>(null);
  const [loadingQueueData, setLoadingQueueData] = useState(false);
  const [pdStatsExtra, setPdStatsExtra] = useState<{ avgTimeDays?: number; pacePdsPerDay?: number } | null>(null);
  const [latestNewsItem, setLatestNewsItem] = useState<{ title: string; summary?: string; body?: string } | null>(null);
  const [recentApprovalsCount, setRecentApprovalsCount] = useState<number | null>(null);
  const [recentApprovalsByDay, setRecentApprovalsByDay] = useState<{ date: string; label: string; count: number }[] | null>(null);
  const [approvalsWeekComparison, setApprovalsWeekComparison] = useState<{ thisWeek: number; lastWeek: number } | null>(null);
  const [approvalsByWeekday, setApprovalsByWeekday] = useState<{ day: string; count: number }[] | null>(null);

  // Secret 7-tap USCIS debug trigger on home header icon
  const [homeSecretTapCount, setHomeSecretTapCount] = useState(0);
  const [showHomeUSCISDebug, setShowHomeUSCISDebug] = useState(false);
  const homeTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const HOME_SECRET_TAP_THRESHOLD = 7;
  const HOME_TAP_TIMEOUT_MS = 3000;

  const handleHomeHeaderSecretTap = () => {
    setHomeSecretTapCount((prev) => {
      const next = prev + 1;
      console.log(`[HOME] Secret tap on header icon: ${next}/${HOME_SECRET_TAP_THRESHOLD}`);

      if (next >= HOME_SECRET_TAP_THRESHOLD) {
        console.log("[HOME] ✅ Showing USCISStatusAPIDebug from header secret taps");
        setShowHomeUSCISDebug(true);
        if (homeTapTimeoutRef.current) {
          clearTimeout(homeTapTimeoutRef.current);
          homeTapTimeoutRef.current = null;
        }
        return 0;
      }

      if (homeTapTimeoutRef.current) {
        clearTimeout(homeTapTimeoutRef.current);
      }

      homeTapTimeoutRef.current = setTimeout(() => {
        setHomeSecretTapCount(0);
        console.log("[HOME] ⏱️ Secret tap count reset (timeout)");
      }, HOME_TAP_TIMEOUT_MS);

      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (homeTapTimeoutRef.current) {
        clearTimeout(homeTapTimeoutRef.current);
      }
    };
  }, []);

  // Close modal on ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showPremiumBenefitsModal) {
        setShowPremiumBenefitsModal(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [showPremiumBenefitsModal]);

  // Scroll to Key dates (calendar) when landing with hash #key-dates
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#key-dates") {
      const el = document.getElementById("key-dates");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  // No automatic redirect to profile setup - users can browse freely and complete profile when ready

  // Generate timeline from profile data (using backend data)
  // Use USCIS-derived stage when available (from live API) to drive progress.
  // When fetch failed (wrong IOE, case not found), don't show profile stage — show step 0.
  const effectiveCurrentStage = uscisFetchFailed ? undefined : (uscisDerivedStage ?? profile?.currentStage ?? undefined);
  const [timeline, setTimeline] = useState<CaseTimeline | null>(null);
  
  useEffect(() => {
    if (!profile || !profile.priorityDate || !profile.formType) {
      setTimeline(null);
      return;
    }

    let cancelled = false;

    const loadTimeline = async () => {
      try {
        const priorityDate = new Date(profile.priorityDate);
        if (isNaN(priorityDate.getTime())) {
          if (!cancelled) setTimeline(null);
          return;
        }

        const generatedTimeline = await generateTimeline(
          profile.formType,
          priorityDate,
          profile.country || undefined,
          (profile.processingPath as "Consular" | "AOS") || "Consular",
          undefined, // customPace
          effectiveCurrentStage,
          profile.serviceCenter || undefined
        );
        
        // Only update state if not cancelled (component still mounted)
        if (!cancelled) {
          setTimeline(generatedTimeline);
        }
      } catch (error) {
        console.error("Error generating timeline:", error);
        if (!cancelled) {
          setTimeline(null);
        }
      }
    };

    loadTimeline();
    
    // Cleanup: cancel if component unmounts or dependencies change
    return () => {
      cancelled = true;
    };
  }, [profile?.formType, profile?.priorityDate, profile?.country, profile?.processingPath, effectiveCurrentStage, profile?.serviceCenter]);

  // Load queue position data (latest PD) for I-130/I-129F
  useEffect(() => {
    if (!profile || !profile.formType || !profile.priorityDate) {
      return;
    }

    const formType = profile.formType.toUpperCase();
    if (formType !== "I-130" && formType !== "I-129F") {
      return;
    }

    setLoadingQueueData(true);
    
    // Load latest PD from Firestore (PD stats)
    const loadLatestPD = async () => {
      // Only run on client-side
      if (typeof window === "undefined") {
        return;
      }

      // Check if db is properly initialized
      if (!db || typeof (db as any).collection !== "function") {
        return;
      }

      try {
        // Try to load from PD stats collection (scopeId format: petitionType:I-130 or petitionType:I-129F)
        const scopeId = `petitionType:${formType}`;
        const pdStatsRef = doc(db, "pdStats", scopeId);
        const pdStatsSnap = await getDoc(pdStatsRef);
        
        if (pdStatsSnap.exists()) {
          const data = pdStatsSnap.data();
          if (data.latestApprovedPD) {
            const latestPD = new Date(data.latestApprovedPD);
            if (!isNaN(latestPD.getTime())) {
              setCurrentLatestPD(latestPD);
            }
          }
          if (data.avgTimeDays != null || data.pacePdsPerDay != null) {
            setPdStatsExtra({
              avgTimeDays: data.avgTimeDays != null ? Number(data.avgTimeDays) : undefined,
              pacePdsPerDay: data.pacePdsPerDay != null ? Number(data.pacePdsPerDay) : undefined,
            });
          } else {
            setPdStatsExtra(null);
          }
        } else {
          setPdStatsExtra(null);
        }
      } catch (error) {
        console.error("Error loading latest PD:", error);
      } finally {
        setLoadingQueueData(false);
      }
    };

    loadLatestPD();
  }, [profile]);

  // Fetch latest news from Firestore for home card
  useEffect(() => {
    if (!user || !db) return;
    let mounted = true;
    const loadLatestNews = async () => {
      try {
        const newsQ = query(
          collection(db, "news"),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(newsQ);
        if (mounted && !snap.empty) {
          const d = snap.docs[0].data();
          setLatestNewsItem({
            title: d.title ?? "Update",
            summary: d.summary ?? d.body,
            body: d.body,
          });
        } else if (mounted) {
          setLatestNewsItem(null);
        }
      } catch (e) {
        if (mounted) setLatestNewsItem(null);
      }
    };
    loadLatestNews();
    return () => { mounted = false; };
  }, [user]);

  // Fetch recent approvals: per-day (7d) + week comparison (14d) + by weekday (30d)
  useEffect(() => {
    if (!user || !db) return;
    const formType = profile?.formType?.toUpperCase() || "I-130";
    const col = formType === "I-129F" ? "i129fApprovals" : "i130Approvals";
    const cutoff7 = new Date();
    cutoff7.setDate(cutoff7.getDate() - 7);
    cutoff7.setHours(0, 0, 0, 0);
    const cutoff14 = new Date();
    cutoff14.setDate(cutoff14.getDate() - 14);
    cutoff14.setHours(0, 0, 0, 0);
    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    cutoff30.setHours(0, 0, 0, 0);
    let mounted = true;
    (async () => {
      try {
        const q = formType === "I-129F"
          ? query(collection(db, col), where("formType", "==", "I-129F"), orderBy("createdAt", "desc"), limit(1000))
          : query(collection(db, col), where("formType", "==", "I-130"), orderBy("createdAt", "desc"), limit(1000));
        const snap = await getDocs(q);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const toDateKey = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const byDay: Record<string, number> = {};
        for (let i = 0; i < 30; i++) {
          const d = new Date(today);
          d.setDate(d.getDate() - (29 - i));
          byDay[toDateKey(d)] = 0;
        }
        let count7 = 0;
        snap.docs.forEach((docSnap) => {
          const created = docSnap.data().createdAt?.toDate?.() ?? docSnap.data().createdAt;
          const t = created ? new Date(created) : null;
          if (!t || t < cutoff30) return;
          if (t >= cutoff7) count7++;
          const dayKey = toDateKey(t);
          if (byDay[dayKey] !== undefined) byDay[dayKey]++;
        });
        const sortedKeys = Object.keys(byDay).sort();
        const byDayArray = sortedKeys.slice(-7).map((date) => {
          const [y, m, day] = date.split("-").map(Number);
          const d = new Date(y, m - 1, day);
          return {
            date,
            label: d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
            count: byDay[date],
          };
        });
        const thisWeek = sortedKeys.slice(-7).reduce((s, date) => s + byDay[date], 0);
        const lastWeek = sortedKeys.slice(-14, -7).reduce((s, date) => s + byDay[date], 0);
        const byWeekday = [0, 0, 0, 0, 0, 0, 0]; // Sun=0 .. Sat=6
        sortedKeys.forEach((date) => {
          const [y, m, day] = date.split("-").map(Number);
          const d = new Date(y, m - 1, day);
          byWeekday[d.getDay()] += byDay[date];
        });
        const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        const approvalsByWeekdayArray = weekdayLabels.map((day, i) => ({ day, count: byWeekday[i] }));
        if (mounted) {
          setRecentApprovalsCount(count7);
          setRecentApprovalsByDay(byDayArray);
          setApprovalsWeekComparison({ thisWeek, lastWeek });
          setApprovalsByWeekday(approvalsByWeekdayArray);
        }
      } catch {
        if (mounted) {
          setRecentApprovalsCount(null);
          setRecentApprovalsByDay(null);
          setApprovalsWeekComparison(null);
          setApprovalsByWeekday(null);
        }
      }
    })();
    return () => { mounted = false; };
  }, [user, profile?.formType]);

  // Check if should show queue position (I-130 Consular or I-129F)
  const shouldShowQueuePosition = useMemo(() => {
    if (!profile || !profile.formType || !profile.priorityDate) {
      return false;
    }
    const formType = profile.formType.toUpperCase();
    const processingPath = (profile.processingPath || "Consular").toUpperCase();
    return (formType === "I-130" && processingPath === "CONSULAR") || formType === "I-129F";
  }, [profile]);

  // Check if has profile data
  const hasProfile = profile && profile.priorityDate && profile.formType;

  // Helper function to check if form type is I-130 or I-129F
  const isI130OrI129FUser = (formType: string): boolean => {
    const formUpper = formType.toUpperCase().trim();
    return formUpper === "I-130" || formUpper === "I-129F";
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] text-[var(--text-primary)] relative overflow-x-hidden min-w-0">
      {/* Subtle background pattern — Apple-style refined */}
      <div className="fixed inset-0 pointer-events-none z-0" aria-hidden>
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,113,227,0.02)_0%,transparent_40%)]" />
        <div className="absolute inset-0 opacity-[0.35] dark:opacity-[0.12]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(0,113,227,0.06) 1px, transparent 0)", backgroundSize: "40px 40px" }} />
      </div>
      {showHomeUSCISDebug && (
        <USCISStatusAPIDebug onClose={() => setShowHomeUSCISDebug(false)} />
      )}

      {/* Premium Benefits Modal */}
      {showPremiumBenefitsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPremiumBenefitsModal(false);
            }
          }}
        >
          <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-surface-alt)] rounded-2xl sm:rounded-3xl shadow-2xl border-2 border-[var(--border-color)] animate-in zoom-in-95 duration-300">
            {/* Close Button */}
            <button
              onClick={() => setShowPremiumBenefitsModal(false)}
              className="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)] transition-all duration-200 shadow-lg hover:scale-110"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal Content */}
            <div className="p-6 sm:p-8 lg:p-10">
              {/* Header */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[var(--uscis-green)] mb-4 shadow-md">
                  <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-[var(--text-primary)] mb-2 tracking-tight">
                  VisaNova makes case tracking simpler
                </h2>
                <p className="text-base sm:text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
                  A personalized account to help you navigate the immigration process. On VisaNova you will find:
                </p>
                <ul className="mt-3 text-sm sm:text-base text-[var(--text-secondary)] max-w-xl mx-auto text-left space-y-1.5 list-disc list-inside">
                  <li>Up-to-date information about USCIS processing and application stages</li>
                  <li>Tools to help you prepare for filing and track your case progress</li>
                  <li>Information to explore your immigration options and timeline estimates</li>
                </ul>
                <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl border-2 border-emerald-200 dark:border-emerald-800">
                  <span className="font-black text-sm sm:text-base" style={{ color: "#fff" }}>{hasUsedTrial ? "Subscribe Now" : "🎁 Start Your 3-Day Free Trial"}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs sm:text-sm">{hasUsedTrial ? "$4.99/month" : "$0 today, then $4.99/month"}</span>
                </div>
              </div>

              {/* Benefits Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-8">
                {/* Benefit 1 */}
                <div className="group p-5 sm:p-6 bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 rounded-xl border border-[var(--border-color)] hover:border-[var(--border-color-hover)] transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">Real-Time Queue Position</h3>
                      <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                        Know exactly where you stand in the processing queue. Get daily updates on your position and see how many cases are ahead of you.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Benefit 2 */}
                <div className="group p-5 sm:p-6 bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 rounded-xl border border-[var(--border-color)] hover:border-[var(--border-color-hover)] transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--uscis-gray-dark)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">Accurate Timeline Estimates</h3>
                      <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                        Get precise estimates for each stage of your journey. Based on real USCIS data and thousands of successful cases.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Benefit 3 */}
                <div className="group p-5 sm:p-6 bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 rounded-xl border border-[var(--border-color)] hover:border-[var(--border-color-hover)] transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--uscis-green)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">Daily Approval Tracking</h3>
                      <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                        See real approvals happening every day. Track trends and get notified when cases similar to yours are approved.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Benefit 4 */}
                <div className="group p-5 sm:p-6 bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 rounded-xl border border-[var(--border-color)] hover:border-[var(--border-color-hover)] transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--uscis-accent-soft)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">Processing Time Insights</h3>
                      <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                        Access current processing times for your service center. Know what to expect and plan accordingly.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Benefit 5 */}
                <div className="group p-5 sm:p-6 bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 rounded-xl border border-[var(--border-color)] hover:border-[var(--border-color-hover)] transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">Weekly Progress Summary</h3>
                      <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                        Get a comprehensive weekly summary of your case progress, approvals in your category, and what's coming next.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Benefit 6 */}
                <div className="group p-5 sm:p-6 bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 rounded-xl border-2 border-rose-200 dark:border-rose-800 hover:border-rose-400 dark:hover:border-rose-600 hover:shadow-xl transition-all duration-300">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-[var(--text-primary)] mb-2">Priority Support</h3>
                      <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">
                        Get priority access to support and resources. Your questions answered faster with dedicated assistance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trust Indicators */}
              <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-8 p-4 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border-color)]">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold text-[var(--text-primary)]">No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold text-[var(--text-primary)]">Cancel anytime</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-bold text-[var(--text-primary)]">Trusted by thousands</span>
                </div>
              </div>

              {/* CTA Button */}
              <div className="text-center">
                <Link
                  href="/subscribe"
                  onClick={() => setShowPremiumBenefitsModal(false)}
                  className="inline-flex items-center gap-3 px-8 py-4 bg-[var(--uscis-green)] hover:bg-[#166534] text-white rounded-xl font-semibold text-lg sm:text-xl shadow-md active:scale-95 transition-all duration-300"
                >
                  <span style={{ color: "#fff" }}>{hasUsedTrial ? "Subscribe Now" : "Start Your 3-Day Free Trial"}</span>
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3} style={{ color: "#fff" }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <p className="mt-4 text-sm text-[var(--text-secondary)]">
                  {hasUsedTrial ? "$4.99/month. Cancel anytime." : "$0 today, then $4.99/month. Cancel anytime before trial ends."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Official Header - Desktop: Full Dashboard, Mobile: Compact - shown to all users */}
      {!authLoading && !profileLoading && (
        <>
          {/* Desktop Header - Apple-style refined navy gradient */}
          <div className="hidden md:block surface-dark relative overflow-hidden bg-gradient-to-b from-[var(--hero-dark)] via-[var(--hero-dark-soft)] to-[var(--hero-dark)] border-b border-white/5 shadow-lg">
            <div className="absolute inset-0 hidden md:block w-full">
              <Image
                src={HERO_IMAGES.office}
                alt=""
                fill
                className="object-cover object-center opacity-15 w-full"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-[var(--hero-dark)]/95 via-[var(--hero-dark-soft)]/90 to-[var(--hero-dark)]/95" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--uscis-blue)]/50 to-transparent" aria-hidden="true" />
            <div className="pointer-events-none absolute inset-0 opacity-[0.04] hidden md:block" aria-hidden="true" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)", backgroundSize: "16px 16px" }} />
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <div className="grid grid-cols-12 gap-4 items-start">
                {/* Left Section - Icon & Title */}
                <div className="col-span-12 lg:col-span-8">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={handleHomeHeaderSecretTap}
                      className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center border border-white/20 flex-shrink-0 cursor-pointer hover:bg-white/15 transition-colors"
                      aria-label="Your dashboard"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white" style={{ letterSpacing: '0.02em' }}>
                          Case Status Dashboard
                        </h1>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-500/30 rounded text-[10px] font-bold uppercase tracking-widest border border-emerald-400/40 text-white">
                            Active
                          </span>
                          <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] font-bold uppercase tracking-widest border border-white/25 text-white">
                            US-Based Data
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-white mb-0 leading-relaxed max-w-2xl">
                        Know where you stand. Real-time tracking powered by USCIS data and community-reported approvals.
                      </p>
                    </div>
                  </div>
                </div>
                      </div>
                      </div>
                    </div>

        </>
      )}

      {/* Trial Status Banner - Home Page */}
      {!authLoading && !profileLoading && !subscriptionLoading && user && isTrialing && subscriptionStatus.trialEnd && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6">
          {/* USCIS-style Alert Banner */}
          <USCISAlertBanner
            type="info"
            title="Know Before You Go"
            message="Check office closures and operating hours before visiting a USCIS office. Always verify information with official USCIS sources."
            linkText="Find a USCIS Office"
            linkHref="https://www.uscis.gov/about-us/find-a-uscis-office"
          />

          {/* USCIS-style Task-Focused Section */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]/60 shadow-sm hover:shadow-md transition-shadow p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-[var(--uscis-blue)]/30 rounded-l-2xl" aria-hidden />
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                File Online
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mb-3">
                Filing a form online is easier and faster than paper filing. It gives you a simple and personalized way to track your case online.
              </p>
              <Link
                href="/guides"
                className="text-xs font-semibold text-[var(--text-primary)] hover:underline"
              >
                View Form Guides →
              </Link>
          </div>

            <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]/60 shadow-sm hover:shadow-md transition-shadow p-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/30 rounded-l-2xl" aria-hidden />
              <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2 flex items-center gap-2">
                <svg className="w-5 h-5 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                Manage Your Case
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mb-3">
                Use our online tools and resources to manage your case, check processing times, and track your case status.
              </p>
              <Link
                href="/stats"
                className="text-xs font-semibold text-[var(--text-primary)] hover:underline"
              >
                View Processing Times →
              </Link>
                  </div>
                      </div>

          <div className="p-4 bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 border border-[var(--border-color)]/60 rounded-xl shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-[var(--uscis-blue)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  🎉 You're on a 3-day free trial
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Trial ends on{" "}
                  <span className="font-semibold">
                    {subscriptionStatus.trialEnd instanceof Date
                      ? subscriptionStatus.trialEnd.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : ""}
                  </span>
                  . Cancel anytime before then to avoid charges.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content - Institutional layout with paper surface */}
      <div className="relative min-h-[50vh] bg-institutional-pattern">
        <CardContainer className="relative z-10 py-6 sm:py-10 lg:py-12 space-y-6 sm:space-y-8 lg:space-y-10">
        {/* Official Loading State */}
        {(authLoading || profileLoading) && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="animate-spin rounded-full h-14 w-14 border-4 border-[var(--uscis-blue)]/20"></div>
                <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-[var(--uscis-blue)] absolute top-0 left-0"></div>
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-[var(--text-primary)] mb-1">
                  {authLoading ? "Signing you in..." : "Loading your case..."}
                </p>
                <p className="text-sm text-[var(--text-secondary)]">
                  {authLoading ? "One moment." : "Pulling your timeline and position."}
                </p>
              </div>
            </div>
          </div>
        )}


        {/* Main Content - Government Dashboard Layout */}
        {!authLoading && !profileLoading && (
          <>
            {/* Email Verification Banner */}
            <EmailVerificationBanner />

            {/* Profile setup prompt — visible when logged in but no priority date */}
            {user && !profile?.priorityDate && (
              <div className="mb-4 sm:mb-6 p-4 rounded-xl bg-[var(--uscis-blue)]/10 border border-[var(--uscis-blue)]/25">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Add your case details</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Get your personalized timeline, key dates, and queue position.</p>
                  </div>
                  <Link
                    href="/profile-setup?edit=true"
                    className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors"
                    style={{ color: "#ffffff" }}
                  >
                    <span style={{ color: "#ffffff" }}>Set Up Profile</span>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#ffffff" }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </Link>
                </div>
              </div>
            )}
            
            {/* Section Header - Enhanced: Case Overview (hidden) */}
            {/*
            <div className="mb-5 sm:mb-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--uscis-blue)]/30 to-transparent"></div>
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] flex items-center justify-center shadow-md">
                    <svg className="w-4.5 h-4.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
                    Case Overview
                  </h2>
                </div>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[var(--uscis-blue)]/30 to-transparent"></div>
              </div>
              <div className="mb-5 p-4 bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 rounded-xl border border-[var(--border-color)]">
                <div className="flex items-start gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 dark:bg-blue-400/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-4.5 h-4.5 text-gray-800 dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm text-[var(--text-primary)] mb-1.5">Your Case Status at a Glance</h3>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      Get an instant snapshot of where your case stands in the immigration process. This section shows your current estimated stage 
                      and key milestones based on your profile and the latest processing data from USCIS.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            */}

            {/* 1. USCIS Case Status Card (USCIS API data) — full width, no max constraint */}
            {profile && profile.receiptNumber && profile.receiptNumber.length === 13 && (
              <div className="mb-6 sm:mb-8 w-full min-w-0">
                <USCISCaseStatus
                  receiptNumber={profile.receiptNumber}
                  onStatusFetching={(fetching) => setUscisFetching(fetching)}
                  onStatusLoaded={(status) => {
                    if (status.statusText?.toLowerCase().includes("unavailable")) {
                      setUscisFetchFailed(true);
                      setUscisDerivedStage(null);
                    } else {
                      setUscisFetchFailed(false);
                      const stage = mapUSCISStatusToCurrentStage(status.statusText);
                      if (stage) setUscisDerivedStage(stage);
                    }
                  }}
                  onStatusError={() => {
                    setUscisDerivedStage(null);
                    setUscisFetchFailed(true);
                  }}
                  onReceiptNumberChange={async (newReceipt) => {
                    // Update profile receipt number in Firestore
                    if (user) {
                      try {
                        const { doc, setDoc } = await import("firebase/firestore");
                        const { db } = await import("@/lib/firebase");
                        const profileRef = doc(db, "userProfiles", user.uid);
                        await setDoc(
                          profileRef,
                          {
                            receiptNumber: newReceipt,
                          },
                          { merge: true }
                        );
                        console.log("Receipt number updated in profile:", newReceipt);
                      } catch (error) {
                        console.error("Error updating receipt number:", error);
                      }
                    }
                  }}
                />
              </div>
            )}

            {/* Unlocked home: full width like USCIS Case Status card */}

            <div className="space-y-3 sm:space-y-5 w-full min-w-0 text-[11px] sm:text-sm">
              {/* Single column: Case Overview first; when incomplete, it's the only setup prompt */}
              <div className="flex flex-col gap-3 sm:gap-5 w-full min-w-0">
                <div className="space-y-3 sm:space-y-4">
                  {/* Case Overview — single source for profile setup when incomplete */}
                  <HomeCard
                    icon={<div className="w-full h-full flex items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600"><BoltIcon className="w-5 h-5 text-white" /></div>}
                    title="Case Overview"
                    subtitle="Your full case timeline, current stage, and what’s coming next in one place."
                    noInnerWrap
                    accent="blue"
                  >
                    <div className="space-y-3 sm:space-y-5">
                      <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">
                        See the big picture for your case—from where you started, to today, to the dates we’re watching next.
                      </p>
                      {timeline?.stages?.length ? (() => {
                        const nextStage = timeline.stages.find((s) => s.isCurrent || !s.isCompleted);
                        const allComplete = timeline.stages.every((s) => s.isCompleted);
                        const formatDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
                        const estRange = nextStage ? `${formatDate(new Date(nextStage.earliestDate))} – ${formatDate(new Date(nextStage.latestDate))}` : null;
                        const statusText = allComplete ? "Complete" : "On track";
                        const completedCount = timeline.stages.filter((s) => s.isCompleted).length;
                        const totalStages = timeline.stages.length;
                        const stageChartData = timeline.stages.slice(0, 6).map((s, i) => ({
                          name: s.name?.slice(0, 8) || `S${i + 1}`,
                          value: s.isCompleted || s.isCurrent ? 1 : 0,
                          fill: s.isCompleted ? "#059669" : s.isCurrent ? "var(--uscis-blue)" : "#94a3b8",
                        }));
                        return (
                          <>
                          <div className="rounded-lg p-2.5 sm:p-3 border border-[var(--border-color)]/40 bg-[var(--bg-surface-alt)]/50">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                              <div>
                                <p className="text-[10px] sm:text-xs font-medium text-[var(--text-tertiary)] mb-0.5">Trajectory</p>
                                <p className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">{statusText}</p>
                                {estRange && !allComplete && (
                                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">Est. {estRange}</p>
                                )}
                              </div>
                              {!allComplete && (
                                <div className="h-2 w-24 rounded-full bg-[var(--bg-surface-alt)] overflow-hidden shrink-0">
                                  <div className="h-full rounded-full bg-[var(--uscis-blue)]/60" style={{ width: "70%" }} aria-hidden />
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Mini charts — Approvals-style */}
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="rounded-lg p-3 border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50">
                              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Stages complete</p>
                              <div className="w-full h-16 min-w-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={[{ label: "Done", value: completedCount }, { label: "Left", value: totalStages - completedCount }]} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                                    <YAxis hide domain={[0, totalStages]} />
                                    <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={28}>
                                      <Cell fill="#059669" />
                                      <Cell fill="#94a3b8" />
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                              <p className="text-xs font-semibold text-[var(--text-primary)] mt-1">{completedCount}/{totalStages} stages</p>
                            </div>
                            <div className="rounded-lg p-3 border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50 sm:col-span-2">
                              <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Progress by stage</p>
                              <div className="w-full h-16 min-w-0">
                                <ResponsiveContainer width="100%" height="100%">
                                  <BarChart data={stageChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="name" tick={{ fontSize: 8, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                                    <YAxis hide domain={[0, 1]} />
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={20}>
                                      {stageChartData.map((entry, idx) => (
                                        <Cell key={idx} fill={entry.fill} />
                                      ))}
                                    </Bar>
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          </div>
                          </>
                        );
                      })() : null}
                      {profile?.priorityDate ? (
                        <div>
                          <TimelineView
                            formType={profile.formType}
                            priorityDate={new Date(profile.priorityDate)}
                            country={profile.country}
                            processingPath={(profile.processingPath as "Consular" | "AOS") || "Consular"}
                            currentStage={effectiveCurrentStage}
                            caseStatusUnavailable={uscisFetchFailed}
                            caseStatusFetching={uscisFetching}
                      isSubscribed={isSubscribed}
                      isPremiumGated={true}
                          />
                        </div>
                      ) : null}
                      {!profile?.priorityDate && (
                        <div className="p-4 sm:p-6 rounded-xl bg-[var(--bg-surface-alt)]/30 border border-[var(--border-color)]/50 text-center">
                          <div className="w-12 h-12 rounded-2xl overflow-hidden mx-auto mb-3 border border-[var(--border-color)]">
                            <Image src={ICON_IMAGES.checklist} alt="" width={48} height={48} className="w-full h-full object-cover" />
                          </div>
                          <p className="text-sm sm:text-base font-semibold text-[var(--text-primary)] mb-1.5">Set up your profile</p>
                          <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-4 max-w-sm mx-auto leading-relaxed">
                            Add your priority date and case details to unlock your personalized timeline, weekly summary, and key dates.
                          </p>
                          <Link
                            href="/profile-setup?edit=true"
                            className="inline-flex items-center gap-2 px-4 py-2.5 sm:px-5 sm:py-3 bg-slate-800 rounded-xl hover:bg-slate-700 hover:shadow-lg transition-all text-sm font-semibold shadow-sm"
                            style={{ color: "#ffffff" }}
                          >
                            <span style={{ color: "#ffffff" }}>Set Up Profile</span>
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#ffffff" }}>
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </Link>
                        </div>
                      )}
                    </div>
                  </HomeCard>

                  {/* Weekly Summary — moved below Case Timeline (Your case timeline above weekly summary) */}
                  {profile?.priorityDate && <WeeklySummary />}

                  {/* Key dates — only after profile complete */}
                  {profile?.priorityDate ? (
                    <HomeCard
                      id="key-dates"
                      icon={<Image src={ICON_IMAGES.calendar} alt="" width={44} height={44} className="w-full h-full object-cover rounded-lg" />}
                      title="Key dates"
                      subtitle="Important milestones—filings, biometrics, interviews, and more—in one simple calendar."
                      noInnerWrap
                      accent="emerald"
                    >
                      <div className="mb-2">
                        <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">
                          Keep all of your important immigration dates in one place so nothing sneaks up on you.
                        </p>
                      </div>
                      <CaseCalendar timeline={timeline} />
                    </HomeCard>
                  ) : null}

                  {/* Quick actions — moved up, right after Key dates */}
                  {profile?.priorityDate && (
                  <HomeCard
                    icon={<Image src={ICON_IMAGES.lightning} alt="" width={44} height={44} className="w-full h-full object-cover rounded-lg" />}
                    title="Quick actions"
                    subtitle="Daily briefing, shortcuts, and official USCIS links tailored to your case."
                    accent="violet"
                  >
                    <div className="space-y-2 sm:space-y-3">
                      <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">
                        One tap to check today’s activity, open tools, and jump to the official places that matter most.
                      </p>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">Daily briefing — approvals & trends</p>
                        <Link href="/daily-briefing" className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg bg-sky-600 text-white text-xs sm:text-sm font-medium hover:bg-sky-700 transition-colors">
                          Open
                          <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </Link>
                      </div>
                      <p className="text-[11px] sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                        Add your receipt to <strong className="text-[var(--text-primary)]">myUSCIS.gov</strong> for official email updates.
                      </p>
                    </div>
                  </HomeCard>
                  )}

                  {profile?.priorityDate && shouldShowQueuePosition && (
                    <div className="min-w-0">
                      <QueuePositionCard
                        userPriorityDate={new Date(profile.priorityDate)}
                        currentLatestPD={currentLatestPD}
                        formType={profile.formType}
                        processingPath={(profile.processingPath as "Consular" | "AOS") || "Consular"}
                      />
                    </div>
                  )}
                  {profile?.priorityDate && isSubscribed && (
                    <div className="min-w-0">
                      <CurrentProcessingTimesCard isSubscribed={true} />
                    </div>
                  )}
                  {profile?.priorityDate && !isSubscribed && (
                    <div className="min-w-0">
                      <PremiumUnlockCard />
                    </div>
                  )}

                  {/* Approvals this week — moved up, right after Queue/Processing */}
                  {profile?.priorityDate && profile?.formType && recentApprovalsCount !== null && (
                <HomeCard
                  icon={<Image src={ICON_IMAGES.check} alt="" width={44} height={44} className="w-full h-full object-cover rounded-lg" />}
                  title="Approvals this week"
                  accent="emerald"
                  subtitle={
                    <>
                      <strong className="text-[var(--text-primary)]">{recentApprovalsCount}</strong> {profile.formType} cases
                      approved in the last 7 days. See how busy the system has been around your category.
                    </>
                  }
                  gridCols={3}
                  badge={
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[10px] font-medium text-[var(--text-tertiary)]">Live</span>
                    </span>
                  }
                >
                  <HomeCardInner className="sm:col-span-3 mb-1">
                    <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">
                      Use this to feel the rhythm of the system—busy weeks, quiet streaks, and how often cases like yours move.
                    </p>
                  </HomeCardInner>
                    {recentApprovalsByDay && recentApprovalsByDay.length > 0 && (
                      <HomeCardInner>
                        <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Approvals per day</p>
                        <div className="w-full h-24 sm:h-28 min-h-[80px] sm:min-h-[100px] min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={recentApprovalsByDay} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                              <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={{ stroke: "var(--border-color)" }} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: "var(--text-secondary)" }} width={20} axisLine={false} tickLine={false} allowDecimals={false} />
                              <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }} formatter={(value: number | undefined) => [`${value ?? 0} approval${(value ?? 0) === 1 ? "" : "s"}`, ""]} labelFormatter={(label) => label ?? ""} />
                              <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={28} name="Approvals" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </HomeCardInner>
                    )}
                    {approvalsByWeekday && approvalsByWeekday.length > 0 && (
                      <HomeCardInner>
                        <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">By day of week (30 days)</p>
                        <div className="w-full h-24 sm:h-28 min-h-[80px] sm:min-h-[100px] min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={approvalsByWeekday} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={{ stroke: "var(--border-color)" }} tickLine={false} />
                              <YAxis tick={{ fontSize: 9, fill: "var(--text-secondary)" }} width={20} axisLine={false} tickLine={false} allowDecimals={false} />
                              <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }} formatter={(value: number | undefined) => [`${value ?? 0} approval${(value ?? 0) === 1 ? "" : "s"}`, ""]} labelFormatter={(label) => label ?? ""} />
                              <Bar dataKey="count" fill="var(--uscis-blue)" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={20} name="Approvals" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </HomeCardInner>
                    )}
                    {approvalsWeekComparison != null && (
                      <HomeCardInner>
                        <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">This week vs last week</p>
                        <div className="w-full h-24 sm:h-28 min-h-[80px] sm:min-h-[100px] min-w-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[{ period: "Last week", count: approvalsWeekComparison.lastWeek }, { period: "This week", count: approvalsWeekComparison.thisWeek }]} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} layout="vertical">
                              <XAxis type="number" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                              <YAxis type="category" dataKey="period" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} width={64} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }} formatter={(value: number | undefined) => [`${value ?? 0} approval${(value ?? 0) === 1 ? "" : "s"}`, ""]} labelFormatter={(label) => label ?? ""} />
                              <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive>
                                <Cell fill="#94a3b8" />
                                <Cell fill="#059669" />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </HomeCardInner>
                    )}
                </HomeCard>
              )}

                  {/* Latest processing & pace — only after profile complete */}
                  {profile?.priorityDate && profile?.formType && (currentLatestPD || pdStatsExtra) && (
                    <HomeCard
                      icon={<Image src={ICON_IMAGES.chart} alt="" width={44} height={44} className="w-full h-full object-cover rounded-lg" />}
                      title="Latest processing & pace"
                      subtitle={`${profile.formType} case movement right now, how fast the queue is clearing, and how long cases are taking.`}
                      gridCols={3}
                      accent="amber"
                    >
                      <HomeCardInner className="sm:col-span-3 mb-1">
                        <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">
                          A quick snapshot of where USCIS is working in the queue and how quickly they’re moving through cases.
                        </p>
                      </HomeCardInner>
                      {currentLatestPD ? (
                        <HomeCardInner>
                          <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Processing date (current)</p>
                          <div className="w-full h-24 sm:h-28 min-h-[80px] min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={[{ label: "Now", value: 100 }]}
                                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                              >
                                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                                <YAxis hide domain={[0, 100]} />
                                <Bar dataKey="value" fill="var(--uscis-blue)" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={40} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-xs font-semibold text-[var(--text-primary)] mt-1">
                            {currentLatestPD.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                          <p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Cases being processed from this date</p>
                        </HomeCardInner>
                      ) : null}
                      {pdStatsExtra?.pacePdsPerDay != null ? (
                        <HomeCardInner>
                          <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Pace (cases/day)</p>
                          <div className="w-full h-24 sm:h-28 min-h-[80px] min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={[{ label: "Pace", value: Math.round(pdStatsExtra.pacePdsPerDay) }]}
                                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                              >
                                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 9, fill: "var(--text-secondary)" }} width={24} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }} />
                                <Bar dataKey="value" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={32} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-xs font-semibold text-[var(--text-primary)] mt-1">~{Math.round(pdStatsExtra.pacePdsPerDay)} cases/day</p>
                        </HomeCardInner>
                      ) : null}
                      {pdStatsExtra?.avgTimeDays != null ? (
                        <HomeCardInner>
                          <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">Avg. processing time</p>
                          <div className="w-full h-24 sm:h-28 min-h-[80px] min-w-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={[{ label: "Days", value: Math.round(pdStatsExtra.avgTimeDays) }]}
                                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                              >
                                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 9, fill: "var(--text-secondary)" }} width={24} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip contentStyle={{ backgroundColor: "var(--bg-surface)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "11px" }} />
                                <Bar dataKey="value" fill="var(--uscis-blue)" fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={32} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                          <p className="text-xs font-semibold text-[var(--text-primary)] mt-1">~{Math.round(pdStatsExtra.avgTimeDays)} days avg</p>
                        </HomeCardInner>
                      ) : null}
                      {(!currentLatestPD && !pdStatsExtra?.avgTimeDays && !pdStatsExtra?.pacePdsPerDay) && (
                        <div className="sm:col-span-3">
                          <p className="text-sm text-[var(--text-secondary)]">Loading…</p>
                        </div>
                      )}
                      {(pdStatsExtra || currentLatestPD) && (
                        <div className="sm:col-span-3">
                          <Link href="/stats" className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] hover:underline inline-block">
                            View full stats →
                          </Link>
                        </div>
                      )}
                    </HomeCard>
                  )}

                  {/* Latest update — moved down, after Latest processing */}
                  {profile?.priorityDate && latestNewsItem && (
                    <HomeCard
                      icon={<Image src={ICON_IMAGES.newspaper} alt="" width={44} height={44} className="w-full h-full object-cover rounded-lg" />}
                      title="Latest update"
                      subtitle="High-signal immigration news that actually affects family and fiancé visa timelines."
                      accent="indigo"
                    >
                      <p className="text-[11px] sm:text-sm text-[var(--text-secondary)] mb-2">
                        We surface only the news that might move your timeline—no noise, just the updates that matter.
                      </p>
                      <p className="text-xs sm:text-sm font-medium text-[var(--text-primary)] mb-0.5">{latestNewsItem.title}</p>
                      {latestNewsItem.summary && (
                        <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-2">{latestNewsItem.summary}</p>
                      )}
                      <Link href="/news" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
                        Read more →
                      </Link>
                    </HomeCard>
                  )}

                  <USCISDisclaimer />
                </div>
              </div>

            {/* Activity & Trends - only when subscribed */}
            {isSubscribed && profile?.formType && isI130OrI129FUser(profile.formType) && (
              <section className="mt-6 sm:mt-8">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 sm:mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-[var(--uscis-blue)]/50" aria-hidden />
                  What's moving
                </h2>
                <DailyApprovalCard formType={profile.formType} isSubscribed={true} />
              </section>
            )}

            {isSubscribed && profile?.priorityDate && (
              <section className="mt-6 sm:mt-8">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3 sm:mb-4 flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-emerald-500/50" aria-hidden />
                  Pro tools
                </h2>
                <PremiumServices />
              </section>
            )}
            </div>
          </>
        )}

        {/* Profile Error State - Official Style */}
        {!authLoading && !profileLoading && user && profileStatus === "error" && (
          <div className="rounded-2xl bg-[var(--bg-surface)] border-2 border-red-200 shadow-[var(--shadow-md)] mb-8 overflow-hidden">
            <div className="bg-red-50/50 dark:bg-red-950/30 border-b border-red-200/50 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg overflow-hidden border border-red-200">
                  <Image src={ICON_IMAGES.warning} alt="" width={40} height={40} className="w-full h-full object-cover" />
                </div>
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Data Retrieval Error</h3>
              </div>
            </div>
            <div className="p-8">
              <p className="text-[var(--text-primary)] mb-2 leading-relaxed">
                Unable to retrieve profile data from the secure database. This may be due to:
              </p>
              <ul className="list-disc list-inside text-[var(--text-secondary)] mb-6 space-y-1 ml-4">
                <li>Network connectivity issues</li>
                <li>Temporary service interruption</li>
                <li>Authentication session expiration</li>
              </ul>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => window.location.reload()}
                  className="uscis-button"
                >
                  Retry Data Retrieval
                </button>
                <Link
                  href="/profile-setup?edit=true"
                  className="uscis-button uscis-button-secondary"
                >
                  Reconfigure Profile
                </Link>
              </div>
            </div>
          </div>
        )}

      </CardContainer>
      
      {/* USCIS Related Resources Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <USCISRelatedResources />
      </div>
      
      {/* USCIS Feedback Widget */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <USCISFeedbackWidget />
      </div>
      </div>
    </div>
  );
}
