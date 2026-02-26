"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getSystemMonthlyStats,
  getServiceCenterStats,
  getAverageProcessingTime,
  getCurrentMonth,
} from "@/lib/statsService";
import { SystemMonthlyStats, ServiceCenterStats } from "@/lib/types";
import SnapshotGrid from "./SnapshotGrid";
import RiskAssessmentCard from "./RiskAssessmentCard";

export default function SystemHealthAndRiskSection() {
  const { user } = useAuth();
  const [currentMonthStats, setCurrentMonthStats] = useState<SystemMonthlyStats | null>(null);
  const [previousMonthStats, setPreviousMonthStats] = useState<SystemMonthlyStats | null>(null);
  const [serviceCenters, setServiceCenters] = useState<ServiceCenterStats[]>([]);
  const [avgProcessingTime, setAvgProcessingTime] = useState<number | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Load user profile
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
      }
    }

    loadProfile();
  }, [user]);

  // Load stats data
  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        // Load current month stats
        const currentMonth = getCurrentMonth();
        const current = await getSystemMonthlyStats(currentMonth);
        setCurrentMonthStats(current);

        // Load previous month stats
        const prevDate = new Date();
        prevDate.setMonth(prevDate.getMonth() - 1);
        const prevMonth = new Intl.DateTimeFormat("en-CA", {
          year: "numeric",
          month: "2-digit",
        }).format(prevDate);
        const previous = await getSystemMonthlyStats(prevMonth);
        setPreviousMonthStats(previous);

        // Load service center stats
        const centers = await getServiceCenterStats();
        setServiceCenters(centers);

        // Load average processing time
        const avgTime = await getAverageProcessingTime("I-130");
        setAvgProcessingTime(avgTime);
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="uscis-card">
        <div className="uscis-card-header">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">System Health & Your Risks</h3>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-center gap-3 py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--uscis-blue)]"></div>
            <p className="text-sm text-[var(--text-secondary)]">Loading system health data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header - More Impactful */}
      <div className="space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 via-blue-500 to-purple-500 flex items-center justify-center shadow-lg">
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
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1">
              System Health & Your Risks
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              See the big picture: How many cases are pending, what's the backlog, and what it means for your case
            </p>
          </div>
        </div>
        
        {/* Helpful Info Box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-lg">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-gray-800 dark:text-gray-200 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">What This Shows</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                These numbers tell you how busy USCIS is and how many people are waiting. More pending cases means longer wait times. 
                This helps you understand if your wait might be longer or shorter than usual.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Snapshot Grid */}
      <SnapshotGrid
        currentMonthStats={currentMonthStats}
        previousMonthStats={previousMonthStats}
        avgProcessingTime={avgProcessingTime}
      />

      {/* Risk Assessment Card (only if user has profile) */}
      {profile && (
        <RiskAssessmentCard
          profile={profile}
          serviceCenters={serviceCenters}
          avgProcessingTime={avgProcessingTime}
        />
      )}
    </div>
  );
}
