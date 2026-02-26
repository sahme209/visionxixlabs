"use client";

import React, { useState, useEffect } from "react";
import PauseStatusTracker from "./PauseStatusTracker";
import PersonalImpactCalculator from "./PersonalImpactCalculator";
import NeighborCaseTracking from "./NeighborCaseTracking";
import RecoveryPredictions from "./RecoveryPredictions";
import EmbassyInsights from "./EmbassyInsights";
import ClinicVRubioCase from "./ClinicVRubioCase";
import RedditPauseFeed from "./RedditPauseFeed";
import { PersonalImpactService, PersonalImpact } from "@/lib/services/personalImpactService";
import { RecoveryAnalysisService } from "@/lib/services/recoveryAnalysisService";
import { VisaPauseService, RecoveryMetrics } from "@/lib/services/visaPauseService";
import { format } from "date-fns";

interface VisaPauseImpactCenterProps {
  formType: string;
  priorityDate: Date;
  country: string;
}

function getClampedRecoveryEstimate(metrics: RecoveryMetrics): Date | null {
  const now = new Date();

  if (metrics.recoveryRate >= 95) {
    return now;
  } else if (metrics.weeklyChange <= 0) {
    // No clear improvement yet – keep within a 6–36 month band
    const monthsRemaining = Math.max(6, Math.min(36, Math.ceil((100 - metrics.recoveryRate) / 4)));
    const d = new Date(now);
    d.setMonth(d.getMonth() + monthsRemaining);
    return d;
  } else {
    // Use a bounded weeks-to-full formula based on current trend
    const weeklyStep = Math.max(metrics.weeklyChange, 0.5);
    const rawWeeksToFull = (100 - metrics.recoveryRate) / weeklyStep;
    const clampedWeeks = Math.max(4, Math.min(156, rawWeeksToFull)); // 1–36 months
    const d = new Date(now);
    d.setDate(d.getDate() + Math.round(clampedWeeks * 7));
    return d;
  }
}

