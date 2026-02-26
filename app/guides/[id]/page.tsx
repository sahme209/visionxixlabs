"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { guides } from "@/lib/guides-data";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeftIcon, CheckIcon, LockClosedIcon, DocumentTextIcon, InformationCircleIcon, ClockIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import USCISFormCategoryBadge, { getFormCategory } from "@/components/USCISFormCategoryBadge";
import USCISAlertBanner from "@/components/USCISAlertBanner";
import USCISFeedbackWidget from "@/components/USCISFeedbackWidget";
import USCISDisclaimer from "@/components/USCISDisclaimer";
import USCISOfficialNotice from "@/components/USCISOfficialNotice";
import { HERO_IMAGES, EMPTY_STATE_IMAGES } from "@/lib/images";

function cleanTitle(title: string): string {
  return title
    .replace(/📝\s*|💍\s*|🟢\s*|💑\s*|💼\s*|✈️\s*|🏢\s*|💚\s*|🆔\s*|🇺🇸\s*|📋\s*|🛡️\s*|🔐\s*|🎓\s*/g, "")
    .trim();
}

/** Official form number for header badge (e.g. I-130) */
function formNumber(guideId: string, title: string): string {
  const m = title.match(/\b(I|N|K)[-\s]?\d+[A-Za-z]?\b/);
  return m ? m[0].replace(/\s/g, "-") : guideId.toUpperCase();
}

/** What you'll need before starting – by guide id */
const WHAT_YOU_NEED: Record<string, string[]> = {
  i130: ["Proof of your relationship (marriage cert, photos, etc.)", "Both people’s passport-style photos", "Copies of passports or birth certificates", "Filing fee: $535 (check uscis.gov for current fee)", "A valid email and mailing address for USCIS"],
  i129f: ["Proof you met in person in the last 2 years", "Passport-style photos of both", "Evidence of your relationship", "Filing fee: $535", "Intent to marry within 90 days of entry"],
  i485: ["Approved I-130 or other immigrant petition", "Medical exam (I-693) from a USCIS doctor", "Affidavit of Support (I-864) from sponsor", "Birth certificate, passport, photos", "Filing fee (see uscis.gov)"],
  i765: ["Proof of eligibility (e.g. I-485 receipt)", "Passport-style photos", "Copy of I-94 or other status", "Filing fee or fee waiver"],
  i131: ["Pending I-485 receipt", "Passport-style photos", "Reason for travel (optional letter)", "Filing fee or included with I-485"],
  i140: ["Job offer letter and labor certification (if required)", "Degree evaluations, licenses", "Employer support letter", "Filing fee"],
  i751: ["Evidence of marriage (joint lease, bills, photos)", "Green card copy", "Filing fee"],
  i90: ["Current green card or proof of loss/theft", "Passport-style photos", "Filing fee"],
  n400: ["Green card", "Tax returns, travel records", "Filing fee"],
  k3: ["Approved or pending I-130 receipt", "Marriage certificate", "Filing fees for I-130 and I-129F"],
  i601: ["Evidence of extreme hardship to qualifying relative (U.S. citizen/LPR spouse or parent)", "Medical, financial, or emotional hardship documents", "Filing fee: $930 (check uscis.gov)", "Approved immigrant petition (if applicable)"],
  i601a: ["Approved I-130 or I-140", "Evidence of extreme hardship to U.S. citizen/LPR spouse or parent", "Proof you’re in the U.S. when filing", "Filing fee: $630 (check uscis.gov)"],
  i821d: ["Proof of arrival before age 16", "Evidence of continuous residence since June 15, 2007", "Education records (diploma, transcript, or GED)", "Passport-style photos", "Filing fee: $495 (check uscis.gov)"],
};

