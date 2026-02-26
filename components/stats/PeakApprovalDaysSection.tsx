"use client";

import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, getDocs, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface DayOfWeekData {
  day: string;
  count: number;
  percentage: number;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function PeakApprovalDaysSection() {
  const [data, setData] = useState<DayOfWeekData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        // Get recent approvals from both I-130 and I-129F
        const [i130Snapshot, i129fSnapshot] = await Promise.all([
          (async () => {
            try {
              const q = query(collection(db, "i130Approvals"), where("formType", "==", "I-130"), orderBy("createdAt", "desc"), limit(250));
              return await getDocs(q);
            } catch {
              // If orderBy fails, try without it and sort in memory
              const q = query(collection(db, "i130Approvals"), where("formType", "==", "I-130"), limit(250));
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
              const q = query(collection(db, "i129fApprovals"), where("formType", "==", "I-129F"), orderBy("createdAt", "desc"), limit(250));
              return await getDocs(q);
            } catch {
              // If orderBy fails, try without it and sort in memory
              const q = query(collection(db, "i129fApprovals"), where("formType", "==", "I-129F"), limit(250));
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

        // Count approvals by day of week
        const dayCounts: { [key: string]: number } = {
          Sunday: 0,
          Monday: 0,
          Tuesday: 0,
          Wednesday: 0,
          Thursday: 0,
          Friday: 0,
          Saturday: 0,
        };

        let total = 0;
        
        // Process I-130 approvals
        i130Snapshot.forEach((doc: QueryDocumentSnapshot) => {
          const approval = doc.data();
          const approvalDate = approval.approvalDate?.toDate?.() || (approval.approvalDate ? new Date(approval.approvalDate) : null);
          if (!approvalDate || isNaN(approvalDate.getTime())) return;

          const dayName = DAYS[approvalDate.getDay()];
          dayCounts[dayName]++;
          total++;
        });

        // Process I-129F approvals
        i129fSnapshot.forEach((doc: QueryDocumentSnapshot) => {
          const approval = doc.data();
          const noa2 = approval.noa2?.toDate?.() || (approval.noa2 ? new Date(approval.noa2) : null);
          if (!noa2 || isNaN(noa2.getTime())) return;

          const dayName = DAYS[noa2.getDay()];
          dayCounts[dayName]++;
          total++;
        });

        if (total === 0) {
          setData([]);
          setLoading(false);
          return;
        }

        // Convert to array with percentages
        const result: DayOfWeekData[] = DAYS.map((day) => ({
          day,
          count: dayCounts[day],
          percentage: total > 0 ? (dayCounts[day] / total) * 100 : 0,
        }));

        setData(result);
      } catch (error) {
        console.error("Error loading peak approval days:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-start gap-4 mb-3">
          <div className="w-14 h-14 rounded-xl bg-[var(--uscis-gray-dark)] flex items-center justify-center shadow-lg flex-shrink-0">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1">
              Which Days Do Most Approvals Happen?
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2">
              Discover the best days of the week to check your case status. USCIS follows patterns just like any organization.
            </p>
            <div className="bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500 p-3 rounded-lg">
              <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">📅 What You'll Learn:</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                See which weekday USCIS approves the most cases. Taller bars mean more approvals on that day.
              </p>
            </div>
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
          <div className="space-y-4">
            {/* Day Bars */}
            {data.map((item, index) => {
              const isWeekend = item.day === "Saturday" || item.day === "Sunday";
              const barWidth = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
              const isPeak = item.count === maxCount && maxCount > 0;
              
              return (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isPeak && (
                        <span className="text-xs font-bold text-[var(--text-primary)]">⭐</span>
                      )}
                      <span className={`text-sm font-semibold ${isWeekend ? "text-[var(--text-secondary)]" : "text-[var(--text-primary)]"}`}>
                        {item.day.substring(0, 3)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[var(--text-secondary)]">{item.count} approvals</span>
                      <span className={`text-xs font-bold ${isPeak ? "text-[var(--text-primary)]" : "text-[var(--text-primary)]"}`}>
                        {Math.round(item.percentage)}%
                      </span>
                    </div>
                  </div>
                  <div className="relative h-10 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden shadow-inner">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-lg transition-all duration-700 ease-out ${
                        isWeekend 
                          ? "bg-gradient-to-r from-gray-400 to-gray-500 dark:from-gray-600 dark:to-gray-700" 
                          : isPeak
                          ? "bg-gradient-to-r from-[var(--uscis-blue)] via-blue-400 to-[var(--uscis-blue)]"
                          : "bg-gradient-to-r from-[var(--uscis-blue)] via-blue-500 to-[var(--uscis-blue-dark)]"
                      }`}
                      style={{ width: `${Math.max(barWidth, 3)}%` }}
                    />
                    {isPeak && (
                      <div className="absolute inset-0 flex items-center justify-end pr-2">
                        <span className="text-xs font-bold text-[var(--text-primary)] dark:text-blue-400">Peak Day</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

          </div>
        )}
      </div>
    </div>
  );
}
