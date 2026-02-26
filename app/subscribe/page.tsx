"use client";

import React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CheckIcon, SparklesIcon, ShieldCheckIcon, BoltIcon, MapIcon, ChartBarIcon, CalendarDaysIcon } from "@heroicons/react/24/solid";
import { HERO_IMAGES } from "@/lib/images";
import GradientIconBadge from "@/components/GradientIconBadge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";

/** Stripe Payment Link — direct checkout (configure success/cancel URLs in Stripe Dashboard) */
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/5kQ00ja0Bbbb47f6g79oc01";

const benefits = [
  { icon: BoltIcon, badgeColor: "amber" as const, title: "Expedite Request", description: "Request expedited processing with representative lookup and email generation" },
  { icon: MapIcon, badgeColor: "emerald" as const, title: "Action Plan", description: "Country-specific guidance for NVC, DQ, and Interview stages" },
  { icon: ChartBarIcon, badgeColor: "blue" as const, title: "Advanced Timeline", description: "Detailed processing timeline with stage-by-stage estimates" },
  { icon: ChartBarIcon, badgeColor: "emerald" as const, title: "Daily Approvals", description: "Real-time I-130 and I-129F approval tracking" },
  { icon: CalendarDaysIcon, badgeColor: "sky" as const, title: "Processing Times", description: "Current processing times for your service center and form type" },
  { icon: ChartBarIcon, badgeColor: "indigo" as const, title: "Statistics & Insights", description: "Processing stats and trends from real data—see how the system is moving" },
];

