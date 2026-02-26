"use client";

import React, { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/contexts/AuthContext";
import { 
  getProcessingTimeDistribution, 
  getMedianProcessingTimeByServiceCenter,
  getApprovalOdds, 
  getTimelineEstimate, 
  getQueuePosition, 
  getNeighborComparison 
} from "@/lib/statsService";
import { format, addDays, differenceInDays } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";

interface YourStandingData {
  caseAge: number;
  typicalCaseAge: number;
  percentile: number;
  status: "ahead" | "on-track" | "behind";
  message: string;
  comparisonDetails: string;
  approvalOdds?: {
    approved: number;
    rfe: number;
    denied: number;
    sampleSize: number;
    confidence: string;
    approvalByServiceCenter?: Array<{
      serviceCenter: string;
      approved: number;
      rfe: number;
      denied: number;
      sampleSize: number;
    }>;
    approvalByCountry?: Array<{
      country: string;
      approved: number;
      rfe: number;
      denied: number;
      sampleSize: number;
    }>;
  };
  timelineEstimate?: {
    earliest: Date;
    latest: Date;
    median: Date;
    confidence: string;
    method: string;
  };
  queuePosition?: {
    positionRank: number;
    totalTracked: number;
    percentile: number;
    casesAhead: number;
    isInRange: boolean;
  };
  neighborComparison?: {
    totalNeighbors: number;
    approvedCount: number;
    processingCount: number;
    rfeCount: number;
    distribution: Array<{ status: string; count: number; percentage: number }>;
  };
}

export default function WhereYouStandSection() {
  const { profile } = useProfile();
  const { user } = useAuth();
  const [data, setData] = useState<YourStandingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      // For I-129F, we need noa1Date; for I-130, we need priorityDate
      const isI129F = profile?.formType === "I-129F";
      const hasRequiredDate = isI129F 
        ? ((profile as any)?.noa1Date || profile?.priorityDate) // Fallback to priorityDate if noa1Date not available
        : profile?.priorityDate;
      
      if (!hasRequiredDate || !profile?.serviceCenter || !profile?.formType) {
        setLoading(false);
        return;
      }

      try {
        // Calculate case age - use noa1Date for I-129F, priorityDate for I-130
        const priorityDate = isI129F && (profile as any).noa1Date 
          ? new Date((profile as any).noa1Date)
          : new Date(profile.priorityDate);
        const today = new Date();
        const caseAge = Math.floor((today.getTime() - priorityDate.getTime()) / (1000 * 60 * 60 * 24));

        // Get processing time distribution and per-center medians from backend
        const [distribution, medianByCenter] = await Promise.all([
          getProcessingTimeDistribution(profile.formType),
          getMedianProcessingTimeByServiceCenter(profile.formType),
        ]);
        
        // Use backend median for this service center when available; else global distribution median; else fallback
        const typicalCaseAge =
          medianByCenter[profile.serviceCenter] ??
          distribution?.median ??
          450;
        
        // Calculate percentile (where user stands compared to all cases)
        let percentile = 50; // Default
        if (distribution) {
          if (caseAge <= distribution.min) percentile = 0;
          else if (caseAge >= distribution.max) percentile = 100;
          else if (caseAge <= distribution.median) {
            // Between min and median
            const range = distribution.median - distribution.min;
            const position = caseAge - distribution.min;
            percentile = Math.round((position / range) * 50);
          } else {
            // Between median and max
            const range = distribution.max - distribution.median;
            const position = caseAge - distribution.median;
            percentile = Math.round(50 + (position / range) * 50);
          }
        }

        // Determine status
        const diff = caseAge - typicalCaseAge;
        let status: "ahead" | "on-track" | "behind";
        let message: string;
        let comparisonDetails: string;

        if (diff < -30) {
          status = "ahead";
          message = `You're ${Math.abs(diff)} days ahead of typical ${profile.serviceCenter} cases!`;
          comparisonDetails = "Your case is processing faster than average. Keep tracking progress - you're doing great!";
        } else if (diff > 30) {
          status = "behind";
          message = `Your case is ${diff} days behind typical ${profile.serviceCenter} cases`;
          comparisonDetails = "Don't worry - processing times vary. Your case is still in normal range, and approvals happen regularly.";
        } else {
          status = "on-track";
          message = `Your case is on track for ${profile.serviceCenter}`;
          comparisonDetails = "You're right where you should be. Based on typical processing times for your service center, you're making steady progress.";
        }

        // Get start date for I-129F (noa1) vs I-130 (priorityDate) - use priorityDate we already calculated

        // Get predictive analytics
        const [approvalOdds, timelineEstimate, queuePosition, neighborComparison] = await Promise.all([
          getApprovalOdds(profile.formType, profile.serviceCenter, profile.country, caseAge),
          getTimelineEstimate(profile.formType, priorityDate, profile.serviceCenter),
          getQueuePosition(profile.formType, priorityDate, undefined, user?.uid),
          getNeighborComparison(profile.formType, priorityDate, profile.serviceCenter, 60),
        ]);

        setData({
          caseAge,
          typicalCaseAge,
          percentile,
          status,
          message,
          comparisonDetails,
          approvalOdds,
          timelineEstimate,
          queuePosition,
          neighborComparison,
        });
      } catch (error) {
        console.error("Error loading user standing data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile]);

  // Don't show if user doesn't have profile data
  if (!profile?.priorityDate || !profile?.serviceCenter) {
    return null;
  }

  if (loading) {
    return (
      <div className="uscis-card">
        <div className="p-6">
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--uscis-blue)]"></div>
            <p className="text-sm text-[var(--text-secondary)]">Calculating where you stand...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const statusColors = {
    ahead: "from-green-500 to-green-600",
    "on-track": "from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)]",
    behind: "from-slate-500 to-slate-600",
  };

  const statusIcons = {
    ahead: "↑",
    "on-track": "→",
    behind: "↓",
  };

  // Prepare data for visualizations
  const oddsData = data.approvalOdds ? [
    { name: "Approved", value: data.approvalOdds.approved, color: "#10B981" },
    { name: "RFE", value: data.approvalOdds.rfe, color: "#F97316" },
    { name: "Denied", value: data.approvalOdds.denied, color: "#EF4444" },
  ] : [];

  // Timeline estimate data (segmented bar)
  const timelineSegments = data.timelineEstimate ? (() => {
    const earliest = data.timelineEstimate.earliest;
    const latest = data.timelineEstimate.latest;
    const median = data.timelineEstimate.median;
    const totalDays = differenceInDays(latest, earliest);
    const segments = [
      { label: format(earliest, "MMM d"), days: differenceInDays(median, earliest), color: "#E5E7EB" },
      { label: format(median, "MMM d"), days: 0, color: "#3B82F6" },
      { label: format(latest, "MMM d"), days: differenceInDays(latest, median), color: "#E5E7EB" },
    ];
    return { segments, totalDays, earliest, median, latest };
  })() : null;

  // Neighbor comparison data (stacked bar)
  const neighborData = data.neighborComparison ? [
    {
      status: "Your Neighbors",
      approved: data.neighborComparison.approvedCount,
      processing: data.neighborComparison.processingCount,
      rfe: data.neighborComparison.rfeCount,
    },
  ] : [];

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Main Status Card */}
      <div className="uscis-card border-2 border-[var(--border-color)]">
        <div className="uscis-card-header">
          <div className="flex items-start gap-2 sm:gap-4 mb-2 sm:mb-3">
            <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br ${statusColors[data.status]} flex items-center justify-center shadow-lg flex-shrink-0`}>
              <span className="text-lg sm:text-2xl text-white font-bold">{statusIcons[data.status]}</span>
            </div>
            <div className="flex-1">
              <h3 className="text-sm sm:text-lg font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1">
                Where You Stand
              </h3>
              <p className="text-[10px] sm:text-sm text-[var(--text-secondary)] leading-relaxed mb-1 sm:mb-2 hidden sm:block">
                <span className="hidden sm:inline">Your personalized position with predictive insights. See exactly where you are and where you're heading.</span>
                <span className="sm:hidden">Your position and progress</span>
              </p>
            </div>
          </div>
        </div>

        <div className="p-2.5 sm:p-6 space-y-2.5 sm:space-y-6">
          {/* Main Status Message */}
          <div className={`p-2 sm:p-4 rounded-lg border-l-4 ${
            data.status === "ahead" ? "bg-green-50 dark:bg-green-900/20 border-green-500" :
            data.status === "on-track" ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500" :
            "bg-slate-50 dark:bg-slate-800/30 border-slate-400"
          }`}>
            <div className="flex items-start gap-1.5 sm:gap-3">
              <span className={`text-base sm:text-2xl ${data.status === "ahead" ? "text-green-600" : data.status === "on-track" ? "text-gray-800 dark:text-gray-200" : "text-slate-600 dark:text-slate-400"}`}>
                {statusIcons[data.status]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] sm:text-sm md:text-base font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1">
                  {data.message}
                </p>
                <p className="text-[9px] sm:text-xs md:text-sm text-[var(--text-secondary)] leading-relaxed">
                  <span className="hidden sm:inline">{data.comparisonDetails}</span>
                  <span className="sm:hidden">{data.comparisonDetails.split('.')[0]}.</span>
                </p>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-1 sm:gap-2 md:gap-4">
            {/* Case Age */}
            <div className="p-1.5 sm:p-3 md:p-4 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border-color)]">
              <p className="text-[8px] sm:text-[10px] md:text-xs font-semibold text-[var(--text-secondary)] mb-0.5 sm:mb-1 md:mb-2">
                <span className="hidden sm:inline">Your Case Age</span>
                <span className="sm:hidden">Age</span>
              </p>
              <p className="text-base sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1">
                {data.caseAge}
              </p>
              <p className="text-[8px] sm:text-[10px] md:text-xs text-[var(--text-tertiary)]">
                <span className="hidden sm:inline">days since priority date</span>
                <span className="sm:hidden">days</span>
              </p>
              {profile.priorityDate && (
                <p className="text-[8px] sm:text-[10px] md:text-xs text-[var(--text-tertiary)] mt-0.5 sm:mt-1 hidden sm:block">
                  PD: {format(new Date(profile.priorityDate), "MMM d, yyyy")}
                </p>
              )}
            </div>

            {/* Typical Age */}
            <div className="p-1.5 sm:p-3 md:p-4 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border-color)]">
              <p className="text-[8px] sm:text-[10px] md:text-xs font-semibold text-[var(--text-secondary)] mb-0.5 sm:mb-1 md:mb-2">
                <span className="hidden sm:inline">Typical for {profile.serviceCenter}</span>
                <span className="sm:hidden">Typical</span>
              </p>
              <p className="text-base sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1">
                {data.typicalCaseAge}
              </p>
              <p className="text-[8px] sm:text-[10px] md:text-xs text-[var(--text-tertiary)]">
                <span className="hidden sm:inline">days (average)</span>
                <span className="sm:hidden">days</span>
              </p>
            </div>

            {/* Percentile */}
            <div className="p-1.5 sm:p-3 md:p-4 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border-color)]">
              <p className="text-[8px] sm:text-[10px] md:text-xs font-semibold text-[var(--text-secondary)] mb-0.5 sm:mb-1 md:mb-2">
                <span className="hidden sm:inline">Percentile among tracked cases</span>
                <span className="sm:hidden">Percentile</span>
              </p>
              <p className="text-base sm:text-2xl md:text-3xl font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1">
                {data.percentile}%
              </p>
              <p className="text-[8px] sm:text-[10px] md:text-xs text-[var(--text-tertiary)] mb-0.5">
                {data.percentile < 25 ? "You’re moving faster than most similar cases." :
                 data.percentile < 50 ? "You’re in a good, faster‑than‑average range." :
                 data.percentile < 75 ? "You’re close to the middle of similar cases." :
                 "You’re slower than many similar cases, but still within a normal range."}
              </p>
              <p className="hidden sm:block text-[8px] sm:text-[10px] md:text-[11px] text-[var(--text-tertiary)] leading-snug">
                0% means the very fastest cases; 100% means the slowest. We only compare you against{" "}
                <span className="font-semibold">tracked I‑130 / I‑129F cases with similar priority dates</span>, not all USCIS cases.
              </p>
            </div>
          </div>

          {/* Progress Bar Visualization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-secondary)] font-semibold">
                <span className="hidden sm:inline">Processing Progress</span>
                <span className="sm:hidden">Progress</span>
              </span>
              <span className="text-[var(--text-primary)] font-bold text-xs sm:text-sm">
                {data.percentile < 25 ? "Ahead" :
                 data.percentile < 50 ? "Good" :
                 data.percentile < 75 ? "On Track" :
                 "Patience"}
              </span>
            </div>
            <div className="h-3 bg-[var(--bg-surface-alt)] rounded-full overflow-hidden border border-[var(--border-color)]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  data.status === "ahead" ? "bg-[var(--uscis-green)]" :
                  data.status === "on-track" ? "bg-[var(--uscis-blue)]" :
                  "bg-[var(--uscis-gray)]"
                }`}
                style={{ width: `${Math.min(data.percentile, 100)}%` }}
              />
            </div>
            <div className="hidden sm:flex items-center justify-between text-xs text-[var(--text-tertiary)]">
              <span>0% (Fastest)</span>
              <span>50% (Median)</span>
              <span>100% (Slowest)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Predictive Analytics Section - Multiple Distinct Visualizations */}
      {data.approvalOdds && data.timelineEstimate && (
        <div className="mt-8 space-y-6">
          {/* Divider */}
          <div>
            <div className="h-px bg-gradient-to-r from-transparent via-[var(--border-color)] to-transparent" />
            <p className="text-xs text-[var(--text-tertiary)] text-center mt-3 font-medium">
              Predictive Insights • Based on Similar Cases
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Your Odds - Expanded with More Data */}
            <div className="h-full">
              <div className="uscis-card h-full flex flex-col min-h-[300px]">
                <div className="uscis-card-header">
                  <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">Your Odds</h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Probability of different outcomes based on {data.approvalOdds.sampleSize} similar cases
                  </p>
                </div>
                <div className="p-4 sm:p-6 flex-1 flex flex-col">
                  {/* Main Probability Donuts */}
                  <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-3 sm:mb-4">
                    {oddsData.map((item, index) => (
                      <div key={index} className="text-center min-w-0">
                        <div
                          className="relative w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-1.5 sm:mb-2"
                          style={{ height: "80px", width: "80px" }}
                        >
                          <ResponsiveContainer width="100%" height={80}>
                            <PieChart>
                              <Pie
                                data={[
                                  { name: item.name, value: item.value },
                                  { name: "rest", value: 100 - item.value },
                                ]}
                                cx="50%"
                                cy="50%"
                                innerRadius={28}
                                outerRadius={40}
                                startAngle={90}
                                endAngle={-270}
                                dataKey="value"
                              >
                                <Cell key="value" fill={item.color} />
                                <Cell key="rest" fill="#E5E7EB" />
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <p className="text-lg font-bold text-[var(--text-primary)]">
                                {item.value}%
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-[var(--text-primary)]">
                          {item.name}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-[var(--text-tertiary)] text-center mt-auto">
                    {data.approvalOdds.confidence === "high"
                      ? "High confidence"
                      : data.approvalOdds.confidence === "medium"
                      ? "Medium confidence"
                      : "Low confidence"}{" "}
                    based on {data.approvalOdds.sampleSize} similar cases
                  </p>
                </div>
              </div>
            </div>

            {/* Your Estimate - Timeline Bar */}
            <div className="h-full">
              <div className="uscis-card h-full flex flex-col min-h-[300px]">
                <div className="uscis-card-header">
                  <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">
                    Your Estimate
                  </h4>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Estimated approval timeline based on processing patterns
                  </p>
                </div>
                <div className="p-4 sm:p-6 flex-1 flex flex-col">
                  {timelineSegments ? (
                    <div className="space-y-3 sm:space-y-4">
                      <div className="relative h-10 sm:h-12 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-lg overflow-hidden">
                        {/* Segments */}
                        <div className="absolute inset-0 flex">
                          <div
                            className="bg-slate-300 dark:bg-slate-600 opacity-60"
                            style={{
                              width: `${
                                (timelineSegments.segments[0].days /
                                  timelineSegments.totalDays) *
                                100
                              }%`,
                            }}
                          />
                          <div
                            className="bg-[var(--uscis-blue)]"
                            style={{ width: "25%", position: "relative" }}
                          >
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-white shadow-lg" />
                            </div>
                          </div>
                          <div
                            className="bg-slate-300 dark:bg-slate-600 opacity-60"
                            style={{
                              width: `${
                                (timelineSegments.segments[2].days /
                                  timelineSegments.totalDays) *
                                100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                        <div className="text-center">
                          <p className="font-semibold text-[var(--text-primary)]">
                            {format(timelineSegments.earliest, "MMM d")}
                          </p>
                          <p className="text-[var(--text-tertiary)]">Earliest</p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-[var(--text-primary)]">
                            {format(timelineSegments.median, "MMM d")}
                          </p>
                          <p className="text-[var(--text-tertiary)]">
                            Most Likely
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-[var(--text-primary)]">
                            {format(timelineSegments.latest, "MMM d")}
                          </p>
                          <p className="text-[var(--text-tertiary)]">Latest</p>
                        </div>
                      </div>
                      <p className="text-xs text-[var(--text-tertiary)] text-center">
                        {data.timelineEstimate.method}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Your Position - Queue Visualization */}
            {data.queuePosition && (
              <div className="h-full">
                <div className="uscis-card h-full flex flex-col min-h-[300px]">
                  <div className="uscis-card-header">
                    <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">
                      Your Position
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      Compared to {data.queuePosition.totalTracked} other people
                      who filed around the same time as you (within 3 months)
                    </p>
                  </div>
                  <div className="p-4 sm:p-6 flex-1 flex flex-col">
                    <div className="space-y-4 flex-1 flex flex-col">
                      {/* Main Numbers */}
                      <div className="text-center">
                        <p className="text-4xl sm:text-5xl font-bold text-[var(--text-primary)] mb-2">
                          #{data.queuePosition.positionRank.toLocaleString()}
                        </p>
                        <p className="text-sm text-[var(--text-secondary)] mb-1">
                          You're number{" "}
                          <strong className="text-[var(--text-primary)]">
                            {data.queuePosition.positionRank.toLocaleString()}
                          </strong>{" "}
                          out of {data.queuePosition.totalTracked} people
                        </p>
                        {data.queuePosition.casesAhead > 0 && (
                          <p className="text-xs text-[var(--text-tertiary)]">
                            {data.queuePosition.casesAhead.toLocaleString()}{" "}
                            {data.queuePosition.casesAhead === 1
                              ? "person"
                              : "people"}{" "}
                            filed before you
                          </p>
                        )}
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-2">
                        <div className="relative h-8 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-full overflow-hidden border-2 border-slate-300 dark:border-slate-600">
                          {/* Background fill showing processed portion */}
                          <div
                            className="absolute inset-y-0 left-0 bg-[var(--uscis-blue)] rounded-full transition-all duration-500"
                            style={{
                              width: `${data.queuePosition.percentile}%`,
                            }}
                          />
                          {/* User position marker */}
                          <div
                            className="absolute top-0 bottom-0 w-1 bg-red-500 dark:bg-red-400 shadow-lg z-10"
                            style={{
                              left: `${data.queuePosition.percentile}%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
                          <span className="flex items-center gap-1">
                            <span className="text-green-600 dark:text-green-400 font-semibold">
                              First
                            </span>
                            <span className="text-[var(--text-tertiary)]">
                              (filed earliest)
                            </span>
                          </span>
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            You are here
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="text-[var(--text-tertiary)]">
                              (filed latest)
                            </span>
                            <span className="text-red-600 dark:text-red-400 font-semibold">
                              Last
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Status Message */}
                      {data.queuePosition.isInRange && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
                          <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                            ✓ Your case is in the active processing range!
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                            USCIS is currently processing cases around your
                            priority date
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Your Neighbors - Stacked Bar Chart */}
            {data.neighborComparison && data.neighborComparison.totalNeighbors > 0 && (
              <div className="h-full">
                <div className="uscis-card h-full flex flex-col min-h-[300px]">
                  <div className="uscis-card-header">
                    <h4 className="text-base font-bold text-[var(--text-primary)] mb-1">
                      Your Neighbors
                    </h4>
                    <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      Status of {data.neighborComparison.totalNeighbors} cases
                      with similar priority dates (within 2 months)
                    </p>
                  </div>
                  <div className="p-4 sm:p-6 flex-1 flex flex-col">
                    {/* Quick Stats Summary */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4">
                      <div className="p-2 sm:p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-center overflow-hidden min-w-0">
                        <p className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
                          {data.neighborComparison.approvedCount || 0}
                        </p>
                        <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-1 break-words whitespace-normal leading-tight px-0.5">
                          ✅ Approved
                        </p>
                      </div>
                      <div className="p-2 sm:p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 text-center overflow-hidden min-w-0">
                        <p className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-200">
                          {data.neighborComparison.processingCount || 0}
                        </p>
                        <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-1 break-words whitespace-normal leading-tight px-0.5">
                          ⏳ Processing
                        </p>
                      </div>
                      <div className="p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 text-center overflow-hidden min-w-0">
                        <p className="text-xl sm:text-2xl font-bold text-red-600 dark:text-red-400">
                          {data.neighborComparison.rfeCount || 0}
                        </p>
                        <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-1 break-words whitespace-normal leading-tight px-0.5">
                          ⚠️ RFE
                        </p>
                      </div>
                    </div>

                    {/* Compact Chart */}
                    <div style={{ height: "140px" }}>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart
                          data={neighborData}
                          layout="vertical"
                          margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#E5E7EB"
                            opacity={0.3}
                          />
                          <XAxis type="number" hide />
                          <YAxis
                            type="category"
                            dataKey="status"
                            width={100}
                            tick={{
                              fontSize: 11,
                              fill: "var(--text-primary)",
                              fontWeight: 600,
                            }}
                            style={{ textAnchor: "end" }}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "transparent",
                              border: "none",
                              padding: 0,
                              margin: 0,
                              boxShadow: "none",
                            }}
                            labelStyle={{ display: "none" }}
                            itemStyle={{
                              padding: 0,
                              margin: 0,
                              color: "white",
                              fontSize: "12px",
                              fontWeight: 600,
                            }}
                            formatter={(value: any) => value}
                            separator=""
                          />
                          <Bar
                            dataKey="approved"
                            stackId="a"
                            fill="#10B981"
                            name="Approved"
                            radius={[0, 8, 8, 0]}
                          />
                          <Bar
                            dataKey="processing"
                            stackId="a"
                            fill="#3B82F6"
                            name="Processing"
                          />
                          <Bar
                            dataKey="rfe"
                            stackId="a"
                            fill="#F97316"
                            name="RFE"
                            radius={[0, 0, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Compact Legend */}
                    <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-[var(--border-color)]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-green-500"></div>
                        <span className="text-xs text-[var(--text-secondary)]">
                          ✅ Approved
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-blue-500"></div>
                        <span className="text-xs text-[var(--text-secondary)]">
                          ⏳ Processing
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-red-500"></div>
                        <span className="text-xs text-[var(--text-secondary)]">
                          ⚠️ RFE
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
