"use client";

import React, { useEffect, useState } from "react";
import { VisaPauseService, CountryRecoveryData } from "@/lib/services/visaPauseService";
import { normalizeCountryForPause } from "@/lib/data/visaPauseCountries";

interface EmbassyInsightsProps {
  country: string;
}

export default function EmbassyInsights({ country }: EmbassyInsightsProps) {
  const [countryData, setCountryData] = useState<CountryRecoveryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEmbassyData() {
      try {
        const countryForQuery = normalizeCountryForPause(country) ?? country;
        const data = await VisaPauseService.getCountryRecoveryData(countryForQuery);
        setCountryData(data);
      } catch (error) {
        console.error("Error loading embassy insights:", error);
      } finally {
        setLoading(false);
      }
    }
    loadEmbassyData();
  }, [country]);

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
        <div className="animate-pulse">
          <div className="h-6 w-48 bg-[var(--bg-surface-alt)] rounded mb-4"></div>
          <div className="h-4 w-full bg-[var(--bg-surface-alt)] rounded mb-2"></div>
        </div>
      </div>
    );
  }

  if (!countryData) {
    return (
      <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--uscis-blue)] shadow-sm">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="text-lg font-bold text-[var(--text-primary)]">
            Embassy insights
          </h3>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          We don’t yet have enough embassy-level data for {country}. Your case is still included in the global recovery metrics above. As more approvals come in for your embassy, we’ll show detailed numbers here.
        </p>
      </div>
    );
  }

  const displayCountry = normalizeCountryForPause(country) ?? country ?? "Unknown";

  const getEmbassyName = (c: string) => {
    const embassyMap: Record<string, string> = {
      Pakistan: "Islamabad Embassy",
      Bangladesh: "Dhaka Embassy",
      Nigeria: "Lagos Embassy",
      Nepal: "Kathmandu Embassy",
      India: "New Delhi Embassy",
      Brazil: "Rio de Janeiro Embassy",
      Egypt: "Cairo Embassy",
      Colombia: "Bogotá Embassy",
    };
    return embassyMap[c] || `${c} Embassy`;
  };

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--uscis-blue)] shadow-sm">
          <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className="text-lg font-bold text-[var(--text-primary)]">
          {getEmbassyName(displayCountry)}
        </h3>
      </div>

      <div className="space-y-4">
        {/* Processing Capacity */}
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-[var(--text-secondary)]">Processing Capacity</span>
            <span className="text-lg font-bold text-[var(--text-primary)]">
              {countryData.recoveryRate}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-surface)]">
            <div
              className="h-full bg-[var(--uscis-blue)] transition-all duration-500"
              style={{ width: `${countryData.recoveryRate}%` }}
            ></div>
          </div>
        </div>

        {/* Processing Times */}
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Pre-Pause</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {countryData.prePauseProcessingDays} days
            </div>
          </div>
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4">
            <div className="text-xs text-[var(--text-secondary)] mb-1">Current</div>
            <div className="text-lg font-bold text-[var(--text-primary)]">
              {countryData.currentProcessingDays} days
            </div>
          </div>
        </div>

        {/* Delay Increase */}
        {countryData.delayIncrease > 0 && (
          <div className="rounded-lg border border-[var(--uscis-blue)]/30 bg-[var(--uscis-blue)]/10 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--text-primary)]">Additional Delay</span>
              <span className="text-xl font-bold text-[var(--text-primary)]">
                +{countryData.delayIncrease} days
              </span>
            </div>
          </div>
        )}

        {/* Cases Affected */}
        <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface-alt)] p-4">
          <div className="text-xs text-[var(--text-secondary)] mb-1">Estimated Cases Affected</div>
          <div className="text-lg font-bold text-[var(--text-primary)]">
            ~{countryData.casesAffected.toLocaleString()}
          </div>
        </div>

        {/* Weekly Change */}
        {countryData.weeklyChange !== 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-[var(--bg-surface-alt)] px-3 py-2">
            <svg
              className="h-4 w-4 text-[var(--text-primary)]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={
                  countryData.weeklyChange > 0
                    ? "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    : "M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                }
              />
            </svg>
            <span className="text-sm text-[var(--text-secondary)]">
              {countryData.weeklyChange > 0 ? "+" : ""}
              {countryData.weeklyChange}% recovery this week
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
