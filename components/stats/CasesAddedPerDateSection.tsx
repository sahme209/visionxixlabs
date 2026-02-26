"use client";

import { useEffect, useState } from "react";
import {
  casesAddedPerDateService,
  CasesAddedDataPoint,
} from "@/lib/services/casesAddedPerDateService";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

type FormType = "all" | "I-130" | "I-129F";

export default function CasesAddedPerDateSection() {
  const [dataPoints, setDataPoints] = useState<CasesAddedDataPoint[]>([]);
  const [selectedFormType, setSelectedFormType] = useState<FormType>("all");
  const [isLoading, setIsLoading] = useState(true);
  const [daysBack, setDaysBack] = useState<7 | 30 | 90>(30);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        let data: CasesAddedDataPoint[];
        if (selectedFormType === "all") {
          data = await casesAddedPerDateService.getCombinedCasesAddedPerDate(daysBack);
        } else {
          data = await casesAddedPerDateService.getCasesAddedPerDate(
            selectedFormType,
            daysBack
          );
        }
        setDataPoints(data);
      } catch (error) {
        console.error("Error loading cases added data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [selectedFormType, daysBack]);

  const chartData = dataPoints.map((point) => ({
    date: point.displayDate,
    count: point.count,
  }));

  const totalCases = dataPoints.reduce((sum, point) => sum + point.count, 0);
  const avgPerDay =
    dataPoints.length > 0 ? totalCases / dataPoints.length : 0;
  const peakDay = Math.max(...dataPoints.map((p) => p.count), 0);

  // Get gradient colors for bars
  const getBarColor = (index: number, total: number) => {
    const ratio = index / total;
    const hue = 200 + ratio * 20; // Blue gradient (removed cyan)
    return `hsl(${hue}, 70%, 50%)`;
  };

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6">
      {/* Section Header */}
      <div className="space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl bg-gradient-to-br from-[var(--uscis-blue)] via-[var(--uscis-blue-dark)] to-[var(--uscis-blue)] flex items-center justify-center shadow-lg flex-shrink-0">
            <svg
              className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white"
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
          <div className="flex-1 min-w-0">
            <h3 className="text-sm sm:text-base md:text-lg font-bold text-[var(--text-primary)] mb-0.5 sm:mb-1">
              <span className="hidden sm:inline">Cases Added Per Day</span>
              <span className="sm:hidden">Cases Added</span>
            </h3>
            <p className="text-[10px] sm:text-xs md:text-sm text-[var(--text-secondary)] leading-relaxed">
              <span className="hidden sm:inline">
                See how many cases were added each day. This shows the growth of
                our database.
              </span>
              <span className="sm:hidden">Daily case additions</span>
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-3">
        {/* Form Type Selector */}
        <div className="flex gap-2">
          {(["all", "I-130", "I-129F"] as FormType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedFormType(type)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                selectedFormType === type
                  ? "bg-blue-500 text-white shadow-md"
                  : "bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]"
              }`}
            >
              {type === "all" ? "All Forms" : type}
            </button>
          ))}
        </div>

        {/* Days Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-[var(--text-secondary)]">Time Period:</span>
          <select
            value={daysBack}
            onChange={(e) => setDaysBack(Number(e.target.value) as 7 | 30 | 90)}
            className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--bg-surface)] text-xs sm:text-sm text-[var(--text-primary)] border border-[var(--border-color)]"
          >
            <option value={7}>7 Days</option>
            <option value={30}>30 Days</option>
            <option value={90}>90 Days</option>
          </select>
        </div>
      </div>

      {/* Chart or Loading/Empty State */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-[var(--text-secondary)]">Loading data...</p>
        </div>
      ) : dataPoints.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <svg
            className="w-16 h-16 text-[var(--text-tertiary)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <div className="text-center space-y-2">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              No data available
            </p>
            <p className="text-xs text-[var(--text-secondary)]">
              Cases will appear here as they are added to the system.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Chart */}
          <div className="bg-[var(--bg-surface)] rounded-xl p-5 border border-[var(--border-color)] shadow-sm">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData} margin={{ top: 15, right: 15, left: 5, bottom: 50 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3B82F6" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#1E40AF" stopOpacity={0.8}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  angle={-45}
                  textAnchor="end"
                  height={70}
                  interval="preserveStartEnd"
                  axisLine={{ stroke: "var(--border-color)" }}
                  tickLine={{ stroke: "var(--border-color)" }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "var(--text-secondary)" }}
                  width={55}
                  axisLine={{ stroke: "var(--border-color)" }}
                  tickLine={{ stroke: "var(--border-color)" }}
                  label={{
                    value: "Cases Added",
                    angle: -90,
                    position: "insideLeft",
                    style: { textAnchor: "middle", fill: "var(--text-secondary)", fontSize: 11, fontWeight: 500 },
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
                  radius={[8, 8, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={600}
                  animationEasing="ease-out"
                >
                  {chartData.map((entry, index) => {
                    const maxCount = Math.max(...chartData.map(d => d.count), 1);
                    const intensity = entry.count / maxCount;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={intensity > 0.7 ? "#1E40AF" : intensity > 0.4 ? "#3B82F6" : "#60A5FA"}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <StatBox
              title="Total Cases"
              value={totalCases.toString()}
              icon="number"
              color="blue"
            />
            <StatBox
              title="Avg Per Day"
              value={avgPerDay.toFixed(1)}
              icon="trend"
              color="green"
            />
            <StatBox
              title="Peak Day"
              value={peakDay.toString()}
              icon="peak"
              color="purple"
            />
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: string;
  icon: string;
  color: string;
}) {
  const iconMap: Record<string, string> = {
    number: "🔢",
    trend: "📈",
    peak: "⬆️",
  };

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/10 text-gray-800 dark:text-gray-200",
    green: "bg-green-500/10 text-green-600 dark:text-green-400",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  return (
    <div
      className={`p-3 rounded-lg ${colorClasses[color]} flex flex-col items-center space-y-1`}
    >
      <span className="text-lg">{iconMap[icon]}</span>
      <p className="text-base sm:text-lg font-bold">{value}</p>
      <p className="text-[10px] sm:text-xs font-medium opacity-80">{title}</p>
    </div>
  );
}
