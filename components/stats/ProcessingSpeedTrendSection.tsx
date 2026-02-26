"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, getDocs, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface ProcessingSpeedData {
  week: string;
  averageDays: number;
}

export default function ProcessingSpeedTrendSection() {
  const [data, setData] = useState<ProcessingSpeedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [trend, setTrend] = useState<"faster" | "slower" | "stable">("stable");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Get recent approvals from both I-130 and I-129F to calculate processing speed trends
        const [i130Snapshot, i129fSnapshot] = await Promise.all([
          (async () => {
            try {
              const q = query(collection(db, "i130Approvals"), where("formType", "==", "I-130"), orderBy("createdAt", "desc"), limit(100));
              return await getDocs(q);
            } catch {
              // If orderBy fails, try without it and sort in memory
              const q = query(collection(db, "i130Approvals"), where("formType", "==", "I-130"), limit(100));
              const snap = await getDocs(q);
              return {
                ...snap,
                docs: [...snap.docs].sort((a, b) => {
                  const aCreated = a.data().createdAt?.toDate?.() || (a.data().createdAt ? new Date(a.data().createdAt) : new Date(0));
                  const bCreated = b.data().createdAt?.toDate?.() || (b.data().createdAt ? new Date(b.data().createdAt) : new Date(0));
                  return bCreated.getTime() - aCreated.getTime();
                })
              } as any;
            }
          })(),
          (async () => {
            try {
              const q = query(collection(db, "i129fApprovals"), where("formType", "==", "I-129F"), orderBy("createdAt", "desc"), limit(100));
              return await getDocs(q);
            } catch {
              // If orderBy fails, try without it and sort in memory
              const q = query(collection(db, "i129fApprovals"), where("formType", "==", "I-129F"), limit(100));
              const snap = await getDocs(q);
              return {
                ...snap,
                docs: [...snap.docs].sort((a, b) => {
                  const aCreated = a.data().createdAt?.toDate?.() || (a.data().createdAt ? new Date(a.data().createdAt) : new Date(0));
                  const bCreated = b.data().createdAt?.toDate?.() || (b.data().createdAt ? new Date(b.data().createdAt) : new Date(0));
                  return bCreated.getTime() - aCreated.getTime();
                })
              } as any;
            }
          })(),
        ]);

        // Group by week and calculate average processing days
        const weeklyData: { [key: string]: { totalDays: number; count: number } } = {};
        
        // Process I-130 approvals
        i130Snapshot.forEach((doc: QueryDocumentSnapshot) => {
          const approval = doc.data();
          const pd = approval.priorityDate?.toDate?.() || (approval.priorityDate ? new Date(approval.priorityDate) : null);
          const ad = approval.approvalDate?.toDate?.() || (approval.approvalDate ? new Date(approval.approvalDate) : null);
          
          if (!pd || !ad || isNaN(pd.getTime()) || isNaN(ad.getTime())) return;

          const processingDays = Math.floor((ad.getTime() - pd.getTime()) / (1000 * 60 * 60 * 24));
          if (processingDays <= 0 || processingDays > 2000) return;

          // Get week identifier
          const weekStart = new Date(ad);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
          const weekKey = weekStart.toISOString().split('T')[0];

          if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = { totalDays: 0, count: 0 };
          }
          weeklyData[weekKey].totalDays += processingDays;
          weeklyData[weekKey].count += 1;
        });

        // Process I-129F approvals
        i129fSnapshot.forEach((doc: QueryDocumentSnapshot) => {
          const approval = doc.data();
          const noa1 = approval.noa1?.toDate?.() || (approval.noa1 ? new Date(approval.noa1) : null);
          const noa2 = approval.noa2?.toDate?.() || (approval.noa2 ? new Date(approval.noa2) : null);
          
          if (!noa1 || !noa2 || isNaN(noa1.getTime()) || isNaN(noa2.getTime())) return;

          const processingDays = Math.floor((noa2.getTime() - noa1.getTime()) / (1000 * 60 * 60 * 24));
          if (processingDays <= 0 || processingDays > 2000) return;

          // Get week identifier
          const weekStart = new Date(noa2);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week (Sunday)
          const weekKey = weekStart.toISOString().split('T')[0];

          if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = { totalDays: 0, count: 0 };
          }
          weeklyData[weekKey].totalDays += processingDays;
          weeklyData[weekKey].count += 1;
        });

        if (Object.keys(weeklyData).length === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        // Convert to array and calculate averages (last 8 weeks)
        const weeks = Object.keys(weeklyData).sort().slice(-8);
        const result: ProcessingSpeedData[] = weeks.map((week) => ({
          week,
          averageDays: Math.round(weeklyData[week].totalDays / weeklyData[week].count),
        }));

        setData(result);

        // Determine trend
        if (result.length >= 2) {
          const recent = result.slice(-2);
          const diff = recent[1].averageDays - recent[0].averageDays;
          if (diff < -5) setTrend("faster");
          else if (diff > 5) setTrend("slower");
          else setTrend("stable");
        }
      } catch (error) {
        console.error("Error loading processing speed trend:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const maxDays = Math.max(...data.map((d) => d.averageDays), 300);
  const minDays = Math.min(...data.map((d) => d.averageDays), 100);

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-start gap-4 mb-3">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 via-red-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1">
              Is Processing Getting Faster or Slower?
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2">
              Find out if USCIS is speeding up or slowing down. This directly affects how long you'll wait.
            </p>
          </div>
        </div>
      </div>
      <div className="p-4 sm:p-6 -ml-2 sm:ml-0">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--uscis-blue)]"></div>
          </div>
        ) : data.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--text-secondary)]">No data available yet</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Trend Indicator */}
            <div className="flex items-center justify-center gap-4">
              <div className={`px-4 py-2 rounded-lg ${
                trend === "faster" ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400" :
                trend === "slower" ? "bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400" :
                "bg-blue-100 dark:bg-blue-900/20 text-gray-800 dark:text-gray-200"
              }`}>
                <span className="text-sm font-semibold">
                  {trend === "faster" ? "⚡ Getting Faster" : trend === "slower" ? "⚠️ Getting Slower" : "→ Staying Stable"}
                </span>
              </div>
            </div>

            {/* Enhanced Bar Chart */}
            <div className="space-y-4">
              {data.map((item, index) => {
                const percentage = ((item.averageDays - minDays) / (maxDays - minDays)) * 100;
                const weekDate = new Date(item.week);
                const weekLabel = `Week of ${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                const isImproving = index > 0 && item.averageDays < data[index - 1].averageDays;
                const isWorsening = index > 0 && item.averageDays > data[index - 1].averageDays;
                
                return (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{weekLabel}</span>
                      <div className="flex items-center gap-2">
                        {index > 0 && (
                          <span className={`text-xs font-semibold ${
                            isImproving ? "text-green-600" : isWorsening ? "text-red-600" : "text-[var(--text-secondary)]"
                          }`}>
                            {isImproving ? "↓" : isWorsening ? "↑" : "→"}
                          </span>
                        )}
                        <span className="text-sm font-bold text-[var(--text-primary)]">{item.averageDays} days</span>
                      </div>
                    </div>
                    <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden shadow-inner">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-lg transition-all duration-700 ease-out ${
                          isImproving 
                            ? "bg-gradient-to-r from-green-500 to-green-600" 
                            : isWorsening 
                            ? "bg-gradient-to-r from-red-500 to-red-600"
                            : "bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)]"
                        }`}
                        style={{ width: `${Math.max(percentage, 5)}%` }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-semibold text-[var(--text-primary)] mix-blend-difference">
                          {Math.round(percentage)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