export default function SubscribePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { isSubscribed, loading: subscriptionLoading, hasUsedTrial } = useSubscription();

  // Users who already used trial should see "Subscribe" not "Start trial" - no trial option
  const eligibleForTrial = !hasUsedTrial;

  const handleSubscribe = async () => {
    if (!user) {
      alert("Please sign in to subscribe");
      router.push("/login");
      return;
    }
    // Use Stripe Payment Link — direct redirect to checkout
    window.location.href = STRIPE_PAYMENT_LINK;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)] overflow-x-hidden">
      {/* Premium Header - clean spacing on mobile */}
      <div className="surface-dark flex-shrink-0 relative bg-[var(--header-dark)] border-b border-white/10 shadow-sm overflow-hidden">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.passport} alt="" fill className="object-cover object-center opacity-15 w-full" sizes="100vw" priority />
          <div className="absolute inset-0 bg-[var(--header-dark)]/85" />
        </div>
        <div className="h-px bg-[var(--border-color)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-3 sm:py-4 w-full min-w-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <GradientIconBadge icon={SparklesIcon} color="violet" size="xs" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-sm sm:text-lg font-semibold text-white tracking-tight">
                  Unlock Premium
                </h1>
                {eligibleForTrial && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-semibold text-white bg-white/25">
                    3-Day Trial
                  </span>
                )}
              </div>
              <p className="text-white/80 text-[11px] sm:text-sm mt-0.5">Real data, timelines—cancel anytime</p>
              <div className="hidden sm:flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-white/70 font-medium">
                <span>Updated daily</span><span>•</span><span>Your percentile & countdown</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - balanced desktop, clean mobile with proper spacing */}
      <div className="flex-1 flex flex-col sm:flex-row items-center sm:items-center justify-center overflow-y-auto pt-8 pb-10 sm:pt-6 sm:pb-8 lg:pt-8 lg:pb-10">
        <div className="w-full w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 subscribe-page-content">
          <div className="grid lg:grid-cols-2 gap-6 sm:gap-6 lg:gap-10 xl:gap-12 items-stretch lg:items-start pb-6 sm:pb-8 lg:pb-10">
            {/* Pricing Card - first on mobile, left on desktop */}
            <div className="flex justify-center lg:justify-end order-1">
              <div className="relative w-full max-w-md lg:max-w-full lg:sticky lg:top-12 mt-0 sm:mt-0">
                {/* Premium Badge - proper spacing from header on mobile */}
                <div className="absolute -top-3 sm:-top-3 left-1/2 transform -translate-x-1/2 z-20">
                  <div className="bg-[var(--uscis-blue)] text-white px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold shadow-sm flex items-center gap-1 sm:gap-1.5 border border-[var(--uscis-blue)]/30">
                    <SparklesIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Most Popular</span>
                  </div>
                </div>

                {/* Premium Card - compact on mobile */}
                <div className="relative bg-[var(--bg-surface)] rounded-2xl sm:rounded-3xl border border-[var(--border-color)] shadow-sm p-4 sm:p-6 lg:p-8 overflow-hidden transition-shadow duration-300 hover:shadow-md">
                  {/* Subtle background */}
                  <div className="absolute inset-0 bg-[var(--bg-surface-alt)]/30"></div>
                  
                  <div className="relative z-10">
                    {/* Pricing Header - compact on mobile */}
                    <div className="text-center mb-3 sm:mb-6">
                      <h2 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)] mb-1 sm:mb-2 tracking-tight">
                        Premium Monthly
                      </h2>
                      <div className="flex items-baseline justify-center gap-1.5 sm:gap-2 mb-1">
                        <span className="text-4xl sm:text-5xl font-bold tracking-tight text-[var(--text-primary)]">
                          $4.99
                        </span>
                        <span className="text-lg sm:text-xl text-[var(--text-secondary)] font-medium">/month</span>
                      </div>
                      {eligibleForTrial ? (
                        <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                          $0 today, then $4.99/mo · Cancel before trial ends
                        </p>
                      ) : (
                        <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">
                          Cancel anytime · All features included
                        </p>
                      )}
                    </div>

                    {/* Features List - mobile: inline pills; desktop: stacked */}
                    <div className="flex flex-wrap justify-center gap-1.5 sm:flex-col sm:gap-2 mb-4 sm:mb-6">
                      {(
                        eligibleForTrial
                          ? ["3-day trial", "All features", "Cancel anytime"]
                          : ["All features", "Cancel anytime", "Instant access"]
                      ).map((feature, index) => (
                        <div key={index} className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-3 sm:py-2 bg-[var(--bg-surface-alt)] rounded-full sm:rounded-xl border border-[var(--border-color)]">
                          <div className="flex-shrink-0 w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-[var(--uscis-green)] flex items-center justify-center">
                            <CheckIcon className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 text-white" />
                          </div>
                          <span className="text-[10px] sm:text-xs font-semibold text-[var(--text-primary)]">{feature}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button */}
                    {!subscriptionLoading && isSubscribed ? (
                      <div className="w-full text-center py-3 sm:py-4 px-4 rounded-xl sm:rounded-2xl border-2 border-[var(--uscis-blue)]/30 bg-[var(--bg-surface-alt)]">
                        <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] mb-1.5 sm:mb-2">You already have an active subscription.</p>
                        <button
                          type="button"
                          onClick={() => router.push("/settings")}
                          className="text-xs sm:text-sm font-semibold text-[var(--text-primary)] hover:underline touch-manipulation"
                        >
                          Manage in Settings
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleSubscribe}
                        disabled={subscriptionLoading}
                        className="w-full group relative bg-[var(--uscis-blue)] hover:bg-[var(--uscis-blue-dark)] !text-white font-semibold py-3.5 sm:py-4 rounded-xl sm:rounded-2xl shadow-md hover:shadow-lg active:scale-[0.99] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none overflow-hidden touch-manipulation"
                      >
                        <div className="absolute inset-0 opacity-0" aria-hidden />
                        <div className="relative z-10 flex items-center justify-center gap-2.5 !text-white">
                          <>
                            <SparklesIcon className="w-5 h-5" style={{ color: "#fff" }} />
                            <span className="text-base font-extrabold" style={{ color: "#fff" }}>
                              {eligibleForTrial ? "Start 3-day free trial" : "Subscribe Now"}
                            </span>
                          </>
                        </div>
                      </button>
                    )}
                    
                    {/* Trust Badge - compact on mobile */}
                    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-3 sm:mt-5">
                      <ShieldCheckIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--text-tertiary)]" />
                      <p className="text-[10px] sm:text-xs text-[var(--text-tertiary)] font-medium">
                        Secure payment by Stripe
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Benefits - mobile: compact grid; desktop: full 2x3 grid */}
            <div className="order-2 flex flex-col min-w-0 lg:min-w-[320px]">
              {/* Mobile: compact benefits grid - fills space, no empty gap */}
              <div className="sm:hidden w-full mt-4">
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-3 text-center">
                  Premium includes
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {benefits.slice(0, 6).map((benefit, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2.5 bg-[var(--bg-surface)] rounded-lg px-3 py-2.5 border border-[var(--border-color)]"
                    >
                      <GradientIconBadge icon={benefit.icon} color={benefit.badgeColor} size="xxs" />
                      <span className="text-xs font-semibold text-[var(--text-primary)] leading-tight line-clamp-2">
                        {benefit.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop: full benefits grid - 2 cols for balance */}
              <div className="hidden sm:block flex-1 relative overflow-hidden rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 lg:p-5">
                <div className="absolute inset-0 opacity-[0.05]">
                  <Image src={HERO_IMAGES.passport} alt="" fill className="object-cover" sizes="600px" />
                </div>
                <div className="relative">
                <h2 className="text-xl lg:text-2xl font-bold text-[var(--text-primary)] mb-3 lg:mb-4 tracking-tight">
                  Premium Features
                </h2>
                <div className="grid sm:grid-cols-2 gap-2.5 lg:gap-3">
                  {benefits.map((benefit, index) => (
                    <div
                      key={index}
                      className="group relative bg-[var(--bg-surface)] rounded-xl p-3 border border-[var(--border-color)] hover:border-[var(--uscis-blue)]/50 hover:shadow-md transition-all duration-300"
                    >
                      <div className="absolute inset-0 bg-[var(--uscis-blue)]/5 dark:bg-[var(--uscis-blue)]/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative flex items-start gap-3">
                        <GradientIconBadge icon={benefit.icon} color={benefit.badgeColor} size="sm" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm text-[var(--text-primary)] leading-tight">
                            {benefit.title}
                          </h3>
                          {benefit.description && (
                            <p className="text-xs text-[var(--text-secondary)] leading-snug mt-0.5 line-clamp-2">
                              {benefit.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </div>

              {/* Trust Indicators - inline on mobile (in card), separate on desktop */}
              <div className="hidden sm:flex bg-[var(--bg-surface-alt)] rounded-xl p-3 mt-4 border border-[var(--border-color)] items-center justify-center gap-4 lg:gap-6 flex-wrap">
                {[
                  { icon: ShieldCheckIcon, text: "Secure" },
                  { icon: CheckIcon, text: "Cancel Anytime" },
                  { icon: CheckIcon, text: "24/7 Support" }
                ].map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div key={index} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-[var(--uscis-green)] flex items-center justify-center flex-shrink-0">
                        <Icon className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-semibold text-[var(--text-secondary)]">{item.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
