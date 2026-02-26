"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { loadUserProfile, UserProfile } from "@/lib/services/profileService";
import { isCountryAffectedByPause } from "@/lib/data/visaPauseCountries";
import VisaPauseImpactCenter from "@/components/visa-pause/VisaPauseImpactCenter";
import RedditPauseFeed from "@/components/visa-pause/RedditPauseFeed";
import ClinicVRubioCase from "@/components/visa-pause/ClinicVRubioCase";
import VisaPauseDetailSections from "@/components/visa-pause/VisaPauseDetailSections";
import CardContainer from "@/components/CardContainer";
import Link from "next/link";

function PageHeader({ subtitle }: { subtitle?: React.ReactNode }) {
  return (
    <div className="surface-dark relative bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
      <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
      <CardContainer className="py-6 sm:py-8">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center flex-shrink-0">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex flex-wrap items-center gap-2" style={{ color: "var(--color-accent)" }}>
              CLINIC v. Rubio
              <span>|</span>
              Visa Pause Impact
            </h1>
            {subtitle && <p className="text-sm text-white/90 mt-1">{subtitle}</p>}
          </div>
        </div>
      </CardContainer>
    </div>
  );
}

export default function VisaPauseImpactPage() {
  const { user, loading: loadingAuth } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function loadData() {
      if (loadingAuth) return;

      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userProfile = await loadUserProfile(user.uid);
        setProfile(userProfile);
        if (userProfile && !isCountryAffectedByPause(userProfile.country)) {
          router.push("/");
          return;
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, loadingAuth, router]);

  if (loadingAuth || (user && loading)) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <PageHeader subtitle="Loading…" />
        <CardContainer className="py-12">
          <div className="flex items-center justify-center min-h-[40vh]">
            <div className="h-10 w-10 border-2 border-[var(--uscis-blue)]/30 border-t-[var(--uscis-blue)] rounded-full animate-spin" />
          </div>
        </CardContainer>
      </div>
    );
  }

  // Not logged in: show case updates + sign-in CTA (no login required)
  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <PageHeader subtitle="Case updates, recovery, and how the visa pause affects affected countries." />
        <CardContainer className="py-6 sm:py-8 space-y-8">
          <VisaPauseDetailSections />
          <ClinicVRubioCase />
          <RedditPauseFeed />
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-6 sm:p-8 text-center max-w-xl mx-auto">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">See your personal impact</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-5">
              Sign in to see delay, recovery timeline, and approval window for your case and country.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-5 py-2.5 font-semibold hover:bg-[var(--uscis-blue-dark)] transition-colors text-white hover:text-white"
              style={{ color: "#fff" }}
            >
              Sign in
            </Link>
          </div>
        </CardContainer>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <PageHeader subtitle="Your case and country are required to show impact." />
        <CardContainer className="py-12">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-8 text-center max-w-lg mx-auto">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Complete your profile</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              Add your priority date and country so we can show how the visa pause affects your timeline.
            </p>
            <Link
              href="/profile-setup"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-5 py-2.5 text-white font-semibold hover:bg-[var(--uscis-blue-dark)] transition-colors"
            >
              Complete profile
            </Link>
          </div>
        </CardContainer>
      </div>
    );
  }

  if (!isCountryAffectedByPause(profile.country)) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)]">
        <PageHeader subtitle="Impact analysis for affected countries only." />
        <CardContainer className="py-12">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-8 text-center max-w-lg mx-auto">
            <h2 className="text-lg font-bold text-[var(--text-primary)] mb-2">Not available for your country</h2>
            <p className="text-sm text-[var(--text-secondary)] mb-6">
              This tool is for countries currently affected by the visa pause. Your dashboard and stats still show your normal timeline.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--uscis-blue)] px-5 py-2.5 text-white font-semibold hover:bg-[var(--uscis-blue-dark)] transition-colors"
            >
              Back to dashboard
            </Link>
          </div>
        </CardContainer>
      </div>
    );
  }

  const priorityDate = profile.priorityDate
    ? new Date(profile.priorityDate)
    : new Date();

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <PageHeader
        subtitle={
          <>
            Delay, recovery, and a realistic approval window for <span className="font-semibold">{profile.country}</span>.
          </>
        }
      />
      <CardContainer className="py-6 sm:py-8 space-y-8">
        <VisaPauseDetailSections />
        <VisaPauseImpactCenter
          formType={profile.formType}
          priorityDate={priorityDate}
          country={profile.country}
        />
      </CardContainer>
    </div>
  );
}
