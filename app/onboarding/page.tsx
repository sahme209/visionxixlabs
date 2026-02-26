"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/lib/analytics";
import {
  CheckIcon,
  ChartBarIcon,
  ClockIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  BellIcon,
  ArrowRightIcon,
  ChevronRightIcon,
  GlobeAmericasIcon,
  BuildingOffice2Icon,
  UserGroupIcon,
  SparklesIcon,
  BookOpenIcon,
  QuestionMarkCircleIcon,
  MagnifyingGlassIcon,
  ArrowDownIcon,
} from "@heroicons/react/24/outline";

export default function OnboardingPage() {
  const router = useRouter();
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [appear, setAppear] = useState(false);
  const animationTriggerRef = useRef(false);

  useEffect(() => {
    const seen = localStorage.getItem("hasSeenOnboarding");
    if (seen === "true") {
      setHasSeenOnboarding(true);
      router.push("/");
    } else {
      setAppear(true);
      analytics.onboardingStarted();
    }
  }, [router]);

  useEffect(() => {
    // Reset animations when page changes
    setAppear(false);
    const timer = setTimeout(() => {
      setAppear(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [currentPage]);

  const handleNext = () => {
    if (currentPage < 6) {
      const stepNames = ["welcome", "case_tracking", "service_center", "advanced_estimation", "timeline", "community", "premium"];
      analytics.onboardingStepCompleted(currentPage + 1, stepNames[currentPage] || `step_${currentPage}`);
      setCurrentPage(currentPage + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleSkip = () => {
    analytics.onboardingAbandoned(currentPage);
    localStorage.setItem("hasSeenOnboarding", "true");
    router.push("/");
  };

  const handleComplete = () => {
    analytics.onboardingCompleted();
    localStorage.setItem("hasSeenOnboarding", "true");
    router.push("/login");
  };

  if (hasSeenOnboarding) {
    return null;
  }

  const pages = [
    <WelcomePage key="welcome" appear={appear} />,
    <CaseTrackingPage key="case" appear={appear} />,
    <ServiceCenterPage key="service" appear={appear} />,
    <AdvancedEstimationPage key="advanced" appear={appear} />,
    <TimelinePage key="timeline" appear={appear} />,
    <CommunityPage key="community" appear={appear} />,
    <PremiumPage key="premium" appear={appear} onComplete={handleComplete} />,
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[var(--uscis-blue-dark)] via-[var(--uscis-blue)] to-[var(--bg-primary)] relative overflow-hidden">
      {/* Subtle official border pattern at top */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[var(--uscis-blue)]/30 via-transparent to-[var(--uscis-blue)]/30 z-20" />

      {/* Page Content */}
      <div className="relative z-10 min-h-screen flex flex-col px-4 sm:px-6 py-6">
        <div className="w-full mx-auto w-full bg-[var(--bg-secondary)] rounded-3xl shadow-2xl border border-[var(--border-color)] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]/95">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-[var(--bg-tertiary)] rounded-xl flex items-center justify-center border border-[var(--border-color)] p-2">
                  <img src="/logo.svg" alt="VisaNova" className="w-full h-full object-contain" />
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-[var(--text-primary)] leading-tight">
                    VisaNova
                  </span>
                  <span className="text-[11px] text-[var(--text-secondary)] leading-tight">
                    Know where you stand. Plan with confidence.
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">
                  Independent.
                </span>
                <button
                  onClick={handleSkip}
                  className="px-3 sm:px-4 py-2 min-h-[36px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded-lg border border-transparent hover:border-[var(--border-color-hover)] transition-all text-xs sm:text-sm font-medium touch-manipulation active:scale-95"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="px-6 pt-4 pb-3 bg-[var(--bg-secondary)]/95 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide uppercase">
                Step {currentPage + 1} of {pages.length}
              </span>
              <div className="flex-1 h-2 bg-[var(--bg-tertiary)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] transition-all duration-300 ease-out"
                  style={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
                />
              </div>
              <span className="text-xs font-medium text-[var(--text-secondary)] tabular-nums">
                {Math.round(((currentPage + 1) / pages.length) * 100)}%
              </span>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
            {pages[currentPage]}
          </div>

          {/* Bottom Navigation */}
          <div className="px-6 pb-6 pt-4 space-y-4 bg-[var(--bg-secondary)]/95 border-t border-[var(--border-color)]">
            {/* Authenticity / disclaimer strip */}
            <div className="w-full mx-auto text-center text-[11px] leading-snug text-[var(--text-secondary)] bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-lg px-3 py-2">
              We use public USCIS data and historical approval patterns to estimate timelines. Estimates are for planning only and are
              not official case status.
            </div>

            {/* Progress Indicators (hide on Premium page) */}
            {currentPage < 6 && (
              <div className="flex justify-center gap-2.5 mb-2">
                {Array.from({ length: 7 }).map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      currentPage === index
                        ? "w-6 bg-[var(--uscis-blue)]"
                        : "w-2 bg-gray-300 dark:bg-gray-600"
                    }`}
                  />
                ))}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between w-full mx-auto gap-4">
              <button
                onClick={handlePrevious}
                disabled={currentPage === 0}
                className={`px-4 sm:px-6 py-3 min-h-[44px] rounded-lg font-semibold transition-all touch-manipulation ${
                  currentPage === 0
                    ? "opacity-0 pointer-events-none"
                    : "bg-[var(--bg-secondary)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] active:scale-95 border border-[var(--border-color)]"
                }`}
              >
                <span className="text-sm sm:text-base">Previous</span>
              </button>

              <button
                onClick={handleNext}
                className="flex-1 sm:flex-initial px-4 sm:px-6 py-3 min-h-[44px] bg-[var(--uscis-blue)] text-white rounded-lg font-bold hover:bg-[var(--uscis-blue-dark)] transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 touch-manipulation active:scale-95"
              >
                <span className="text-sm sm:text-base">
                  {currentPage === 6 ? "Get started with VisaNova" : "Continue"}
                </span>
                {currentPage < 6 && <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Page Components
function WelcomePage({ appear }: { appear: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-4">
      <div className="w-full mx-auto w-full text-center space-y-8">
        <PageInfoCard
          Icon={ShieldCheckIcon}
          title="Welcome to VisaNova"
          subtitle="Know where you stand. Plan with confidence."
          appear={appear}
        />

        <div className={`transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`} style={{ transitionDelay: "200ms" }}>
          <div className="w-32 h-32 mx-auto mb-6 rounded-full border-2 border-[var(--uscis-blue)]/20 bg-gradient-to-br from-[var(--uscis-blue)]/10 to-[var(--uscis-blue)]/5 flex items-center justify-center">
            <ShieldCheckIcon className="w-16 h-16 text-[var(--text-primary)]" />
          </div>
        </div>

        <div className={`space-y-6 transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "300ms" }}>
          <div className="w-12 h-0.5 bg-[var(--uscis-blue)]/30 mx-auto" />
          
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
            Know what's happening with your case
          </h2>
          
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            Take things one step at a time. You can update your information anytime.
          </p>

          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 max-w-xl mx-auto space-y-4 text-left border border-[var(--border-color)]">
            {[
              "Instant USCIS alerts",
              "See service center movement",
              "Step-by-step guidance",
            ].map((item, index) => (
              <div key={index} className={`flex items-center gap-3 transition-all duration-500 ${appear ? "opacity-100 translate-x-0" : "opacity-0 translate-x-4"}`} style={{ transitionDelay: `${500 + index * 100}ms` }}>
                <CheckIcon className="w-5 h-5 text-[var(--text-primary)] flex-shrink-0" />
                <span className="text-[var(--text-primary)] font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseTrackingPage({ appear }: { appear: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-4">
      <div className="w-full mx-auto w-full space-y-8">
        <PageInfoCard
          Icon={MagnifyingGlassIcon}
          title="See Your Case Status Instantly"
          subtitle="Never wonder if your case moved forward"
          appear={appear}
        />

        <div className={`transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`} style={{ transitionDelay: "200ms" }}>
          <ProfessionalCaseDocument appear={appear} />
        </div>

        <div className={`text-center space-y-4 transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "300ms" }}>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
            See Your Case Status Instantly
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            Get peace of mind knowing exactly where your case stands. See every status change the moment it happens, so you're never left guessing.
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-[var(--text-primary)]">
            <ShieldCheckIcon className="w-4 h-4" />
            <span className="font-medium">Powered by official USCIS data</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceCenterPage({ appear }: { appear: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-4">
      <div className="w-full mx-auto w-full space-y-8">
        <PageInfoCard
          Icon={BuildingOffice2Icon}
          title="Understand How Your Center Moves"
          subtitle="See what's happening where your case is processed"
          appear={appear}
        />

        <div className={`transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`} style={{ transitionDelay: "200ms" }}>
          <ProfessionalServiceCenter appear={appear} />
        </div>

        <div className={`text-center space-y-4 transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "300ms" }}>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
            Understand How Your Center Moves
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            Know how fast your service center is processing cases like yours. This helps you set realistic expectations and plan ahead with confidence.
          </p>
        </div>
      </div>
    </div>
  );
}

function AdvancedEstimationPage({ appear }: { appear: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-4 overflow-y-auto">
      <div className="w-full mx-auto w-full space-y-8 py-8">
        <PageInfoCard
          Icon={ChartBarIcon}
          title="Advanced Estimation Methodology"
          subtitle="Dual-factor precision analysis"
          appear={appear}
        />

        <div className={`transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`} style={{ transitionDelay: "200ms" }}>
          <OfficialEstimationIllustration appear={appear} />
        </div>

        <div className={`transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "500ms" }}>
          <div className="bg-[var(--bg-secondary)] border-2 border-[var(--uscis-blue)]/20 rounded-lg overflow-hidden">
            <div className="bg-[var(--uscis-blue)]/8 border-b border-[var(--uscis-blue)]/20 px-4 py-3 flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5 text-[var(--text-primary)]" />
              <span className="text-xs font-bold text-[var(--text-primary)] tracking-wider uppercase">ADVANCED ESTIMATION METHODOLOGY</span>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="font-semibold text-[var(--text-primary)]">Dual-Factor Analysis</h3>
              <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
                This methodology provides the most accurate approval date estimates available by analyzing both country-specific patterns and service center processing data simultaneously.
              </p>
              <div className="flex gap-2 items-start">
                <div className="w-0.5 h-6 bg-[var(--uscis-blue)] mt-1 flex-shrink-0" />
                <p className="text-[var(--text-secondary)] text-xs italic leading-relaxed">
                  This analytical approach is exclusive to VisaNova and represents the current standard for immigration case estimation accuracy.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimelinePage({ appear }: { appear: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-4">
      <div className="w-full mx-auto w-full space-y-8">
        <PageInfoCard
          Icon={ClockIcon}
          title="Get a Realistic Timeline"
          subtitle="Know when to expect your approval"
          appear={appear}
        />

        <div className={`transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`} style={{ transitionDelay: "200ms" }}>
          <ProfessionalTimelineChart appear={appear} />
        </div>

        <div className={`text-center space-y-4 transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "300ms" }}>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
            Get a Realistic Timeline
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            Stop wondering 'when will I get approved?' See estimates based on real cases like yours, so you can plan your life with less anxiety and uncertainty.
          </p>
        </div>
      </div>
    </div>
  );
}

function CommunityPage({ appear }: { appear: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-4">
      <div className="w-full mx-auto w-full space-y-8">
        <PageInfoCard
          Icon={UserGroupIcon}
          title="Community & Help Resources"
          subtitle="Get support when you need it"
          appear={appear}
        />

        <div className={`transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`} style={{ transitionDelay: "200ms" }}>
          <ProfessionalHelpResources appear={appear} />
        </div>

        <div className={`text-center space-y-4 transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "300ms" }}>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
            Get Support When You Need It
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            Access form guides, help center, community discussions, and smart notifications to stay informed throughout your journey.
          </p>
        </div>
      </div>
    </div>
  );
}

function PremiumPage({ appear, onComplete }: { appear: boolean; onComplete: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-4">
      <div className="w-full mx-auto w-full space-y-8">
        <div className={`text-center space-y-6 transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`} style={{ transitionDelay: "200ms" }}>
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-[var(--uscis-blue)]/20 to-[var(--uscis-blue)]/10 flex items-center justify-center border-2 border-[var(--uscis-blue)]/30">
            <SparklesIcon className="w-12 h-12 text-[var(--text-primary)]" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--text-primary)]">
            Ready to Get Started?
          </h2>
          <p className="text-lg text-[var(--text-secondary)] max-w-2xl mx-auto">
            Sign in to start tracking your case and get personalized estimates based on your profile.
          </p>
        </div>

        <div className={`grid md:grid-cols-2 gap-4 max-w-2xl mx-auto transition-all duration-700 ${appear ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`} style={{ transitionDelay: "400ms" }}>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-color)] space-y-4">
            <h3 className="font-semibold text-[var(--text-primary)]">Free Features</h3>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Case status tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Timeline estimates</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span>Service center insights</span>
              </li>
            </ul>
          </div>
          <div className="bg-gradient-to-br from-[var(--uscis-blue)]/10 to-[var(--uscis-blue)]/5 rounded-xl p-6 border-2 border-[var(--uscis-blue)]/30 space-y-4">
            <h3 className="font-semibold text-[var(--text-primary)]">With Account</h3>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-[var(--text-primary)] flex-shrink-0" />
                <span>All free features</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-[var(--text-primary)] flex-shrink-0" />
                <span>Cloud sync across devices</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4 text-[var(--text-primary)] flex-shrink-0" />
                <span>Personalized notifications</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Illustration Components
function ProfessionalCaseDocument({ appear }: { appear: boolean }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (appear) {
      setTimeout(() => setProgress(0.75), 300);
    }
  }, [appear]);

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-color)] max-w-md mx-auto">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-1 h-6 bg-[var(--uscis-blue)] rounded" />
          <div className="flex-1">
            <div className="font-mono font-bold text-[var(--text-primary)] text-sm">FORM I-130</div>
            <div className="text-xs text-[var(--text-secondary)]">Petition for Alien Relative</div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs font-mono font-bold text-green-600 dark:text-green-400">ACTIVE</span>
          </div>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--uscis-blue)] transition-all duration-1000 ease-out"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
        <div className="text-xs text-[var(--text-secondary)]">Processing your case...</div>
      </div>
    </div>
  );
}

function ProfessionalServiceCenter({ appear }: { appear: boolean }) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-color)] max-w-md mx-auto">
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <BuildingOffice2Icon className="w-16 h-16 text-[var(--text-primary)]" />
        </div>
        <div className="text-center space-y-2">
          <div className="font-bold text-[var(--text-primary)]">Service Center Performance</div>
          <div className="text-sm text-[var(--text-secondary)]">Current Processing: May 20, 2024</div>
          <div className="text-sm text-[var(--text-secondary)]">Avg Processing Time: 12.5 months</div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-red-500/10 text-red-600 dark:text-red-400 rounded-full text-xs font-medium">
            Processing Pace: Moderate
          </div>
        </div>
      </div>
    </div>
  );
}

function OfficialEstimationIllustration({ appear }: { appear: boolean }) {
  return (
    <div className="relative flex flex-col items-center gap-6 py-8">
      <div className="flex items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full bg-[var(--uscis-blue)]/15 flex items-center justify-center">
            <GlobeAmericasIcon className="w-10 h-10 text-[var(--text-primary)]" />
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Country</span>
        </div>
        <div className="text-2xl text-[var(--text-primary)] font-bold">+</div>
        <div className="flex flex-col items-center gap-2">
          <div className="w-20 h-20 rounded-full bg-[var(--uscis-blue)]/15 flex items-center justify-center">
            <BuildingOffice2Icon className="w-10 h-10 text-[var(--text-primary)]" />
          </div>
          <span className="text-sm font-semibold text-[var(--text-primary)]">Service Center</span>
        </div>
      </div>
      <ArrowDownIcon className="w-6 h-6 text-[var(--text-primary)]" />
      <div className="px-4 py-2 bg-[var(--uscis-blue)]/10 border border-[var(--uscis-blue)]/30 rounded-lg">
        <div className="font-bold text-[var(--text-primary)] text-sm">Enhanced Accuracy</div>
        <div className="text-xs text-[var(--text-secondary)]">Most Precise Estimates</div>
      </div>
    </div>
  );
}

function ProfessionalTimelineChart({ appear }: { appear: boolean }) {
  const [barHeights, setBarHeights] = useState([0, 0, 0, 0, 0]);

  useEffect(() => {
    if (appear) {
      setTimeout(() => {
        setBarHeights([60, 80, 100, 95, 85]);
      }, 300);
    }
  }, [appear]);

  const months = ["Jan", "Mar", "May", "Jul", "Sep"];

  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-color)] max-w-md mx-auto">
      <div className="space-y-4">
        <div className="font-bold text-[var(--text-primary)]">Estimated Approval Timeline</div>
        <div className="h-px bg-[var(--border-color)]" />
        <div className="flex items-end justify-center gap-3 h-32">
          {months.map((month, index) => (
            <div key={index} className="flex flex-col items-center gap-1.5">
              <div
                className="w-8 bg-[var(--uscis-blue)] rounded transition-all duration-700 ease-out"
                style={{ height: `${barHeights[index]}%` }}
              />
              <span className="text-xs text-[var(--text-secondary)]">{month}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-[var(--text-secondary)] text-center">
          Based on historical processing data
        </div>
      </div>
    </div>
  );
}

function ProfessionalHelpResources({ appear }: { appear: boolean }) {
  const resources = [
    { Icon: BookOpenIcon, title: "Form Guides" },
    { Icon: QuestionMarkCircleIcon, title: "Help Center" },
    { Icon: UserGroupIcon, title: "Community" },
    { Icon: BellIcon, title: "Notifications" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
      {resources.map(({ Icon, title }, index) => (
        <div
          key={index}
          className={`bg-[var(--bg-secondary)] rounded-xl p-6 border border-[var(--border-color)] flex flex-col items-center gap-3 transition-all duration-500 ${
            appear ? "opacity-100 scale-100" : "opacity-0 scale-90"
          }`}
          style={{ transitionDelay: `${200 + index * 100}ms` }}
        >
          <Icon className="w-8 h-8 text-[var(--text-primary)]" />
          <span className="text-sm font-semibold text-[var(--text-primary)]">{title}</span>
        </div>
      ))}
    </div>
  );
}

function PageInfoCard({
  Icon,
  title,
  subtitle,
  appear,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  appear: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-4 p-5 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] transition-all duration-700 ${
        appear ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
      }`}
      style={{ transitionDelay: "100ms" }}
    >
      <div className="w-14 h-14 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-7 h-7 text-[var(--text-primary)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-[var(--text-primary)] text-lg">{title}</div>
        <div className="text-sm text-[var(--text-secondary)]">{subtitle}</div>
      </div>
    </div>
  );
}