export default function VisaPauseImpactCenter({
  formType,
  priorityDate,
  country,
}: VisaPauseImpactCenterProps) {
  const [impact, setImpact] = useState<PersonalImpact | null>(null);
  const [recoveryMetrics, setRecoveryMetrics] = useState<RecoveryMetrics | null>(null);
  const [catchUp, setCatchUp] = useState<{
    estimatedDate: Date;
    monthsRemaining: number;
    confidence: "high" | "medium" | "low";
  } | null>(null);

  useEffect(() => {
    async function loadImpact() {
      try {
        const result = await PersonalImpactService.calculatePersonalImpact(
          formType,
          priorityDate,
          country
        );
        setImpact(result);
      } catch (error) {
        console.error("Error loading impact:", error);
      }
    }
    loadImpact();
  }, [formType, priorityDate, country]);

  useEffect(() => {
    async function loadRecoveryMetrics() {
      try {
        const metrics = await VisaPauseService.getRecoveryMetrics();
        setRecoveryMetrics(metrics);
      } catch (error) {
        console.error("Error loading recovery metrics:", error);
      }
    }
    loadRecoveryMetrics();
  }, []);

  useEffect(() => {
    async function loadCatchUp() {
      try {
        const result = await RecoveryAnalysisService.estimateCatchUpTimeline();
        setCatchUp(result);
      } catch (error) {
        console.error("Error loading catch-up timeline:", error);
      }
    }
    loadCatchUp();
  }, []);

  return (
    <div className="space-y-6">
      <ClinicVRubioCase />
      <RedditPauseFeed />
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm overflow-hidden">
        <div className="surface-dark relative px-4 sm:px-6 md:px-8 py-4 sm:py-6 md:py-7 bg-[var(--hero-dark)] border-b border-white/10">
          <div className="h-0.5 bg-gradient-to-r from-white/30 via-white/10 to-white/30 absolute top-0 left-0 right-0" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.05] rounded-2xl" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "20px 20px" }} aria-hidden />
          <div className="relative flex flex-col gap-4 sm:gap-6 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-white/15 border border-white/25 flex-shrink-0">
                <svg className="h-5 w-5 sm:h-6 sm:w-6 text-[var(--icon)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-xl font-bold mb-1">Your impact at a glance</h2>
                <p className="text-sm leading-relaxed max-w-xl">
                  For <span className="font-semibold">{country}</span>: how much the pause delays you, your new projected date, and when recovery may pull it forward.
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/12 border border-white/20 text-xs font-semibold">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                    Recovery model
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white/8 border border-white/15 text-xs font-semibold">Pro</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full md:max-w-md">
              {impact ? (
                <>
                  <div className="rounded-lg sm:rounded-xl bg-white/12 border border-white/25 px-2 sm:px-4 py-2 sm:py-3">
                    <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-wider mb-0.5 text-[var(--mutedFg)]">Delay</p>
                    <p className="text-sm sm:text-xl font-bold">{impact.delayDays >= 0 ? `${impact.delayDays} days` : "None"}</p>
                  </div>
                  <div className="rounded-lg sm:rounded-xl bg-white/12 border border-white/25 px-2 sm:px-4 py-2 sm:py-3">
                    <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-wider mb-0.5 text-[var(--mutedFg)]">Impact</p>
                    <p className="text-sm sm:text-xl font-bold">{impact.impactPercentage.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg sm:rounded-xl bg-white/12 border border-white/25 px-2 sm:px-4 py-2 sm:py-3">
                    <p className="text-[9px] sm:text-xs font-semibold uppercase tracking-wider mb-0.5 text-[var(--mutedFg)]">Approval</p>
                    <p className="text-[10px] sm:text-base font-bold leading-tight">{format(impact.currentEstimate, "MMM d")}</p>
                  </div>
                </>
              ) : (
                <div className="col-span-1 sm:col-span-3 rounded-lg bg-white/5 border border-white/15 px-3 py-2.5 flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs text-[var(--mutedFg)]">Calibrating for your case…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <PauseStatusTracker country={country} />
          <PersonalImpactCalculator
            formType={formType}
            priorityDate={priorityDate}
            country={country}
          />
          {impact && (
            <RecoveryPredictions
              priorityDate={priorityDate}
              estimatedApprovalDate={impact.currentEstimate}
              country={country}
            />
          )}
        </div>

        <div className="space-y-6">
          <NeighborCaseTracking priorityDate={priorityDate} country={country} />
          {recoveryMetrics && (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">When will the pause end?</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {getClampedRecoveryEstimate(recoveryMetrics) && (
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-3">
                    <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mb-0.5">Est. full recovery</p>
                    <p className="text-base font-bold text-[var(--text-primary)]">
                      {format(getClampedRecoveryEstimate(recoveryMetrics)!, "MMM yyyy")}
                    </p>
                  </div>
                )}
                <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-3">
                  <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mb-0.5">Days since pause</p>
                  <p className="text-base font-bold text-[var(--text-primary)]">{recoveryMetrics.daysSincePause}</p>
                </div>
                <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-3">
                  <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mb-0.5">Current recovery</p>
                  <p className="text-base font-bold text-[var(--text-primary)]">{recoveryMetrics.recoveryRate}%</p>
                </div>
                <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-3">
                  <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mb-0.5">Weekly change</p>
                  <p className={`text-base font-bold ${recoveryMetrics.weeklyChange >= 0 ? "text-green-600" : "text-[var(--text-primary)]"}`}>
                    {recoveryMetrics.weeklyChange >= 0 ? "+" : ""}{recoveryMetrics.weeklyChange}%
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-3">
                  <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mb-0.5">Approvals/day</p>
                  <p className="text-base font-bold text-[var(--text-primary)]">~{recoveryMetrics.processingVelocity}</p>
                </div>
              </div>
              <p className="text-xs text-[var(--text-tertiary)] mt-3">
                Based on Firestore I-130 approval data. Recovery can accelerate as processing increases.
              </p>
            </div>
          )}
          <EmbassyInsights country={country} />
          {catchUp && (
            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm">
              <h3 className="text-lg font-bold text-[var(--text-primary)] mb-3">When the system catches up</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-[var(--text-secondary)] mb-0.5">Back to pre-pause speed (est.)</p>
                  <p className="text-base font-bold text-[var(--text-primary)]">{format(catchUp.estimatedDate, "MMM yyyy")}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-2.5">
                    <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mb-0.5">Months left</p>
                    <p className="text-lg font-bold text-[var(--text-primary)]">{catchUp.monthsRemaining}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-2.5">
                    <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mb-0.5">Confidence</p>
                    <p className="text-sm font-semibold text-[var(--text-primary)] capitalize">{catchUp.confidence}</p>
                  </div>
                </div>
                <p className="text-xs text-[var(--text-tertiary)]">
                  Based on current recovery speed. As approvals pick up, this date can move closer.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {impact && (
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm">
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-3">Your timeline at a glance</h3>
          <div className="flex flex-wrap gap-4 sm:gap-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--text-tertiary)]" />
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Original</p>
                <p className="text-sm font-bold text-[var(--text-primary)]">{format(impact.originalEstimate, "MMM d, yyyy")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--uscis-blue)]" />
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">With pause</p>
                <p className="text-sm font-bold text-[var(--text-primary)]">{format(impact.currentEstimate, "MMM d, yyyy")}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-2 h-2 rounded-full bg-green-600" />
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">Recovery-adjusted</p>
                <p className="text-sm font-bold text-green-700 dark:text-green-400">{format(impact.recoveryAdjustedEstimate, "MMM d, yyyy")}</p>
              </div>
            </div>
          </div>
          <p className="text-xs text-[var(--text-tertiary)] mt-3">Plan around the recovery-adjusted date. As the system catches up, it may move earlier.</p>
        </div>
      )}

      {impact && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-4">What the pause means for you</h3>
            <div className="space-y-4">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-3xl sm:text-4xl font-bold text-[var(--text-primary)]">{impact.impactPercentage.toFixed(1)}</span>
                <span className="text-sm text-[var(--text-secondary)]">/ 100 impact score</span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-[var(--bg-surface-alt)] overflow-hidden border border-[var(--border-color)]">
                <div
                  className="h-full bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, impact.impactPercentage))}%` }}
                />
              </div>
              <p className="text-xs text-[var(--text-tertiary)]">Higher = the pause shifted your timeline more. The score combines delay days with your position in the queue—applicants further out typically see a smaller percentage impact than those close to approval when the freeze began. A score over 50 means the pause has materially extended your wait.</p>
            </div>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-5 sm:p-6 shadow-sm">
            <h3 className="text-lg font-bold text-[var(--text-primary)] mb-2">Next steps</h3>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Delay: <span className="font-semibold text-[var(--text-primary)]">{impact.delayDays >= 0 ? `${impact.delayDays} days` : "none"}</span>. Plan around the recovery-adjusted date.
            </p>
            <ul className="space-y-2 text-sm text-[var(--text-secondary)]">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--uscis-blue)] flex-shrink-0" />
                <span>Use the <strong className="text-[var(--text-primary)]">recovery-adjusted date</strong> for travel, work, and family planning. Avoid locking in non-refundable plans on the optimistic date alone.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--uscis-blue)] flex-shrink-0" />
                <span>Follow <strong className="text-[var(--text-primary)]">CLINIC v. Rubio</strong>—the lawsuit could result in a preliminary injunction or policy change that restores visa processing.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--uscis-blue)] flex-shrink-0" />
                <span>If delay is <strong className="text-[var(--text-primary)]">90+ days</strong>, consider talking to an attorney about mandamus, expedite, or congressional inquiry.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--uscis-blue)] flex-shrink-0" />
                <span>Watch the <strong className="text-[var(--text-primary)]">Pause Status</strong> card—faster recovery can move your date earlier. Check periodically for updates.</span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[var(--uscis-blue)] flex-shrink-0" />
                <span>Keep documents current—police certificates, medical exams, and affidavits have validity periods. Renew as needed so you&apos;re ready when the pause lifts.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface-alt)] px-4 py-4 text-center space-y-2">
        <p className="text-xs text-[var(--text-tertiary)]">
          Estimates use public State Dept–style pause data and recovery patterns from Firestore approval records. Not official government timelines. For official status, check your case with the consulate or NVC.
        </p>
        <p className="text-xs text-[var(--text-tertiary)]">
          The visa pause affects immigrant visas (not nonimmigrant visas like B1/B2, H1B, or F1). It applies to nationals of 75 countries regardless of where they reside. The CLINIC v. Rubio lawsuit seeks to overturn this policy.
        </p>
      </div>
    </div>
  );
}
