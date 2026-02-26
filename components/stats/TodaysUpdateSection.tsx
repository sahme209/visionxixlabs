"use client";

import { useState, useEffect } from "react";
import { getSystemDailyStats, getSystemMonthlyStats, getCalendarApprovals, getCurrentMonth } from "@/lib/statsService";
import { SystemDailyStats, SystemMonthlyStats, CalendarApprovals } from "@/lib/types";
import { format } from "date-fns";
import TodaysUpdateCard from "./TodaysUpdateCard";

export default function TodaysUpdateSection() {
  const [selectedPeriod, setSelectedPeriod] = useState<"daily" | "monthly" | "yearly">("daily");
  const [dailyStats, setDailyStats] = useState<SystemDailyStats | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<SystemMonthlyStats | null>(null);
  const [yearlyStats, setYearlyStats] = useState<CalendarApprovals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        if (selectedPeriod === "daily") {
          const today = new Date();
          const stats = await getSystemDailyStats(today);
          setDailyStats(stats);
        } else if (selectedPeriod === "monthly") {
          const currentMonth = getCurrentMonth();
          const stats = await getSystemMonthlyStats(currentMonth);
          setMonthlyStats(stats);
        } else {
          // Yearly: aggregate from calendar approvals for current year
          const currentYear = new Date().getFullYear();
          const yearData: { [key: string]: number } = {};
          
          // Load all months in current year
          for (let month = 1; month <= 12; month++) {
            const monthStr = `${currentYear}-${month.toString().padStart(2, "0")}`;
            try {
              const calData = await getCalendarApprovals(monthStr, "all");
              if (calData) {
                Object.assign(yearData, calData.days);
              }
            } catch (error) {
              // Skip months that don't have data
              console.warn(`No calendar data for ${monthStr}`);
            }
          }
          
          setYearlyStats({
            month: currentYear.toString(),
            days: yearData,
            updatedAt: new Date(),
          });
        }
      } catch (error) {
        console.error("Error loading today's update data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [selectedPeriod]);

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* Section Header - More Impactful */}
      <div className="space-y-1.5 sm:space-y-3">
        <div className="flex items-center gap-1.5 sm:gap-3 md:gap-4">
          <div className="w-8 h-8 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-green-600 flex items-center justify-center shadow-md flex-shrink-0">
            <svg
              className="w-4 h-4 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs sm:text-base md:text-lg font-bold text-[var(--text-primary)] mb-0 sm:mb-1">
              <span className="hidden sm:inline">What's Happening Right Now</span>
              <span className="sm:hidden">Today's Activity</span>
            </h3>
            <p className="text-[9px] sm:text-xs md:text-sm text-[var(--text-secondary)] leading-relaxed hidden sm:block">
              <span className="hidden sm:inline">See what's happening with immigration cases today, this month, or this year. Watch the system move in real-time.</span>
              <span className="sm:hidden">See what's happening today</span>
            </p>
          </div>
        </div>
        
        {/* Simple Legend - Compact */}
        <div className="hidden lg:block bg-[var(--bg-surface-alt)] border border-[var(--border-color)] p-3 rounded-lg">
          <p className="text-xs font-semibold text-[var(--text-primary)] mb-2">Status Colors:</p>
          <div className="grid grid-cols-2 gap-1.5 text-xs text-[var(--text-secondary)]">
            <div>🔵 Approval</div>
            <div>🟣 Processing</div>
            <div>🟠 RFE</div>
            <div>🟢 Biometrics</div>
          </div>
        </div>
      </div>

      {/* Today's Update Card */}
      <TodaysUpdateCard
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
        dailyStats={dailyStats}
        monthlyStats={monthlyStats}
        yearlyStats={yearlyStats}
        loading={loading}
      />
    </div>
  );
}
