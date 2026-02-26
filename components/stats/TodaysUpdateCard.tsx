"use client";

import { useState, useEffect } from "react";
import { SystemDailyStats, SystemMonthlyStats, CalendarApprovals } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { format } from "date-fns";
import { collection, query, where, orderBy, limit, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import SkeletonLoader from "@/components/SkeletonLoader";
import EmptyState from "@/components/EmptyState";

interface TodaysUpdateCardProps {
  selectedPeriod: "daily" | "monthly" | "yearly";
  onPeriodChange: (period: "daily" | "monthly" | "yearly") => void;
  dailyStats: SystemDailyStats | null;
  monthlyStats: SystemMonthlyStats | null;
  yearlyStats: CalendarApprovals | null;
  loading: boolean;
}

interface StatusData {
  status: string;
  count: number;
  percentage: number;
  color: string;
  [key: string]: string | number;
}

// Status categories with colors
const STATUS_COLORS: { [key: string]: string } = {
  Approval: "#3B82F6",
  Processing: "#A855F7",
  Transferred: "#9333EA",
  Interview: "#2563EB",
  RFE: "#F97316",
  Biometrics: "#10B981",
  Received: "#6B7280",
};

export default function TodaysUpdateCard({
  selectedPeriod,
  onPeriodChange,
  dailyStats,
  monthlyStats,
  yearlyStats,
  loading,
}: TodaysUpdateCardProps) {
  const [realData, setRealData] = useState<StatusData[] | null>(null);
  const [realDataLoading, setRealDataLoading] = useState(false);

  // Calculate real status breakdown from Firebase data
  useEffect(() => {
    async function calculateRealStatusBreakdown() {
      setRealDataLoading(true);
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let startDate: Date;
        let endDate = new Date(today);
        endDate.setHours(23, 59, 59, 999);

        if (selectedPeriod === "daily") {
          startDate = new Date(today);
        } else if (selectedPeriod === "monthly") {
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        } else {
          startDate = new Date(today.getFullYear(), 0, 1);
        }

        // Query both I-130 and I-129F approvals using composite index
        const [i130Snapshot, i129fSnapshot] = await Promise.all([
          getDocs(query(collection(db, "i130Approvals"), where("formType", "==", "I-130"), orderBy("createdAt", "desc"), limit(1000))),
          getDocs(query(collection(db, "i129fApprovals"), where("formType", "==", "I-129F"), orderBy("createdAt", "desc"), limit(1000))),
        ]);

        const statusCounts: { [key: string]: number } = {
          Approval: 0,
          Processing: 0,
          Transferred: 0,
          Interview: 0,
          RFE: 0,
          Biometrics: 0,
          Received: 0,
        };

        // Process I-130 approvals
        i130Snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const approvalDate = data.approvalDate?.toDate?.() || (data.approvalDate ? new Date(data.approvalDate) : null);
          const createdAt = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
          
          // Check if this approval is within the selected period
          if (approvalDate && approvalDate >= startDate && approvalDate <= endDate) {
            statusCounts.Approval++;
          } else if (createdAt && createdAt >= startDate && createdAt <= endDate) {
            // If no approval date but created in period, count as Received
            statusCounts.Received++;
          }

          // Check for RFE
          if (data.rfe !== null && data.rfe !== undefined) {
            const rfeDate = data.rfe?.toDate?.() || (data.rfe ? new Date(data.rfe) : null);
            if (rfeDate && rfeDate >= startDate && rfeDate <= endDate) {
              statusCounts.RFE++;
            }
          }

          // Check notes for status indicators
          const notes = (data.notes || "").toLowerCase();
          if (createdAt && createdAt >= startDate && createdAt <= endDate) {
            if (notes.includes("transferred")) {
              statusCounts.Transferred++;
            } else if (notes.includes("interview")) {
              statusCounts.Interview++;
            } else if (notes.includes("biometric") || notes.includes("fingerprint")) {
              statusCounts.Biometrics++;
            } else if (!approvalDate && !notes.includes("rfe")) {
              statusCounts.Processing++;
            }
          }
        });

        // Process I-129F approvals
        i129fSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          const noa2 = data.noa2?.toDate?.() || (data.noa2 ? new Date(data.noa2) : null);
          const createdAt = data.createdAt?.toDate?.() || (data.createdAt ? new Date(data.createdAt) : null);
          
          if (noa2 && noa2 >= startDate && noa2 <= endDate) {
            statusCounts.Approval++;
          } else if (createdAt && createdAt >= startDate && createdAt <= endDate) {
            statusCounts.Received++;
          }

          if (data.rfe !== null && data.rfe !== undefined) {
            const rfeDate = data.rfe?.toDate?.() || (data.rfe ? new Date(data.rfe) : null);
            if (rfeDate && rfeDate >= startDate && rfeDate <= endDate) {
              statusCounts.RFE++;
            }
          }

          // Check interview, medical dates for I-129F
          if (createdAt && createdAt >= startDate && createdAt <= endDate) {
            if (data.interview && (data.interview?.toDate?.() || new Date(data.interview)) >= startDate) {
              statusCounts.Interview++;
            } else if (data.medical && (data.medical?.toDate?.() || new Date(data.medical)) >= startDate) {
              statusCounts.Biometrics++;
            } else if (!noa2 && !data.rfe) {
              statusCounts.Processing++;
            }
          }
        });

        // Use approval counts from stats if available for daily/monthly
        if (selectedPeriod === "daily" && dailyStats?.approvalsCount) {
          statusCounts.Approval = dailyStats.approvalsCount;
        } else if (selectedPeriod === "monthly" && monthlyStats?.approvalsTotal) {
          statusCounts.Approval = monthlyStats.approvalsTotal;
        } else if (selectedPeriod === "yearly" && yearlyStats) {
          // Sum up all daily approvals from yearly stats
          const totalYearly = Object.values(yearlyStats.days || {}).reduce((sum, count) => sum + count, 0);
          statusCounts.Approval = totalYearly;
        }

        const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);

        // Convert to StatusData array
        const data: StatusData[] = Object.entries(statusCounts)
          .map(([status, count]) => ({
            status,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0,
            color: STATUS_COLORS[status] || "#6B7280",
          }))
          .filter(item => item.count > 0) // Only show statuses with counts
          .sort((a, b) => b.percentage - a.percentage);

        setRealData(data.length > 0 ? data : null);
      } catch (error) {
        console.error("Error calculating real status breakdown:", error);
        setRealData(null);
      } finally {
        setRealDataLoading(false);
      }
    }

    if (!loading) {
      calculateRealStatusBreakdown();
    }
  }, [selectedPeriod, dailyStats, monthlyStats, yearlyStats, loading]);

  const data = realData || [];
  const totalCases = data.reduce((sum, item) => sum + item.count, 0);

  const currentDateString = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case "daily":
        return format(now, "MMM d, yy");
      case "monthly":
        return format(now, "MMMM yyyy");
      case "yearly":
        return format(now, "yyyy");
    }
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000.0).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000.0).toFixed(1)}K`;
    }
    return count.toString();
  };

  if (loading || realDataLoading) {
    return <SkeletonLoader variant="chart" className="mb-6" />;
  }

  if (data.length === 0) {
    return (
      <EmptyState
        icon="chart"
        title="No Data Available"
        description="We're collecting data for this period. Check back soon for updates on case movements and status changes."
        className="mb-6"
      />
    );
  }

  return (
    <div className="uscis-card">
      <div className="p-4 sm:p-6">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/10 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400"
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
              <h3 className="text-sm sm:text-[15px] font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1">Today's update</h3>
              <p className="text-[10px] sm:text-[11px] text-[var(--text-secondary)] leading-relaxed">
                <span className="hidden sm:inline">See how cases are moving right now. This updates throughout the day.</span>
                <span className="sm:hidden">See how cases are moving</span>
              </p>
            </div>
          </div>

          {/* Period Selector */}
          <div className="flex gap-2 bg-[var(--bg-surface-alt)] p-1 rounded-lg">
            {(["daily", "monthly", "yearly"] as const).map((period) => (
              <button
                key={period}
                onClick={() => onPeriodChange(period)}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  selectedPeriod === period
                    ? "bg-[var(--uscis-blue)] text-white shadow-sm"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Date Header */}
        <div className="mb-4 text-center">
          <p className="text-base font-bold text-[var(--text-primary)]">{currentDateString()}</p>
          <p className="text-xs text-[var(--text-secondary)]">Total Cases: {formatCount(totalCases)}</p>
        </div>

        {/* Bar Chart */}
        <div className="mb-6 min-h-[200px] min-w-0">
          <ResponsiveContainer width="100%" height={Math.max(data.length * 60 + 40, 200)}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 70, bottom: 5 }}
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="status"
                width={65}
                tick={{ fontSize: 11, fill: "var(--text-primary)", fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
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
              <Bar dataKey="count" radius={[0, 8, 8, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
