"use client";

import React, { useEffect } from "react";
import { ChartBarIcon } from "@heroicons/react/24/outline";
import { LockClosedIcon } from "@heroicons/react/24/solid";
import Link from "next/link";
import { useSubscription } from "@/hooks/useSubscription";
import { analytics } from "@/lib/analytics";
import TodaysUpdateSection from "@/components/stats/TodaysUpdateSection";
import MoreCasesApprovedThisMonthSection from "@/components/stats/MoreCasesApprovedThisMonthSection";
import WeeklyApprovalBreakdownSection from "@/components/stats/WeeklyApprovalBreakdownSection";
import ApprovalTrendsI130Section from "@/components/stats/ApprovalTrendsI130Section";
import ProcessingTimeI130Section from "@/components/stats/ProcessingTimeI130Section";
import I129FApprovalTrendsSection from "@/components/stats/I129FApprovalTrendsSection";
import ProcessingTimeI129FSection from "@/components/stats/ProcessingTimeI129FSection";
import QuietOfficesSection from "@/components/stats/QuietOfficesSection";
import MostActiveCentersSection from "@/components/stats/MostActiveCentersSection";
import ProcessingSpeedTrendSection from "@/components/stats/ProcessingSpeedTrendSection";
import PeakApprovalDaysSection from "@/components/stats/PeakApprovalDaysSection";
import WhereYouStandSection from "@/components/stats/WhereYouStandSection";
import UpcomingApprovalsSection from "@/components/stats/UpcomingApprovalsSection";
import PredictiveInsightsSection from "@/components/stats/PredictiveInsightsSection";
import ApprovalCountdownTimer from "@/components/stats/ApprovalCountdownTimer";
import USCISBacklogSection from "@/components/stats/USCISBacklogSection";
import ProcessingTimeTrendByMonthSection from "@/components/stats/ProcessingTimeTrendByMonthSection";
import CasesAddedPerDateSection from "@/components/stats/CasesAddedPerDateSection";
import CumulativeApprovalsCurveSection from "@/components/stats/CumulativeApprovalsCurveSection";
import ProcessingTimeHistogramSection from "@/components/stats/ProcessingTimeHistogramSection";
import EmbassySpotlightSection from "@/components/stats/EmbassySpotlightSection";
import FormTypeDistributionDonutSection from "@/components/stats/FormTypeDistributionDonutSection";
import ApprovalHeatmapSection from "@/components/stats/ApprovalHeatmapSection";
import ApprovalsByPriorityDateChartSection from "@/components/stats/ApprovalsByPriorityDateChartSection";
import SkeletonLoader from "@/components/SkeletonLoader";
import ContextualHelp from "@/components/ContextualHelp";
import CardContainer from "@/components/CardContainer";

