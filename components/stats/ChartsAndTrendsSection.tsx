"use client";

import React from "react";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ChartBarIcon, ClockIcon, CalendarIcon } from "@heroicons/react/24/outline";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import {
  getTrends,
  getPDStats,
  getRFEStats,
  getCalendarApprovals,
  getCurrentMonth,
} from "@/lib/statsService";
import { buildScopeId, scopeFromProfile } from "@/lib/types";
import { TrendsData, PDStats, RFEStats, CalendarApprovals } from "@/lib/types";

export default function ChartsAndTrendsSection() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const profileRef = doc(db, "userProfiles", user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setProfile(profileSnap.data());
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  if (loading) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
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
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Charts & Trends (Simple)
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              The bigger picture - where you fit in the journey
            </p>
          </div>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Simple charts to help you understand what's happening. Think of these like picture books - easy to read, easy to understand.
        </p>
      </div>

      {/* Chart A: Faster or slower? */}
      <FasterOrSlowerChart profile={profile} />

      {/* Chart B: Your PD vs Latest Approved PD */}
      <PDProgressChart profile={profile} />

      {/* Chart C: ETA trend */}
      <ETATrendChart profile={profile} />

      {/* Chart D: Service centers comparison */}
      <ServiceCentersChart />

      {/* Chart E: RFE simple risk */}
      <RFERiskChart profile={profile} />

      {/* Chart F: Monthly approvals calendar */}
      <MonthlyCalendarChart />
    </div>
  );
}