export default function GuideDetailPage() {
  const params = useParams();
  const router = useRouter();
  const guideId = params.id as string;
  const guide = guides.find((g) => g.id === guideId);
  const { user } = useAuth();
  const { isSubscribed, hasUsedTrial } = useSubscription();
  
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Load completed steps from Firebase (if signed in) or localStorage
  useEffect(() => {
    const loadCompletedSteps = async () => {
      setLoading(true);
      try {
        if (user) {
          // Try Firebase first
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const guideProgress = data.guideProgress || {};
            const guideCompleted = guideProgress[guideId] || [];
            setCompletedSteps(new Set(guideCompleted));
          }
        } else {
          // Fallback to localStorage
          const stored = localStorage.getItem(`completedSteps_${guideId}`);
          if (stored) {
            try {
              setCompletedSteps(new Set(JSON.parse(stored)));
            } catch (e) {}
          }
        }
      } catch (error) {
        console.error("Error loading completed steps:", error);
        // Fallback to localStorage
        const stored = localStorage.getItem(`completedSteps_${guideId}`);
        if (stored) {
          try {
            setCompletedSteps(new Set(JSON.parse(stored)));
          } catch (e) {}
        }
      } finally {
        setLoading(false);
      }
    };
    loadCompletedSteps();
  }, [user, guideId]);

  // Save completed steps to Firebase (if signed in) and localStorage
  useEffect(() => {
    if (loading) return;
    
    const saveCompletedSteps = async () => {
      const stepsArray = Array.from(completedSteps);
      
      // Always save to localStorage
      localStorage.setItem(`completedSteps_${guideId}`, JSON.stringify(stepsArray));
      
      // Also save to Firebase if signed in
      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          const currentData = docSnap.exists() ? docSnap.data() : {};
          const guideProgress = currentData.guideProgress || {};
          guideProgress[guideId] = stepsArray;
          
          await setDoc(docRef, { guideProgress }, { merge: true });
        } catch (error) {
          console.error("Error saving completed steps:", error);
        }
      }
    };
    
    saveCompletedSteps();
  }, [completedSteps, user, guideId, loading]);

  if (!guide) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
        <div className="rounded-2xl border border-[var(--border-color)] overflow-hidden relative max-w-md w-full">
          <div className="absolute inset-0 opacity-[0.06]">
            <Image src={EMPTY_STATE_IMAGES.guides} alt="" fill className="object-cover" sizes="600px" />
          </div>
          <div className="relative p-12 text-center">
            <p className="text-gray-700 dark:text-[var(--text-secondary)] font-medium">Guide not found</p>
            <Link href="/guides" className="text-[var(--text-primary)] mt-4 inline-block font-semibold hover:underline">
              Back to Guides
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const completed = guide.steps.filter((s) => completedSteps.has(s.id)).length;
  const progress = guide.steps.length > 0 ? (completed / guide.steps.length) * 100 : 0;

  // Check if a step is locked (all steps except step 1 require subscription)
  const isStepLocked = (stepIndex: number): boolean => {
    // Step 1 (index 0) is always unlocked
    if (stepIndex === 0) return false;
    // All other steps require subscription
    return !isSubscribed;
  };

  const handleStepClick = (stepIndex: number, stepId: string) => {
    if (isStepLocked(stepIndex)) {
      // Redirect to subscription page
      router.push("/subscribe");
      return;
    }
    toggleExpand(stepId);
  };

  const toggleComplete = (stepId: string, stepIndex: number) => {
    // Don't allow completing locked steps
    if (isStepLocked(stepIndex)) {
      router.push("/subscribe");
      return;
    }
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const toggleExpand = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const formNum = formNumber(guide.id, guide.title);
  const whatYouNeed = WHAT_YOU_NEED[guide.id];
  const category = getFormCategory(guide.id);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Pro gradient header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative z-10 max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 py-4">
          <div className="flex items-start gap-3">
            <Link
              href="/guides"
              className="p-2 hover:bg-white/15 rounded-lg transition-colors flex-shrink-0"
              aria-label="Back to guides"
            >
              <ChevronLeftIcon className="w-5 h-5 text-white" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-white/20 border border-white/30 text-white">
                  {formNum}
                </span>
                <span className="text-[11px] text-white/80">Official USCIS form guide</span>
                <USCISFormCategoryBadge category={category} className="ml-auto" />
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white mb-1">
                {cleanTitle(guide.title)}
              </h1>
              {guide.overview && (
                <p className="text-xs text-white/90 leading-snug mb-2">
                  {guide.overview}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-white/85">
                {guide.estimatedTime && (
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <strong className="text-white">{guide.estimatedTime}</strong> typical processing
                  </span>
                )}
                {guide.difficulty && (
                  <span className="flex items-center gap-1">
                    <span className="font-semibold text-white">{guide.difficulty}</span> difficulty
                  </span>
                )}
                <span>{guide.steps.length} steps</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-[var(--bg-surface)] border-b border-[var(--border-color)] px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto w-full min-w-0">
          <div className="flex items-center justify-between mb-1.5 text-xs">
            <span className="text-[var(--text-secondary)]">
              {completed > 0 ? `${completed} of ${guide.steps.length} steps done` : "Start with step 1 below"}
            </span>
            {progress > 0 && (
              <span className="font-semibold text-[var(--text-primary)]">
                {Math.round(progress)}% complete
              </span>
            )}
          </div>
          <div className="w-full bg-[var(--bg-surface-alt)] rounded-full h-2">
            <div
              className="bg-[var(--uscis-blue)] h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto w-full min-w-0 px-4 sm:px-6 py-4 space-y-4">
        {/* What you'll need */}
        {whatYouNeed && whatYouNeed.length > 0 && (
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4" style={{ borderLeft: "4px solid var(--uscis-blue)" }}>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0">
                <DocumentTextIcon className="w-5 h-5 text-[var(--text-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xs font-bold text-[var(--text-primary)] mb-2">What you’ll need before you start</h2>
                <p className="text-[11px] text-[var(--text-secondary)] mb-2">Gather these so you’re ready. You don’t have to have everything before step 1, but it helps.</p>
                <ul className="space-y-1.5">
                  {whatYouNeed.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-[var(--text-primary)]">
                      <span className="text-[var(--text-primary)] mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* How to use this guide */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)]/50 p-3">
          <p className="text-[11px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">How to use this guide</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-[var(--text-secondary)]">
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-[var(--uscis-blue)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]">1</span> Do steps in order</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-[var(--uscis-blue)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]">2</span> Tap step to expand</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-[var(--uscis-blue)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]">✓</span> Check off when done</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-[var(--uscis-blue)]/20 flex items-center justify-center text-[10px] font-bold text-[var(--text-primary)]">💡</span> Read tips & warnings</span>
          </div>
        </div>

        {/* Steps list */}
        <div>
          <h2 className="text-xs font-bold text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Steps</h2>
          <div className="space-y-3">
        {guide.steps.map((step, index) => {
          const isCompleted = completedSteps.has(step.id);
          const isExpanded = expandedSteps.has(step.id);
          const isLocked = isStepLocked(index);

          return (
            <div
              key={step.id}
              className={`bg-[var(--bg-surface)] rounded-xl p-4 sm:p-5 border border-[var(--border-color)] transition-all shadow-sm hover:shadow-md ${
                isLocked
                  ? "opacity-90"
                  : isCompleted
                  ? "bg-green-50/20 dark:bg-green-900/10"
                  : "hover:border-[var(--uscis-blue)]/40"
              }`}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => toggleComplete(step.id, index)}
                  disabled={isLocked}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                    isLocked
                      ? "border-gray-300 dark:border-gray-600 cursor-not-allowed opacity-50"
                      : isCompleted
                      ? "bg-[var(--uscis-blue)] border-[var(--uscis-blue)] hover:bg-[var(--uscis-blue-dark)]"
                      : "border-[var(--border-color)] hover:border-[var(--uscis-blue)] cursor-pointer"
                  }`}
                >
                  {isCompleted && !isLocked && <CheckIcon className="w-4 h-4 text-white" />}
                  {isLocked && <LockClosedIcon className="w-3 h-3 text-gray-400" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-700 dark:text-[var(--text-secondary)]">
                          Step {index + 1}
                        </span>
                        {isLocked && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white dark:from-blue-500 dark:to-indigo-500 shadow-sm">
                            <LockClosedIcon className="w-3 h-3" />
                            Premium
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleStepClick(index, step.id)}
                        disabled={isLocked}
                        className={`text-left w-full ${
                          isLocked ? "cursor-pointer" : ""
                        }`}
                      >
                        <h3
                          className={`text-sm sm:text-base font-semibold transition-colors ${
                            isLocked
                              ? "text-gray-500 dark:text-gray-400"
                              : "text-gray-900 dark:text-[var(--text-primary)] hover:text-[var(--text-primary)]"
                          }`}
                        >
                          {step.title}
                        </h3>
                      </button>
                    </div>
                    {!isLocked && (
                      <button
                        onClick={() => toggleExpand(step.id)}
                        className={`text-gray-500 dark:text-[var(--text-tertiary)] transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      >
                        ▼
                      </button>
                    )}
                    {isLocked && (
                      <button
                        onClick={() => router.push("/subscribe")}
                        className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        title="Unlock with subscription"
                      >
                        <LockClosedIcon className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                  {isExpanded && !isLocked && (
                    <div className="mt-5 space-y-5 text-gray-900 dark:text-[var(--text-primary)] border-t border-[var(--border-color)] pt-4">
                      {/* Main Instructions */}
                      <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-blue-500 dark:bg-blue-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-gray-900 dark:text-[var(--text-primary)] mb-1.5">What You Need to Do</p>
                            <p className="text-xs leading-relaxed text-gray-700 dark:text-[var(--text-secondary)]">{step.description}</p>
                          </div>
                        </div>
                        {step.link && (
                          <a
                            href={step.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 bg-[var(--uscis-blue)] hover:bg-[var(--uscis-blue-dark)] text-white text-xs font-semibold rounded-lg transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Open official USCIS page
                          </a>
                        )}
                      </div>

                      {/* Tips Section */}
                      {step.tips && step.tips.length > 0 && (
                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-900/10 rounded-xl p-4 border-2 border-green-200 dark:border-green-800">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-green-500 dark:bg-green-600 flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-green-700 dark:text-green-300 mb-1.5">💡 Helpful Tips</p>
                              <p className="text-[11px] text-green-600 dark:text-green-400 mb-2">These tips will help you complete this step faster and avoid mistakes</p>
                              <ul className="space-y-2">
                                {step.tips.map((tip, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <div className="w-4 h-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <span className="text-green-600 dark:text-green-400 font-bold text-[10px]">{i + 1}</span>
                                    </div>
                                    <span className="text-xs leading-relaxed text-gray-900 dark:text-[var(--text-primary)] flex-1">{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Warnings Section */}
                      {step.warnings && step.warnings.length > 0 && (
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl p-4 border-2 border-blue-300 dark:border-blue-800">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="w-8 h-8 rounded-lg bg-blue-500 dark:bg-blue-600 flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-gray-800 dark:text-gray-200 mb-1.5">⚠️ Important Warnings</p>
                              <p className="text-[11px] text-gray-800 dark:text-gray-200 mb-2">Please read these carefully—they can save you time and prevent serious problems</p>
                              <ul className="space-y-2">
                                {step.warnings.map((warning, i) => (
                                  <li key={i} className="flex items-start gap-2">
                                    <div className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                      <span className="text-gray-800 dark:text-gray-200 font-bold text-[10px]">!</span>
                                    </div>
                                    <span className="text-xs leading-relaxed text-gray-900 dark:text-[var(--text-primary)] flex-1 font-medium">{warning}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {isLocked && (
                    <div className="mt-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-300 dark:border-blue-800 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg className="w-5 h-5 text-gray-800 dark:text-gray-200" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-red-200 mb-3">
                            This step is available with a premium subscription.
                          </p>
                          <button
                            onClick={() => router.push("/subscribe")}
                            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-sm font-semibold transition-all shadow-sm hover:shadow flex flex-col items-center gap-1"
                          >
                            <span>Subscribe to Unlock</span>
                            {!hasUsedTrial && (
                              <span className="text-[10px] font-semibold text-white/90 bg-white/25 px-2 py-0.5 rounded">
                                3-Day Free Trial
                              </span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
          </div>
        </div>

        {/* Footer – official source */}
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 mt-6">
          <p className="text-[11px] text-[var(--text-tertiary)] leading-relaxed">
            This guide is for general information only. Forms, fees, and rules change. Always use the official USCIS website for current forms, instructions, and filing.
          </p>
          <a
            href="https://www.uscis.gov"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold text-[var(--text-primary)] hover:underline"
          >
            Go to uscis.gov
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>

        {/* Official Disclaimer */}
        <div className="mt-6">
          <USCISDisclaimer variant="compact" />
        </div>

        {/* USCIS Feedback Widget */}
        <USCISFeedbackWidget />
      </div>
    </div>
  );
}


