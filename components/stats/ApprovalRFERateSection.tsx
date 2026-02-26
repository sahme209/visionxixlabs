"use client";

import React from "react";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { ExclamationTriangleIcon } from "@heroicons/react/24/solid";
import { RFEStats } from "@/lib/types";
import { getRFEStats, buildScopeId, scopeFromProfile } from "@/lib/statsService";
import SkeletonLoader from "@/components/SkeletonLoader";

export default function ApprovalRFERateSection() {
  const { user } = useAuth();
  const [rfeStats, setRfeStats] = useState<RFEStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Load profile
        const profileRef = doc(db, "userProfiles", user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          setProfile(profileData);

          // Build scope from profile
          const scope = scopeFromProfile(
            profileData.formType,
            profileData.serviceCenter,
            profileData.country
          );
          const scopeId = buildScopeId(scope);

          // Load RFE stats
          const stats = await getRFEStats(scopeId);
          if (stats && stats.cohortSize >= 20) {
            // Only show if we have sufficient sample size
            setRfeStats(stats);
          }
        }
      } catch (error) {
        console.error("Error loading RFE stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user]);

  if (loading) {
    return (
      <div className="uscis-card">
        <div className="uscis-card-header">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Approval & RFE Rate</h3>
        </div>
        <SkeletonLoader variant="card" />
      </div>
    );
  }

  if (!rfeStats || rfeStats.cohortSize < 20) {
    return null; // Hide if insufficient data
  }

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-start gap-4 mb-3">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500 via-red-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
            <ExclamationTriangleIcon className="w-7 h-7 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)] mb-1">
              Your RFE Risk Based on Similar Cases
            </h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-2">
              See what happened to other cases like yours. How many got RFEs? How many got approved?
            </p>
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-3 rounded-lg">
              <p className="text-xs font-semibold text-[var(--text-primary)] mb-1">📊 What RFE Means:</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                RFE = Request for Evidence. It means USCIS needs more information before they can approve your case. 
                This shows your chances based on similar cases.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">Cases Analyzed</p>
            <p className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-1">{rfeStats.cohortSize}</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">Similar cases to yours</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">RFE Requests</p>
            <p className="text-2xl font-bold text-red-600 mb-1">{rfeStats.rfeCount}</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">Cases that got RFEs</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">RFE Rate</p>
            <p className="text-2xl font-bold text-red-600 mb-1">
              {(rfeStats.rfeRate * 100).toFixed(1)}%
            </p>
            <p className="text-[10px] text-[var(--text-tertiary)]">Your estimated risk</p>
          </div>
        </div>

        {/* Powerful Explanation */}
        <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-900/20 border-l-4 border-red-500 p-4 rounded-lg shadow-sm">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-bold text-[var(--text-primary)] mb-2">What These Numbers Tell You</p>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mb-2">
                This analysis looks at cases similar to yours (same form type, service center, and country) and shows what happened:
              </p>
              <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 list-disc list-inside mb-2">
                <li><strong className="text-gray-800 dark:text-gray-200">Cases Analyzed</strong> = How many similar cases we looked at</li>
                <li><strong className="text-red-600 dark:text-red-400">RFE Requests</strong> = How many of those cases got RFEs</li>
                <li><strong className="text-red-600 dark:text-red-400">RFE Rate</strong> = Your estimated chance of getting an RFE (lower is better!)</li>
              </ul>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-2">
                <strong className="text-[var(--text-primary)]">Why This Matters:</strong> If the RFE rate is low (under 20%), 
                you're likely to get approved without needing to provide more information. If it's higher, you might want to be extra careful 
                with your initial submission. This helps you prepare and set realistic expectations.
              </p>
            </div>
          </div>
        </div>

        {rfeStats.cohortSize < 30 && (
          <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-l-4 border-orange-500">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-[var(--text-primary)] mb-0.5">Small Sample Size</p>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  We analyzed {rfeStats.cohortSize} similar cases. More data would make this estimate more accurate, 
                  but this still gives you a good idea of what to expect.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