// CHART A: Faster or slower? (Line Chart)
function FasterOrSlowerChart({ profile }: { profile: any }) {
  const [userScopeData, setUserScopeData] = useState<TrendsData | null>(null);
  const [allScopeData, setAllScopeData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        // Load user scope data
        if (profile) {
          const scope = scopeFromProfile(profile.formType, profile.serviceCenter, profile.country);
          const scopeId = buildScopeId(scope);
          const userData = await getTrends(scopeId);
          setUserScopeData(userData);
        }

        // Load all scope data
        const allData = await getTrends("all");
        setAllScopeData(allData);
      } catch (error) {
        console.error("Error loading trends data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile]);

  if (loading || !userScopeData || !allScopeData) {
    return null;
  }

  // Filter last 30 days and combine data
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const userPoints = userScopeData.approvalsPerDayPoints
    .filter((p) => new Date(p.date) >= thirtyDaysAgo)
    .map((p) => ({ date: p.date, user: p.count, all: 0 }));
  
  const allPoints = allScopeData.approvalsPerDayPoints
    .filter((p) => new Date(p.date) >= thirtyDaysAgo)
    .map((p) => ({ date: p.date, user: 0, all: p.count }));

  // Merge data
  const dateMap = new Map<string, { date: string; user: number; all: number }>();
  userPoints.forEach((p) => dateMap.set(p.date, { ...p, all: dateMap.get(p.date)?.all || 0 }));
  allPoints.forEach((p) => {
    const existing = dateMap.get(p.date) || { date: p.date, user: 0, all: 0 };
    dateMap.set(p.date, { ...existing, all: p.all });
  });

  const chartData = Array.from(dateMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      date: format(new Date(p.date), "MMM d"),
      user: p.user,
      all: p.all,
    }));

  if (chartData.length < 7) {
    return null; // Hide if < 7 points
  }

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Faster or slower?</h3>
          <span className="text-xs font-medium text-gray-800 dark:text-gray-200 bg-blue-100 px-2 py-1 rounded">
            (I-130)
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Are I-130 cases like yours being processed faster or slower than average?
        </p>
      </div>
      <div className="p-6 min-w-0">
        <div className="w-full" style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
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
              <Legend />
              <Line
                type="monotone"
                dataKey="user"
                name="Cases like yours"
                stroke="#0071e3"
                strokeWidth={2}
                dot={{ fill: "#0071e3", r: 4 }}
              />
              <Line
                type="monotone"
                dataKey="all"
                name="All cases"
                stroke="#94a3b8"
                strokeWidth={2}
                dot={{ fill: "#94a3b8", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-4 text-center flex items-center justify-center gap-1">
          <ChartBarIcon className="w-3 h-3" /> This shows if cases similar to yours (blue) are moving faster or slower than all cases (gray)
        </p>
      </div>
    </div>
  );
}

// CHART B: Your PD vs Latest Approved PD (Progress/Gauge)
function PDProgressChart({ profile }: { profile: any }) {
  const [pdStats, setPdStats] = useState<PDStats | null>(null);
  const [userPD, setUserPD] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!profile || !profile.priorityDate) {
        setLoading(false);
        return;
      }

      try {
        setUserPD(profile.priorityDate);
        const scope = scopeFromProfile(profile.formType, profile.serviceCenter, profile.country);
        const scopeId = buildScopeId(scope);
        const stats = await getPDStats(scopeId);
        setPdStats(stats);
      } catch (error) {
        console.error("Error loading PD stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile]);

  if (loading || !pdStats || !pdStats.latestApprovedPD || !userPD) {
    return null;
  }

  // Calculate progress (simplified - in real implementation, use proper date comparison)
  const parsePD = (pdString: string): number => {
    try {
      const date = new Date(pdString);
      return date.getTime();
    } catch {
      return 0;
    }
  };

  const userPDTime = parsePD(userPD);
  const latestPDTime = parsePD(pdStats.latestApprovedPD);
  
  // Simple progress calculation (0-100%)
  const progress = userPDTime >= latestPDTime ? 100 : Math.max(0, Math.min(100, (userPDTime / latestPDTime) * 100));

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Your PD vs Latest Approved PD</h3>
          <span className="text-xs font-medium text-gray-800 dark:text-gray-200 bg-blue-100 px-2 py-1 rounded">
            (I-130)
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          How close is your I-130 priority date to being processed?
        </p>
      </div>
      <div className="p-6">
        <div className="flex flex-col items-center justify-center space-y-4">
          {/* Circular Progress (simplified - using div with border) */}
          <div className="relative w-48 h-48">
            <svg className="transform -rotate-90 w-48 h-48">
              <circle
                cx="96"
                cy="96"
                r="80"
                stroke="var(--bg-surface-alt)"
                strokeWidth="16"
                fill="none"
              />
              <circle
                cx="96"
                cy="96"
                r="80"
                stroke="#0071e3"
                strokeWidth="16"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 80}`}
                strokeDashoffset={`${2 * Math.PI * 80 * (1 - progress / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl font-bold text-[var(--text-primary)]">
                  {Math.round(progress)}%
                </div>
                <div className="text-xs text-[var(--text-secondary)]">Progress</div>
              </div>
            </div>
          </div>
          <div className="text-center space-y-2">
            <div className="text-sm">
              <span className="text-[var(--text-secondary)]">Your PD: </span>
              <span className="font-semibold">{format(new Date(userPD), "MMM d, yyyy")}</span>
            </div>
            <div className="text-sm">
              <span className="text-[var(--text-secondary)]">Latest Approved: </span>
              <span className="font-semibold">{format(new Date(pdStats.latestApprovedPD), "MMM d, yyyy")}</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-4 text-center">
          🎯 This circle shows how close your priority date is to being processed. When it reaches 100%, your date is current!
        </p>
      </div>
    </div>
  );
}

// CHART C: ETA trend (Line Chart)
function ETATrendChart({ profile }: { profile: any }) {
  const [trendsData, setTrendsData] = useState<TrendsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!profile) {
        setLoading(false);
        return;
      }

      try {
        const scope = scopeFromProfile(profile.formType, profile.serviceCenter, profile.country);
        const scopeId = buildScopeId(scope);
        const data = await getTrends(scopeId);
        setTrendsData(data);
      } catch (error) {
        console.error("Error loading trends data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile]);

  if (loading || !trendsData || !trendsData.etaPoints || trendsData.etaPoints.length === 0) {
    return null;
  }

  // Filter last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const chartData = trendsData.etaPoints
    .filter((p) => new Date(p.date) >= thirtyDaysAgo)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((p) => ({
      date: format(new Date(p.date), "MMM d"),
      eta: p.etaDays,
    }));

  if (chartData.length < 7) {
    return null;
  }

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">ETA trend</h3>
          <span className="text-xs font-medium text-gray-800 dark:text-gray-200 bg-blue-100 px-2 py-1 rounded">
            (I-130)
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          How long until I-130 approval? (estimated)
        </p>
      </div>
      <div className="p-6 min-w-0">
        <div className="w-full" style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" label={{ value: "Days", angle: -90, position: "insideLeft" }} />
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
              <Line
                type="monotone"
                dataKey="eta"
                name="Days until approval"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ fill: "#10b981", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-4 text-center flex items-center justify-center gap-1">
          <ClockIcon className="w-3 h-3" /> This line shows how many days until approval. Going down = faster processing!
        </p>
      </div>
    </div>
  );
}

// CHART D: Service centers comparison (Bar Chart)
function ServiceCentersChart() {
  // Using mock data structure - replace with real service center stats
  const chartData = [
    { name: "California", days: 450 },
    { name: "Nebraska", days: 420 },
    { name: "Potomac", days: 480 },
    { name: "Texas", days: 440 },
  ];

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Service centers comparison</h3>
          <span className="text-xs font-medium text-gray-800 dark:text-gray-200 bg-blue-100 px-2 py-1 rounded">
            (I-130)
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Which office processes I-130 cases fastest?
        </p>
      </div>
      <div className="p-6 min-w-0">
        <div className="w-full" style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" label={{ value: "Days", angle: -90, position: "insideLeft" }} />
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
              <Bar dataKey="days" fill="#8b5cf6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-4 text-center flex items-center justify-center gap-1">
          <ChartBarIcon className="w-3 h-3" /> Shorter bars = faster processing. This shows which office finishes cases quickest.
        </p>
      </div>
    </div>
  );
}

// CHART E: RFE simple risk (Donut/Pie Chart)
function RFERiskChart({ profile }: { profile: any }) {
  const [rfeStats, setRfeStats] = useState<RFEStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!profile) {
        setLoading(false);
        return;
      }

      try {
        const scope = scopeFromProfile(profile.formType, profile.serviceCenter, profile.country);
        const scopeId = buildScopeId(scope);
        const stats = await getRFEStats(scopeId);
        if (stats && stats.cohortSize >= 20) {
          setRfeStats(stats);
        }
      } catch (error) {
        console.error("Error loading RFE stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [profile]);

  if (loading || !rfeStats) {
    return null;
  }

  const approvedWithRFE = rfeStats.rfeCount;
  const approvedWithoutRFE = rfeStats.cohortSize - rfeStats.rfeCount;

  const chartData = [
    { name: "Approved with RFE", value: approvedWithRFE, color: "#f59e0b" },
    { name: "Approved without RFE", value: approvedWithoutRFE, color: "#10b981" },
  ];

  const COLORS = ["#f59e0b", "#10b981"];

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">RFE simple risk</h3>
          <span className="text-xs font-medium text-gray-800 dark:text-gray-200 bg-blue-100 px-2 py-1 rounded">
            (I-130)
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          What are the chances you'll need to send more documents for I-130?
        </p>
      </div>
      <div className="p-6 min-w-0">
        <div className="w-full" style={{ height: '300px' }}>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
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
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-4 text-center">
          🎯 This pie shows how many cases like yours needed extra documents (orange) vs didn't (green)
        </p>
      </div>
    </div>
  );
}

// CHART F: Monthly approvals calendar (Calendar Heatmap)
function MonthlyCalendarChart() {
  const [calendarData, setCalendarData] = useState<CalendarApprovals | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const currentMonth = getCurrentMonth();
        const data = await getCalendarApprovals(currentMonth, "all");
        setCalendarData(data);
      } catch (error) {
        console.error("Error loading calendar data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  if (loading || !calendarData) {
    return null;
  }

  // Create a simple grid representation of the calendar
  const days = Object.keys(calendarData.days).sort();
  if (days.length === 0) {
    return null;
  }

  // Get max count for color intensity
  const maxCount = Math.max(...Object.values(calendarData.days));

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Monthly approvals calendar</h3>
          <span className="text-xs font-medium text-gray-800 dark:text-gray-200 bg-blue-100 px-2 py-1 rounded">
            (I-130)
          </span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Which days had the most I-130 approvals this month?
        </p>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const count = calendarData.days[day] || 0;
            const intensity = maxCount > 0 ? count / maxCount : 0;
            const bgColor = `rgba(0, 113, 227, ${0.2 + intensity * 0.8})`;

            return (
              <div
                key={day}
                className="aspect-square rounded flex items-center justify-center text-xs"
                style={{ backgroundColor: bgColor }}
                title={`${format(new Date(day), "MMM d")}: ${count} approvals`}
              >
                {format(new Date(day), "d")}
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>Less</span>
          <div className="flex gap-1">
            {[0, 0.25, 0.5, 0.75, 1].map((intensity) => (
              <div
                key={intensity}
                className="w-4 h-4 rounded"
                style={{ backgroundColor: `rgba(0, 113, 227, ${0.2 + intensity * 0.8})` }}
              />
            ))}
          </div>
          <span>More</span>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-4 text-center flex items-center justify-center gap-1">
          <CalendarIcon className="w-3 h-3" /> Darker days = more approvals. This calendar shows which days were busiest.
        </p>
      </div>
    </div>
  );
}
