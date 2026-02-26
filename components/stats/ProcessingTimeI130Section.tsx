"use client";

import { useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { getProcessingTimeDistribution } from "@/lib/statsService";
import { ProcessingTimeDistribution } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { differenceInDays } from "date-fns";

export default function ProcessingTimeI130Section() {
  const { profile } = useProfile();
  const [distribution, setDistribution] = useState<ProcessingTimeDistribution | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Calculate user's case age
  const userCaseAge = profile?.priorityDate 
    ? Math.floor(differenceInDays(new Date(), new Date(profile.priorityDate)))
    : null;

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const dist = await getProcessingTimeDistribution("I-130");
        setDistribution(dist);
      } catch (error) {
        console.error("Error loading processing time distribution:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Create histogram data from distribution
  const chartData = distribution
    ? [
        { range: distribution.range, count: distribution.count },
        // Add more ranges if available
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Section Header - More Impactful */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center shadow-md flex-shrink-0">
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
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1">
              How Long Do I-130 Cases Actually Take?
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2">
              See how long others waited. {userCaseAge !== null && `Your case is ${userCaseAge} days old - see where you fit below.`}
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-3 rounded-lg">
              <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">⏱️ Simple Explanation:</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                See the fastest, slowest, and average wait times. {userCaseAge !== null && `The red line shows your case age (${userCaseAge} days) so you know where you are.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Simple Legend - Compact */}
      {distribution && (
        <div className="hidden lg:block bg-[var(--bg-surface-alt)] border border-[var(--border-color)] p-3 rounded-lg">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div><strong>Average:</strong> {distribution.average} days</div>
            <div><strong>Median:</strong> {distribution.median} days</div>
            <div><strong>Min:</strong> {distribution.min} days</div>
            <div><strong>Max:</strong> {distribution.max} days</div>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      {distribution && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-[var(--bg-surface-alt)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)] mb-1">Average</p>
            <p className="text-2xl font-bold">{distribution.average} days</p>
          </div>
          <div className="p-4 bg-[var(--bg-surface-alt)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)] mb-1">Median</p>
            <p className="text-2xl font-bold">{distribution.median} days</p>
          </div>
          <div className="p-4 bg-[var(--bg-surface-alt)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)] mb-1">Min</p>
            <p className="text-2xl font-bold">{distribution.min} days</p>
          </div>
          <div className="p-4 bg-[var(--bg-surface-alt)] rounded-lg">
            <p className="text-xs text-[var(--text-secondary)] mb-1">Max</p>
            <p className="text-2xl font-bold">{distribution.max} days</p>
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="uscis-card">
        <div className="p-6">
          {loading && (
            <div className="h-64 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--uscis-blue)]"></div>
                <p className="text-sm text-[var(--text-secondary)]">Loading I-130 processing time data...</p>
              </div>
            </div>
          )}
          {!loading && !distribution && (
            <div className="h-64 flex flex-col items-center justify-center space-y-3">
              <svg className="w-12 h-12 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Processing Time Data Coming Soon</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  We're collecting I-130 processing time data. Check back soon to see how long cases typically take!
                </p>
              </div>
            </div>
          )}
          {!loading && distribution && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)] text-center">
                Most common range: {distribution.range} days ({distribution.count} cases)
              </p>
              <div className="w-full min-w-0" style={{ height: '280px' }}>
                <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 15, right: 20, left: 10, bottom: 40 }}>
                  <defs>
                    <linearGradient id="processingGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3B82F6" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#1E40AF" stopOpacity={0.9}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
                  <XAxis 
                    dataKey="range" 
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                    axisLine={{ stroke: "var(--border-color)" }}
                    tickLine={{ stroke: "var(--border-color)" }}
                    label={{ 
                      value: "Days to Approval", 
                      position: "insideBottom", 
                      offset: -5, 
                      style: { fontSize: 11, fill: "var(--text-secondary)", fontWeight: 500 } 
                    }} 
                  />
                  <YAxis 
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                    width={55}
                    axisLine={{ stroke: "var(--border-color)" }}
                    tickLine={{ stroke: "var(--border-color)" }}
                    label={{ 
                      value: "Cases", 
                      angle: -90, 
                      position: "insideLeft", 
                      style: { fontSize: 11, fill: "var(--text-secondary)", fontWeight: 500 } 
                  }}
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
                    wrapperStyle={{
                      zIndex: 1000,
                    }}
                    formatter={(value: any) => value}
                    separator=""
                  />
                <Bar 
                  dataKey="count"
                    fill="url(#processingGradient)" 
                    name="Cases"
                    radius={[8, 8, 0, 0]}
                    isAnimationActive={true}
                    animationDuration={600}
                  />
                  {userCaseAge !== null && distribution && (
                    <ReferenceLine 
                      x={`${Math.floor(userCaseAge / 50) * 50}-${Math.floor(userCaseAge / 50) * 50 + 50}`}
                      stroke="#DC2626" 
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      label={{ 
                        value: `Your case: ${userCaseAge} days`, 
                        position: "top", 
                        fill: "#DC2626", 
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
