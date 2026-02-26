"use client";

import { useEffect, useState } from "react";
import { getMostActiveCenters } from "@/lib/statsService";
import { ServiceCenterStats } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export default function MostActiveCentersSection() {
  const [centers, setCenters] = useState<ServiceCenterStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const active = await getMostActiveCenters(30);
        setCenters(active);
      } catch (error) {
        console.error("Error loading most active centers:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const excludedNames = ["CSC", "Unknown"];
  const chartData = centers
    .filter((center) => !excludedNames.includes(center.name))
    .slice(0, 10)
    .map((center) => ({
      name: center.name,
      approvals: center.count,
    }));

  return (
    <div className="space-y-6">
      {/* Section Header - More Impactful */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 via-green-500 to-[var(--uscis-blue)] flex items-center justify-center shadow-lg flex-shrink-0">
            <svg
              className="w-7 h-7 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1">
              Which Service Centers Are Most Active?
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2">
              See which USCIS offices are approving the most I-130 cases. More active centers = faster processing.
            </p>
          </div>
        </div>
      </div>


      {/* Chart */}
      <div className="uscis-card">
        <div className="p-4 sm:p-6">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--uscis-blue)]"></div>
                <p className="text-sm text-[var(--text-secondary)]">Analyzing which service centers are most active...</p>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center space-y-3">
                <svg className="w-12 h-12 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Service Center Activity Data Coming Soon</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    We're tracking which service centers are most active. This data will show you which centers are approving the most cases. Check back soon!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full min-h-[350px] min-w-0">
              <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
              >
                <defs>
                  <linearGradient id="activeGradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.9}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
                <XAxis 
                  type="number" 
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  axisLine={{ stroke: "var(--border-color)" }}
                  tickLine={{ stroke: "var(--border-color)" }}
                  label={{ 
                    value: "Approvals (Last 30 Days)", 
                    position: "insideBottom", 
                    offset: -5, 
                    style: { fontSize: 11, fill: "var(--text-secondary)", fontWeight: 500 } 
                  }}
                />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={90} 
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  axisLine={{ stroke: "var(--border-color)" }}
                  tickLine={{ stroke: "var(--border-color)"                   }}
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
                  dataKey="approvals"
                  fill="url(#activeGradient)"
                  radius={[0, 8, 8, 0]}
                  isAnimationActive={true}
                  animationDuration={600}
                />
              </BarChart>
            </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
