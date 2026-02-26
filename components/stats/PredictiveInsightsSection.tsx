"use client";

import React, { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { 
  getApprovalOdds, 
  getTimelineEstimate,
  getServiceCenterStats,
  getProcessingTimeDistribution
} from "@/lib/statsService";
import { format, differenceInDays } from "date-fns";
import { 
  ClockIcon, 
  ChartBarIcon, 
  BuildingOfficeIcon,
  ExclamationTriangleIcon 
} from "@heroicons/react/24/outline";

interface PredictiveInsight {
  id: string;
  title: string;
  icon: React.ReactNode;
  value: string;
  subtitle: string;
  trend?: "up" | "down" | "stable";
  color: string;
  bgColor: string;
}

export default function PredictiveInsightsSection() {
  const { profile } = useProfile();
  const [insights, setInsights] = useState<PredictiveInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInsights() {
      if (!profile?.formType) {
        setLoading(false);
        return;
      }

      try {
        const isI129F = profile.formType === "I-129F";
        const priorityDate = (isI129F && (profile as any).noa1Date) 
          ? new Date((profile as any).noa1Date)
          : (profile.priorityDate ? new Date(profile.priorityDate) : null);
        
        if (!priorityDate) {
          setLoading(false);
          return;
        }
        
        const today = new Date();
        const caseAge = Math.floor((today.getTime() - priorityDate.getTime()) / (1000 * 60 * 60 * 24));

        // Fetch predictive data
        const [approvalOdds, timelineEstimate, serviceCenterStats, processingDistribution] = await Promise.all([
          getApprovalOdds(profile.formType, profile.serviceCenter || undefined, profile.country || undefined, caseAge),
          getTimelineEstimate(profile.formType, priorityDate, profile.serviceCenter || undefined),
          getServiceCenterStats().catch(() => []),
          getProcessingTimeDistribution(profile.formType).catch(() => null),
        ]);

        const newInsights: PredictiveInsight[] = [];

        // 1. Processing Speed Insight (using timeline estimate or processing distribution)
        if (timelineEstimate) {
          const medianDate = timelineEstimate.median;
          const daysRemaining = Math.max(0, Math.floor((medianDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
          
          newInsights.push({
            id: "speed",
            title: "Estimated Days Remaining",
            icon: <ClockIcon className="w-5 h-5" />,
            value: daysRemaining > 0 ? `${daysRemaining} days` : "Due Now",
            subtitle: timelineEstimate.method,
            trend: daysRemaining < 30 ? "down" : daysRemaining > 120 ? "up" : "stable",
            color: "var(--uscis-blue)",
            bgColor: "bg-[var(--bg-surface-alt)]",
          });
        } else if (processingDistribution) {
          const medianDays = processingDistribution.median;
          const daysRemaining = Math.max(0, medianDays - caseAge);
          
          newInsights.push({
            id: "speed",
            title: "Estimated Days Remaining",
            icon: <ClockIcon className="w-5 h-5" />,
            value: daysRemaining > 0 ? `${daysRemaining} days` : "Due Now",
            subtitle: `Based on ${processingDistribution.count} similar cases`,
            trend: daysRemaining < 30 ? "down" : daysRemaining > 120 ? "up" : "stable",
            color: "var(--uscis-blue)",
            bgColor: "bg-[var(--bg-surface-alt)]",
          });
        }

        // 2. Approval Likelihood
        if (approvalOdds.approved > 0) {
          const approvalRate = approvalOdds.approved;
          newInsights.push({
            id: "likelihood",
            title: "Approval Likelihood",
            icon: <ChartBarIcon className="w-5 h-5" />,
            value: `${approvalRate}%`,
            subtitle: `${approvalOdds.sampleSize} similar cases analyzed`,
            trend: approvalRate >= 85 ? "up" : approvalRate >= 70 ? "stable" : "down",
            color: approvalRate >= 85 ? "var(--uscis-blue)" : approvalRate >= 70 ? "#F59E0B" : "#EF4444",
            bgColor: "bg-[var(--bg-surface-alt)]",
          });
        }

        // 3. Service Center Performance
        if (serviceCenterStats && serviceCenterStats.length > 0 && profile.serviceCenter) {
          const userCenter = serviceCenterStats.find(
            (s) => s.name.toLowerCase().includes(profile.serviceCenter!.toLowerCase()) ||
                   profile.serviceCenter!.toLowerCase().includes(s.name.toLowerCase())
          );
          
          if (userCenter) {
            const avgDays = userCenter.avgDays || 0;
            const allAvgDays = serviceCenterStats.reduce((sum, s) => sum + (s.avgDays || 0), 0) / serviceCenterStats.length;
            const faster = avgDays < allAvgDays;
            
            newInsights.push({
              id: "center",
              title: "Your Service Center",
              icon: <BuildingOfficeIcon className="w-5 h-5" />,
              value: faster ? `${Math.round(allAvgDays - avgDays)} days faster` : `${Math.round(avgDays - allAvgDays)} days slower`,
              subtitle: `${userCenter.name} vs. average`,
              trend: faster ? "up" : "down",
              color: faster ? "var(--uscis-blue)" : "#F59E0B",
              bgColor: "bg-[var(--bg-surface-alt)]",
            });
          }
        }

        // 4. Timeline Confidence
        if (timelineEstimate) {
          const daysRange = differenceInDays(timelineEstimate.latest, timelineEstimate.earliest);
          const confidence = timelineEstimate.confidence;
          
          newInsights.push({
            id: "confidence",
            title: "Timeline Confidence",
            icon: <ExclamationTriangleIcon className="w-5 h-5" />,
            value: confidence === "high" ? "High" : confidence === "medium" ? "Medium" : "Low",
            subtitle: `${daysRange} day window`,
            trend: confidence === "high" ? "up" : confidence === "medium" ? "stable" : "down",
            color: confidence === "high" ? "var(--uscis-blue)" : confidence === "medium" ? "#F59E0B" : "#EF4444",
            bgColor: "bg-[var(--bg-surface-alt)]",
          });
        }

        setInsights(newInsights);
      } catch (error) {
        console.error("Error loading predictive insights:", error);
      } finally {
        setLoading(false);
      }
    }

    loadInsights();
  }, [profile]);

  if (loading) {
    return (
      <div className="uscis-card">
        <div className="uscis-card-header">
          <div>
            <h3 className="text-base sm:text-lg font-semibold">Predictive Insights</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Data-driven predictions based on similar cases
            </p>
          </div>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--uscis-blue)]"></div>
            <p className="ml-3 text-sm text-[var(--text-secondary)]">Loading insights...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile?.formType || insights.length === 0) {
    return (
      <div className="uscis-card">
        <div className="uscis-card-header">
          <div>
            <h3 className="text-base sm:text-lg font-semibold">Predictive Insights</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Data-driven predictions based on similar cases
            </p>
          </div>
        </div>
        <div className="p-6">
          <p className="text-sm text-center text-[var(--text-secondary)] py-4">
            Complete your profile (form type, priority date) to see personalized predictions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div>
          <h3 className="text-sm sm:text-base md:text-lg font-semibold">Predictive Insights</h3>
          <p className="text-[10px] sm:text-xs text-[var(--text-secondary)] mt-0.5 sm:mt-1">
            <span className="hidden sm:inline">Data-driven predictions based on similar cases</span>
            <span className="sm:hidden">Predictions from similar cases</span>
          </p>
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className={`p-3 sm:p-4 md:p-5 rounded-lg border ${insight.bgColor} border-[var(--border-color)] hover:shadow-lg hover:border-[var(--uscis-blue)]/30 transition-all`}
              style={{ borderLeftWidth: '4px', borderLeftColor: insight.color }}
            >
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="flex-shrink-0 mt-0.5" style={{ color: insight.color }}>
                  {insight.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] sm:text-[10px] md:text-xs font-semibold text-[var(--text-secondary)] mb-0.5 sm:mb-1">
                    {insight.title}
                  </p>
                  <p className="text-base sm:text-lg md:text-xl font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1" style={{ color: insight.color }}>
                    {insight.value}
                  </p>
                  <p className="text-[9px] sm:text-[10px] md:text-xs text-[var(--text-secondary)] leading-relaxed">
                    {insight.subtitle}
                  </p>
                </div>
                {insight.trend && (
                  <div className="flex-shrink-0">
                    {insight.trend === "up" && (
                      <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      </svg>
                    )}
                    {insight.trend === "down" && (
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                    )}
                    {insight.trend === "stable" && (
                      <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
                      </svg>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