export default function StatsPage() {
  const { isSubscribed, loading: subscriptionLoading } = useSubscription();
  
  useEffect(() => {
    analytics.statsPageViewed();
  }, []);

  // Show paywall if not subscribed — Apple-style, impactful gated design
  if (!subscriptionLoading && !isSubscribed) {
    return (
      <div className="min-h-screen bg-[var(--bg-surface-alt)] overflow-x-hidden min-w-0">
        {/* Stats strip — Apple-style refined metrics */}
        <section className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-6 sm:pt-8 relative z-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: "Today", value: "142", sub: "approvals" },
              { label: "This Week", value: "998", sub: "total" },
              { label: "Avg Days", value: "422", sub: "processing" },
              { label: "Centers", value: "4", sub: "active" },
            ].map((stat, i) => (
              <div
                key={i}
                className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]/60 shadow-lg shadow-black/5 p-5 sm:p-6 backdrop-blur-xl relative overflow-hidden group hover:shadow-xl hover:shadow-black/6 transition-shadow"
              >
                <p className="text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-widest mb-1">
                  {stat.label}
                </p>
                <p className={`text-2xl sm:text-3xl font-semibold tracking-tight tabular-nums text-[var(--text-primary)]`}>
                  {stat.value}
                </p>
                <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Preview cards — blurred / locked feel, Apple refinement */}
        <main className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 pt-4 sm:pt-6 pb-10 sm:pb-14">
          <div className="space-y-4 sm:space-y-5">
            {/* Where You Stand — Apple-style charts */}
            <div className="rounded-2xl bg-[var(--bg-surface)]/95 border border-[var(--border-color)]/60 shadow-sm overflow-hidden backdrop-blur-sm">
              <div className="p-5 sm:p-6">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Where You Stand</h3>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--uscis-blue)]/10 border border-[var(--uscis-blue)]/20">
                    <LockClosedIcon className="w-4 h-4 text-[var(--text-primary)]" />
                    <span className="text-xs font-semibold text-[var(--text-primary)]">Pro</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Percentile ring — Apple Watch style */}
                  <div className="p-5 rounded-2xl bg-gradient-to-br from-[var(--bg-surface-alt)]/80 to-[var(--bg-surface)] border border-[var(--border-color)]/40">
                    <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Your Percentile</p>
                    <div className="relative w-24 h-24 mx-auto mb-2">
                      <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--border-color)" strokeWidth="2.5" opacity={0.3} />
                        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="url(#percentileGrad)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="65, 100" strokeDashoffset="0" />
                        <defs><linearGradient id="percentileGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="var(--uscis-blue)" /><stop offset="100%" stopColor="#6366f1" /></linearGradient></defs>
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-[var(--text-primary)]">—</span>
                    </div>
                    <p className="text-center text-xs text-[var(--text-tertiary)]">Unlock to see</p>
                  </div>
                  {/* Area chart — approvals trend */}
                  <div className="lg:col-span-2 p-5 rounded-2xl bg-gradient-to-br from-[var(--bg-surface-alt)]/80 to-[var(--bg-surface)] border border-[var(--border-color)]/40">
                    <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-3">Approvals trend (7 days)</p>
                    <div className="h-20 sm:h-24 w-full">
                      <svg viewBox="0 0 280 80" preserveAspectRatio="none" className="w-full h-full">
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="1" x2="0" y2="0">
                            <stop offset="0%" stopColor="var(--uscis-blue)" stopOpacity={0} />
                            <stop offset="100%" stopColor="var(--uscis-blue)" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <path d="M0,60 L40,55 L80,45 L120,50 L160,30 L200,35 L240,25 L280,20 L280,80 L0,80 Z" fill="url(#areaGrad)" />
                        <path d="M0,60 L40,55 L80,45 L120,50 L160,30 L200,35 L240,25 L280,20" fill="none" stroke="var(--uscis-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
                      </svg>
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-[var(--text-tertiary)]">
                      <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                  {[
                    { label: "Timeline Range", value: "— days" },
                    { label: "Est. Approval", value: "—" },
                    { label: "Queue Position", value: "—" },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-[var(--bg-surface-alt)]/60 border border-[var(--border-color)]/40">
                      <p className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-1">{item.label}</p>
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Two-column: Activity + Processing — Apple-style bar charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
              <div className="rounded-2xl bg-[var(--bg-surface)]/95 border border-[var(--border-color)]/60 shadow-sm p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Recent Activity</h3>
                  <LockClosedIcon className="w-4 h-4 text-[var(--text-primary)]/70" />
                </div>
                <div className="space-y-3">
                  {[
                    { day: "Mon", val: 142, pct: 100 },
                    { day: "Tue", val: 128, pct: 90 },
                    { day: "Wed", val: 135, pct: 95 },
                    { day: "Thu", val: 119, pct: 84 },
                    { day: "Fri", val: 132, pct: 93 },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-[var(--text-secondary)] w-8">{item.day}</span>
                      <div className="flex-1 h-6 rounded-lg bg-[var(--bg-surface-alt)]/60 overflow-hidden">
                        <div
                          className="h-full rounded-lg bg-gradient-to-r from-[var(--uscis-blue)]/40 to-[var(--uscis-blue)]/25 transition-all duration-500"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-tertiary)] tabular-nums w-8">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl bg-[var(--bg-surface)]/95 border border-[var(--border-color)]/60 shadow-sm p-5 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Processing Times</h3>
                  <LockClosedIcon className="w-4 h-4 text-[var(--text-primary)]/70" />
                </div>
                <div className="space-y-4">
                  {[
                    { form: "I-130", pct: 75, days: "—" },
                    { form: "I-129F", pct: 68, days: "—" },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-[var(--bg-surface-alt)]/60 border border-[var(--border-color)]/40">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-[var(--text-primary)]">{item.form}</span>
                        <span className="text-sm font-semibold text-[var(--text-primary)]/60">{item.days} days</span>
                      </div>
                      <div className="h-2 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--uscis-blue)] to-indigo-500"
                          style={{ width: `${item.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Hero CTA — Apple-style soft gradient */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0f172a] via-[#1e3a5f] to-[#0f172a] p-8 sm:p-10 lg:p-12 shadow-2xl shadow-[#0f172a]/30 border border-white/10">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_120%,rgba(255,255,255,0.1),transparent)]" aria-hidden />
              <div className="relative text-center max-w-2xl mx-auto" style={{ color: "#ffffff" }}>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight mb-3" style={{ color: "#ffffff" }}>
                  Unlock your full statistics
                </h2>
                <p className="text-base sm:text-lg leading-relaxed mb-6" style={{ color: "#ffffff" }}>
                  Percentile rankings, timeline estimates, and real-time tracking—powered by your case details and live USCIS data.
                </p>
                <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mb-8 text-sm" style={{ color: "#ffffff" }}>
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#ffffff" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Your percentile
                  </span>
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#ffffff" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                    Speed trends
                  </span>
                  <span className="flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: "#ffffff" }}>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Countdown & range
                  </span>
                </div>
                <Link
                  href="/subscribe"
                  className="inline-flex items-center justify-center gap-3 min-h-[52px] px-8 py-4 bg-white text-[var(--text-primary)] rounded-2xl font-semibold text-base shadow-xl hover:shadow-2xl hover:shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all duration-300"
                >
                  Start 3-day free trial
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <p className="mt-5 text-sm" style={{ color: "#ffffff" }}>
                  No credit card required · Cancel anytime
                </p>
              </div>
            </div>

            {/* Top Centers — donut-style distribution */}
            <div className="rounded-2xl bg-[var(--bg-surface)]/95 border border-[var(--border-color)]/60 shadow-sm p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">Top Service Centers</h3>
                <LockClosedIcon className="w-4 h-4 text-[var(--text-primary)]/70" />
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="relative w-28 h-28 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-28 h-28 -rotate-90">
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--uscis-blue)" strokeWidth="3" strokeDasharray="45, 100" strokeDashoffset="0" opacity={0.8} />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#6366f1" strokeWidth="3" strokeDasharray="30, 100" strokeDashoffset="-45" opacity={0.7} />
                    <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#8b5cf6" strokeWidth="3" strokeDasharray="25, 100" strokeDashoffset="-75" opacity={0.6} />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-[var(--text-primary)]">4</span>
                </div>
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  {[
                    { name: "Texas", pct: 45, color: "var(--uscis-blue)" },
                    { name: "California", pct: 30, color: "#6366f1" },
                    { name: "Nebraska", pct: 25, color: "#8b5cf6" },
                  ].map((c, i) => (
                    <div key={c.name} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-surface-alt)]/60 border border-[var(--border-color)]/40">
                      <span className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: c.color, opacity: 0.8 }} />
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{c.name}</p>
                        <p className="text-[10px] text-[var(--text-tertiary)]">{c.pct}% of approvals</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] overflow-x-hidden min-w-0">
      <CardContainer className="py-3 sm:py-6 lg:py-8 overflow-x-hidden w-full min-w-0">
        <div className="space-y-3 sm:space-y-5 w-full min-w-0 text-[11px] sm:text-sm">
          {/* Where you stand - cleaner card like home */}
          <div className="w-full min-w-0">
            <div className="rounded-2xl card-see-through border border-[var(--border-color)]/50 bg-[var(--bg-surface)]/98 backdrop-blur-sm p-4 sm:p-6 w-full min-w-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
              <div className="pl-1">
                <p className="text-[9px] sm:text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">
                  Personal overview
                </p>
                <h2 className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)] mb-1 sm:mb-1.5">
                  Where you stand
                </h2>
                <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">
                  Your case in context—percentile, timeline range, and how you compare to recent approvals.
                </p>
                <p className="mt-1 text-[10px] sm:text-xs text-[var(--text-tertiary)]">
                  We blend your priority date, service center, and live approval data into a single, easy read on your position.
                </p>
              </div>
                <div className="space-y-4">
                  <WhereYouStandSection />

                  <div className="px-3 py-2 rounded-lg bg-[var(--bg-surface-alt)] border border-dashed border-[var(--border-color)] text-[11px] sm:text-xs text-[var(--text-secondary)] flex items-center gap-2">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[var(--uscis-blue)]/10 text-[var(--text-primary)] text-xs font-semibold">
                      i
                    </span>
                    <span className="leading-snug">
                      Estimates use your profile, similar cases, and current pace. They update as new approval data arrives.
                    </span>
                  </div>

                  <ApprovalCountdownTimer />
                </div>
              </div>
          </div>

          {/* Single-column layout — avoids empty space when columns differ in height */}
          <div className="flex flex-col gap-3 sm:gap-5 min-w-0">
            <div className="space-y-3 sm:space-y-5 min-w-0">
              {/* 2. Your Progress */}
              <div className="rounded-2xl card-see-through border border-[var(--border-color)]/50 bg-[var(--bg-surface)]/98 backdrop-blur-sm p-4 sm:p-6 w-full min-w-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
                <div className="pl-1">
                  <p className="text-[9px] sm:text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">
                    Timeline guidance
                  </p>
                  <h2 className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)] mb-1 sm:mb-1.5">
                    Your progress
                  </h2>
                  <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">
                    Plain-language summaries of your timeline and what to expect next.
                  </p>
                  <p className="mt-1 text-[10px] sm:text-xs text-[var(--text-tertiary)]">
                    See how far you’ve come, what milestone is next, and how much movement we’re seeing around your priority date.
                  </p>
                </div>
                <div className="space-y-2 sm:space-y-4">
                  <PredictiveInsightsSection />
                  <UpcomingApprovalsSection />
                </div>
              </div>

              {/* 2b. Cases like yours — moved up for better visibility */}
              <div className="rounded-2xl card-see-through border border-[var(--border-color)]/50 bg-[var(--bg-surface)]/98 backdrop-blur-sm p-4 sm:p-6 w-full min-w-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
                <div className="pl-1">
                  <p className="text-[9px] sm:text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">
                    Similar cases
                  </p>
                  <h2 className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)] mb-1 sm:mb-1.5">
                    Cases like yours
                  </h2>
                  <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">
                    How similar cases and service centers are performing—context without the guesswork.
                  </p>
                  <p className="mt-1 text-[10px] sm:text-xs text-[var(--text-tertiary)]">
                    Track patterns by day, week, and office so you can see if approvals around you are heating up or slowing down.
                  </p>
                </div>
                <div className="space-y-2 sm:space-y-4">
                  <ApprovalHeatmapSection />
                  <QuietOfficesSection />
                  <MostActiveCentersSection />
                  <ProcessingSpeedTrendSection />
                  <PeakApprovalDaysSection />
                </div>
              </div>

              {/* 3. System Activity */}
              <div className="rounded-2xl card-see-through border border-[var(--border-color)]/50 bg-[var(--bg-surface)]/98 backdrop-blur-sm p-4 sm:p-6 w-full min-w-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
                <div className="pl-1">
                  <p className="text-[9px] sm:text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">
                    System patterns
                  </p>
                  <h2 className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)] mb-1 sm:mb-1.5">
                    System activity
                  </h2>
                  <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">
                    Daily and weekly patterns—how many cases are moving and when.
                  </p>
                  <p className="mt-1 text-[10px] sm:text-xs text-[var(--text-tertiary)]">
                    Zoom out to see the bigger flow of approvals so today’s status checks make sense in the context of the week.
                  </p>
                </div>
                <div className="space-y-2 sm:space-y-4">
                  <CumulativeApprovalsCurveSection />
                  <ApprovalsByPriorityDateChartSection />
                  <WeeklyApprovalBreakdownSection />
                  <CasesAddedPerDateSection />
                  <FormTypeDistributionDonutSection />
                  <EmbassySpotlightSection />
                </div>
              </div>

              {/* 4. Recent activity */}
              <div className="rounded-2xl card-see-through border border-[var(--border-color)]/50 bg-[var(--bg-surface)]/98 backdrop-blur-sm p-4 sm:p-6 w-full min-w-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
                <div className="pl-1">
                  <p className="text-[9px] sm:text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">
                    Recent approvals
                  </p>
                  <h2 className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)] mb-1 sm:mb-1.5">
                    Recent activity
                  </h2>
                  <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">
                    How busy processing has been lately. More approvals some days is normal—quiet days don’t mean something’s wrong.
                  </p>
                  <p className="mt-1 text-[10px] sm:text-xs text-[var(--text-tertiary)]">
                    See today, this week, and this month side by side so you can feel the current pace instead of guessing from one update.
                  </p>
                </div>
                <div className="space-y-3 sm:space-y-4">
                  <TodaysUpdateSection />
                  <MoreCasesApprovedThisMonthSection />

                  {/* Advanced Trend Analysis Card */}
                  <div className="rounded-xl card-see-through border border-[var(--border-color)]/50 p-4 overflow-hidden w-full min-w-0">
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--uscis-blue)]/20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)]">
                            Week-Over-Week Trend Analysis
                          </h3>
                          <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5">
                            Compare recent approval patterns to identify acceleration or slowdowns
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 space-y-3 sm:space-y-4 min-w-0 -mt-1">
                      {/* Trend Comparison */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                        <div className="p-2.5 sm:p-3 rounded-lg bg-[var(--bg-surface-alt)]/50 border border-[var(--border-color)]/50">
                          <p className="text-[10px] sm:text-xs font-semibold text-[var(--text-secondary)] mb-0.5">
                            This Week
                          </p>
                          <p className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-0.5">
                            142
                          </p>
                          <p className="text-[10px] text-[var(--text-tertiary)]">
                            approvals processed
                          </p>
                        </div>
                        <div className="p-2.5 sm:p-3 rounded-lg bg-[var(--bg-surface-alt)]/50 border border-[var(--border-color)]/50">
                          <p className="text-[10px] sm:text-xs font-semibold text-[var(--text-secondary)] mb-0.5">
                            Last Week
                          </p>
                          <p className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-0.5">
                            128
                          </p>
                          <p className="text-[10px] text-[var(--text-tertiary)]">
                            approvals processed
                          </p>
                        </div>
                      </div>

                      {/* Trend Indicator */}
                      <div className="p-2.5 sm:p-3 rounded-lg bg-[var(--bg-surface-alt)]/50">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)]">
                              +10.9% increase this week
                            </p>
                            <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5">
                              Processing velocity is accelerating compared to last week
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Velocity Metrics */}
                      <div className="pt-2 sm:pt-3 border-t border-[var(--border-color)]">
                        <p className="text-[10px] sm:text-xs font-semibold text-[var(--text-secondary)] mb-2">
                          Processing Velocity
                        </p>
                        <div className="space-y-2">
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] sm:text-xs text-[var(--text-secondary)]">Daily average</span>
                              <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">20.3/day</span>
                            </div>
                            <div className="h-2 rounded-full bg-[var(--bg-surface-alt)] overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full" style={{ width: "85%" }} />
                            </div>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[10px] sm:text-xs text-[var(--text-secondary)]">Peak day this week</span>
                              <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)]">32 approvals</span>
                            </div>
                            <div className="h-2 rounded-full bg-[var(--bg-surface-alt)] overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-400 to-indigo-600 rounded-full" style={{ width: "100%" }} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Service Center Performance Comparison */}
                  <div className="rounded-xl card-see-through border border-[var(--border-color)]/50 p-4 overflow-hidden w-full min-w-0">
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--uscis-blue)]/20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)]">
                            Service Center Performance
                          </h3>
                          <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5">
                            Top 3 centers by recent approval volume and speed
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 space-y-2 sm:space-y-3 -mt-1">
                      {[
                        { name: "Texas", approvals: 31, avgDays: 455, trend: "+5%" },
                        { name: "California", approvals: 29, avgDays: 480, trend: "+2%" },
                        { name: "Nebraska", approvals: 15, avgDays: 420, trend: "-3%" },
                      ].map((center, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                                {idx + 1}
                              </div>
                              <div>
                                <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">{center.name}</p>
                                <p className="text-[10px] text-[var(--text-tertiary)]">{center.avgDays}d avg processing</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm sm:text-base font-bold text-[var(--text-primary)]">{center.approvals}</p>
                              <p className="text-[10px] text-[var(--text-tertiary)]">approvals</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-surface)] overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-full"
                                style={{ width: `${(center.approvals / 31) * 100}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-semibold ${center.trend.startsWith('+') ? 'text-green-600' : 'text-indigo-600'}`}>
                              {center.trend}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Processing Efficiency Metrics */}
                  <div className="rounded-xl card-see-through border border-[var(--border-color)]/50 p-4 overflow-hidden w-full min-w-0">
                    <div className="p-3 sm:p-4">
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className="w-8 h-8 rounded-lg bg-[var(--uscis-blue)]/20 flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)]">
                            Processing Efficiency Metrics
                          </h3>
                          <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5">
                            Key performance indicators for case processing speed and throughput
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="px-3 pb-3 sm:px-4 sm:pb-4 pt-0 min-w-0 -mt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 mb-3">
                        <div className="p-2.5 sm:p-3 rounded-lg bg-[var(--bg-surface-alt)]/50 border border-[var(--border-color)]/50">
                          <p className="text-[10px] sm:text-xs font-semibold text-[var(--text-secondary)] mb-0.5">
                            Cases/Day Rate
                          </p>
                          <p className="text-base sm:text-lg font-bold text-[var(--text-primary)]">20.3</p>
                          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">avg per day</p>
                        </div>
                        <div className="p-2.5 sm:p-3 rounded-lg bg-[var(--bg-surface-alt)]/50 border border-[var(--border-color)]/50">
                          <p className="text-[10px] sm:text-xs font-semibold text-[var(--text-secondary)] mb-0.5">
                            Throughput Score
                          </p>
                          <p className="text-base sm:text-lg font-bold text-[var(--text-primary)]">87%</p>
                          <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">of capacity</p>
                        </div>
                      </div>

                      {/* Efficiency Breakdown */}
                      <div className="space-y-2 pt-3 border-t border-[var(--border-color)]">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] sm:text-xs text-[var(--text-secondary)]">Fastest processing window</span>
                          <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">Mon-Thu</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] sm:text-xs text-[var(--text-secondary)]">Peak approval hours</span>
                          <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">10 AM - 2 PM EST</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] sm:text-xs text-[var(--text-secondary)]">Average case resolution</span>
                          <span className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">422 days</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Processing Times (merged — includes Processing Time Trend by Month) */}
            <div className="space-y-3 sm:space-y-5 min-w-0">
              <div className="rounded-2xl card-see-through border border-[var(--border-color)]/50 bg-[var(--bg-surface)]/98 backdrop-blur-sm p-4 sm:p-6 w-full min-w-0 overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
                <div className="pl-1">
                  <p className="text-[9px] sm:text-[10px] font-semibold text-[var(--text-tertiary)] uppercase tracking-wide mb-0.5">
                    Historical timing
                  </p>
                  <h2 className="text-[11px] sm:text-sm font-semibold text-[var(--text-primary)] mb-1 sm:mb-1.5">
                    Processing times
                  </h2>
                  <p className="text-[11px] sm:text-sm text-[var(--text-secondary)]">
                    How long I-130 and I-129F cases have actually taken—ranges and trends from completed cases.
                  </p>
                  <p className="mt-1 text-[10px] sm:text-xs text-[var(--text-tertiary)]">
                    Compare fastest, slowest, and typical waits over time so your own estimate sits in a clear, honest range.
                  </p>
                </div>
                <div className="space-y-2 sm:space-y-4">
                  <ProcessingTimeTrendByMonthSection />
                  <ApprovalTrendsI130Section />
                  <ProcessingTimeI130Section />
                  <I129FApprovalTrendsSection />
                  <ProcessingTimeI129FSection />
                  <ProcessingTimeHistogramSection />
                </div>
              </div>
            </div>
          </div>

          {/* USCIS Backlog */}
          <div className="w-full min-w-0">
            <USCISBacklogSection />
          </div>
        </div>
      </CardContainer>
    </div>
  );
}
