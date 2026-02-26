"use client";

import { SystemMonthlyStats } from "@/lib/types";
import { formatNumber } from "@/lib/calculations/formatting";

interface SnapshotGridProps {
  currentMonthStats: SystemMonthlyStats | null;
  previousMonthStats: SystemMonthlyStats | null;
  avgProcessingTime: number | null;
}

export default function SnapshotGrid({
  currentMonthStats,
  previousMonthStats,
  avgProcessingTime,
}: SnapshotGridProps) {
  // Calculate values (matching iOS format)
  const i130Pending = "879k+"; // TODO: Calculate from actual pending cases
  const immigrationBacklog = "11.3M+"; // TODO: Use system-wide estimate if available

  const snapshots = [
    {
      icon: "doc.text",
      title: "I-130 Pending",
      value: i130Pending,
      color: "blue",
    },
    {
      icon: "exclamationmark.triangle",
      title: "Immigration Backlog",
      value: immigrationBacklog,
      color: "red",
    },
  ];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "doc.text":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        );
      case "exclamationmark.triangle":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        );
      case "checkmark.seal":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case "calendar.badge.clock":
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case "blue":
        return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-gray-800 dark:text-gray-200";
      case "red":
        return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400";
      case "green":
        return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400";
      default:
        return "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
            <svg
              className="w-5 h-5 text-white"
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
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">System Overview</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Current system activity at a glance
            </p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {snapshots.map((snapshot, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border ${getColorClasses(snapshot.color)}`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${getColorClasses(snapshot.color)}`}>
                  {getIcon(snapshot.icon)}
                </div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {snapshot.title}
                </p>
              </div>
              <p className="text-2xl font-bold">{snapshot.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
