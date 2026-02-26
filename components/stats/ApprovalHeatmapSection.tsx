"use client";

import { useEffect, useState } from "react";
import { collection, query, where, orderBy, limit, getDocs, QueryDocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKS = ["W1", "W2", "W3", "W4", "W5"];

interface HeatmapCell {
  day: number;
  week: number;
  count: number;
  label: string;
}

export default function ApprovalHeatmapSection() {
  const [cells, setCells] = useState<HeatmapCell[]>([]);
  const [loading, setLoading] = useState(true);
  const [maxCount, setMaxCount] = useState(1);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [i130Snap, i129fSnap] = await Promise.all([
          (async () => {
            try {
              const q = query(
                collection(db, "i130Approvals"),
                where("formType", "==", "I-130"),
                orderBy("createdAt", "desc"),
                limit(800)
              );
              return await getDocs(q);
            } catch {
              const q = query(collection(db, "i130Approvals"), where("formType", "==", "I-130"), limit(800));
              const s = await getDocs(q);
              return { ...s, docs: [...s.docs].sort((a, b) => {
                const ac = a.data().createdAt?.toDate?.() || new Date(0);
                const bc = b.data().createdAt?.toDate?.() || new Date(0);
                return bc.getTime() - ac.getTime();
              }) } as any;
            }
          })(),
          (async () => {
            try {
              const q = query(
                collection(db, "i129fApprovals"),
                where("formType", "==", "I-129F"),
                orderBy("createdAt", "desc"),
                limit(800)
              );
              return await getDocs(q);
            } catch {
              const q = query(collection(db, "i129fApprovals"), where("formType", "==", "I-129F"), limit(800));
              const s = await getDocs(q);
              return { ...s, docs: [...s.docs].sort((a, b) => {
                const ac = a.data().createdAt?.toDate?.() || new Date(0);
                const bc = b.data().createdAt?.toDate?.() || new Date(0);
                return bc.getTime() - ac.getTime();
              }) } as any;
            }
          })(),
        ]);

        const grid: Record<string, number> = {};
        for (let d = 0; d < 7; d++) {
          for (let w = 0; w < 5; w++) {
            grid[`${d}-${w}`] = 0;
          }
        }

        const processDoc = (doc: QueryDocumentSnapshot, getDate: (data: any) => Date | null) => {
          const data = doc.data();
          const date = getDate(data);
          if (!date || isNaN(date.getTime())) return;
          const day = date.getDay();
          const dayOfMonth = date.getDate();
          const week = Math.min(Math.floor((dayOfMonth - 1) / 7), 4);
          grid[`${day}-${week}`] = (grid[`${day}-${week}`] || 0) + 1;
        };

        i130Snap.docs.forEach((doc: QueryDocumentSnapshot) => {
          const data = doc.data();
          const ad = data.approvalDate?.toDate?.() || (data.approvalDate ? new Date(data.approvalDate) : null);
          processDoc(doc, () => ad);
        });
        i129fSnap.docs.forEach((doc: QueryDocumentSnapshot) => {
          const data = doc.data();
          const n2 = data.noa2?.toDate?.() || data.noa2?.seconds ? new Date(data.noa2.seconds * 1000) : (data.noa2 ? new Date(data.noa2) : null);
          processDoc(doc, () => n2);
        });

        const result: HeatmapCell[] = [];
        let m = 1;
        for (let d = 0; d < 7; d++) {
          for (let w = 0; w < 5; w++) {
            const c = grid[`${d}-${w}`] || 0;
            m = Math.max(m, c);
            result.push({
              day: d,
              week: w,
              count: c,
              label: `${DAYS[d]} ${WEEKS[w]}`,
            });
          }
        }
        setCells(result);
        setMaxCount(m);
      } catch (error) {
        console.error("Error loading heatmap:", error);
        setCells([]);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const getColor = (count: number) => {
    if (count === 0) return "var(--bg-surface-alt)";
    const intensity = Math.min(1, count / maxCount);
    const hue = 220;
    const sat = 70;
    const light = 95 - intensity * 45;
    return `hsl(${hue}, ${sat}%, ${light}%)`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--uscis-blue)]/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">
              Approval Heatmap
            </h3>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">
              Day of week vs week of month. Darker = more approvals.
            </p>
          </div>
        </div>
      </div>

      <div className="uscis-card p-3 sm:p-4 w-full">
        {loading ? (
          <div className="h-32 sm:h-36 flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--uscis-blue)]"></div>
          </div>
        ) : cells.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center">
            <svg className="w-12 h-12 text-[var(--text-tertiary)] mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm font-medium text-[var(--text-primary)]">No data yet</p>
            <p className="text-xs text-[var(--text-secondary)]">Heatmap will appear once approval data is available.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Rows = days, Cols = weeks */}
            <div className="overflow-x-auto">
              <table className="w-full max-w-md border-collapse mx-auto">
                <thead>
                  <tr>
                    <th className="text-[9px] sm:text-[10px] font-semibold text-[var(--text-secondary)] text-left py-0.5 pr-1.5 w-7">Day</th>
                    {WEEKS.map((w) => (
                      <th key={w} className="text-[9px] sm:text-[10px] font-semibold text-[var(--text-secondary)] text-center py-0.5 px-0">
                        {w}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map((dayName, dIdx) => (
                    <tr key={dIdx}>
                      <td className="text-[8px] sm:text-[9px] font-medium text-[var(--text-secondary)] py-0.5 pr-1.5">
                        {dayName}
                      </td>
                      {WEEKS.map((_, wIdx) => {
                        const cell = cells.find((c) => c.day === dIdx && c.week === wIdx);
                        const count = cell?.count ?? 0;
                        return (
                          <td key={wIdx} className="p-0.5">
                            <div
                              className="aspect-square min-w-[14px] sm:min-w-[18px] rounded-md flex items-center justify-center text-[7px] sm:text-[8px] font-semibold transition-all hover:scale-105 border border-[var(--border-color)]/20"
                              style={{
                                backgroundColor: getColor(count),
                                color: count > maxCount * 0.5 ? "white" : "var(--text-primary)",
                              }}
                              title={`${dayName} week ${wIdx + 1}: ${count} approvals`}
                            >
                              {count > 0 ? count : ""}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-end gap-1.5 text-[9px] sm:text-[10px] text-[var(--text-secondary)] pt-1.5 border-t border-[var(--border-color)]">
              <span>Less</span>
              <div className="flex gap-0.5">
                {[0, 0.25, 0.5, 0.75, 1].map((p) => (
                  <div
                    key={p}
                    className="w-2.5 h-2.5 sm:w-3 sm:h-2.5 rounded"
                    style={{ backgroundColor: getColor(Math.round(p * maxCount)) }}
                  />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
