"use client";

import { useEffect, useState } from "react";
import { getQuietOffices } from "@/lib/statsService";
import { ServiceCenterStats } from "@/lib/types";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function QuietOfficesSection() {
  const [offices, setOffices] = useState<ServiceCenterStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const quiet = await getQuietOffices();
        setOffices(quiet);
      } catch (error) {
        console.error("Error loading quiet offices:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const chartData = offices
    .slice(0, 10) // Top 10
    .map((office) => ({
      name: office.name,
      days: office.daysSinceLastApproval || 0,
    }));

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
              Which Service Centers Have Been Quiet?
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2">
              See which offices haven't approved cases recently. Quiet offices might mean longer wait times.
            </p>
          </div>
        </div>
      </div>


      {/* Chart */}
      <div className="uscis-card">
        <div className="p-4 sm:p-6 -ml-2 sm:ml-0">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center gap-3 py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--uscis-blue)]"></div>
                <p className="text-sm text-[var(--text-secondary)]">Checking which service centers have been quiet...</p>
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-64 flex items-center justify-center">
              <div className="flex flex-col items-center justify-center space-y-3">
                <svg className="w-12 h-12 text-[var(--text-tertiary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-center">
                  <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Service Center Activity Data Coming Soon</p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    We're tracking which service centers have been quiet. This data will help you understand if your center is actively processing cases. Check back soon!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)] text-center">
                Smaller number = more recent activity
              </p>
              <div className="w-full" style={{ height: '350px' }}>
                <ResponsiveContainer width="100%" height={350}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 10, left: 60, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
                  <XAxis 
                    type="number" 
                    tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                    axisLine={{ stroke: "var(--border-color)" }}
                    tickLine={{ stroke: "var(--border-color)" }}
                    label={{ 
                      value: "Days Since Last Approval", 
                      position: "insideBottom", 
                      offset: -5, 
                      style: { fontSize: 11, fill: "var(--text-secondary)", fontWeight: 500 } 
                    }}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={60} 
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
                  dataKey="days"
                    radius={[0, 8, 8, 0]}
                    isAnimationActive={true}
                    animationDuration={600}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.days < 30 ? "#10B981" : entry.days < 60 ? "#F59E0B" : "#DC2626"}
                      />
                    ))}
                  </Bar>
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
