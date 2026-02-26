"use client";

import Link from "next/link";
import Image from "next/image";
import { QueuePositionEngine } from "@/lib/calculations/queuePosition";
import { HERO_IMAGES } from "@/lib/images";

export default function QueuePositionPage() {
  // Example calculation - in real app, get from user profile
  const result = QueuePositionEngine.calculateQueuePosition(
    new Date("2024-06-15"),
    new Date("2024-09-14"),
    "I-130",
    "Consular"
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.office} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
          <h1 className="text-2xl font-bold text-white">Queue Position & Forecast</h1>
          <p className="text-sm text-white/90 mt-1">
            Where you stand in line and what to expect—from real data
          </p>
        </div>
      </div>
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        <div className="uscis-card">
          <div className="p-6">
            {result ? (
              <div className="space-y-6">
                <div className="text-center py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="text-4xl font-bold text-[var(--text-primary)] mb-2">
                    #{result.position?.toLocaleString()}
                  </div>
                  {result.positionRange && (
                    <p className="text-sm text-[var(--text-secondary)]">
                      Range: #{result.positionRange.min.toLocaleString()} - #{result.positionRange.max.toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Days Remaining</p>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">
                      {result.daysRemaining}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[var(--text-secondary)] mb-1">Confidence</p>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">
                      {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)}
                    </p>
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <p className="text-sm text-[var(--text-primary)]">{result.context}</p>
                </div>
              </div>
            ) : (
              <p className="text-[var(--text-secondary)] text-center py-8">
                Complete your profile to see your queue position.
              </p>
            )}
            <div className="mt-6">
              <Link href="/" className="uscis-link text-sm font-semibold">
                ← Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

