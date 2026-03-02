"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, Language } from "@/contexts/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import { HomeIcon } from "@heroicons/react/24/solid";
import { BookOpenIcon } from "@heroicons/react/24/solid";
import { ChartBarIcon } from "@heroicons/react/24/solid";
import { QuestionMarkCircleIcon } from "@heroicons/react/24/solid";
import { NewspaperIcon, Bars3Icon, XMarkIcon, ArrowRightOnRectangleIcon, Squares2X2Icon, WrenchScrewdriverIcon, ChevronDownIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { LockClosedIcon as LockClosedIconOutline } from "@heroicons/react/24/outline";
import Link from "next/link";
import SubscriptionStatusBanner from "./SubscriptionStatusBanner";
import PastDueBanner from "./PastDueBanner";
import TrialReminderBanner from "./TrialReminderBanner";
import SiteFooter from "./SiteFooter";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}


export default function TopNavigation({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isSubscribed, loading: subscriptionLoading, status: subscriptionStatus, hasUsedTrial } = useSubscription();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [allVisaNovaOpen, setAllVisaNovaOpen] = useState(false);
  
  // Hide navigation on login and onboarding pages
  const shouldShowNav = pathname !== "/login" && pathname !== "/onboarding";
  
  // Check if banner should be visible (banner component handles its own dismissed state)
  const shouldShowBanner = shouldShowNav && !isSubscribed && !subscriptionLoading;
  const isPastDue = subscriptionStatus?.status === "past_due" || subscriptionStatus?.status === "unpaid";
  
  // Mobile subscribe banner - separate from desktop banner
  const [mobileBannerDismissed, setMobileBannerDismissed] = useState(false);
  const shouldShowMobileBanner = shouldShowBanner && !mobileBannerDismissed;
  
  // Navigation order: Home, Resources, Guides, Tools, Stats Pro, News (mobile hamburger)
  const navItems: NavItem[] = [
    { id: "home", label: t("home"), icon: HomeIcon, path: "/" },
    { id: "resources", label: "Resources", icon: Squares2X2Icon, path: "/resources" },
    { id: "guides", label: t("guides"), icon: BookOpenIcon, path: "/guides" },
    { id: "tools", label: "Tools", icon: WrenchScrewdriverIcon, path: "/tools/case-tools" },
    { id: "stats", label: "Statistics Pro", icon: ChartBarIcon, path: "/stats" },
    { id: "news", label: t("news"), icon: NewspaperIcon, path: "/news" },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] gov-page-bg">
      {/* Past-due banner - highest priority, show across app */}
      {shouldShowNav && isPastDue && <PastDueBanner />}

      {/* Trial ending soon - in-app reminder */}
      {shouldShowNav && !isPastDue && <TrialReminderBanner />}

      {/* Subscription Banner - Desktop Only (Above Navigation) */}
      {shouldShowBanner && !isPastDue && (
        <div className="hidden md:block">
          <SubscriptionStatusBanner />
        </div>
      )}
      
      {/* Mobile Subscribe Banner - Balanced, touch-friendly, premium feel */}
      {shouldShowMobileBanner && !isPastDue && (
        <div className="md:hidden relative surface-dark sticky top-0 z-[45] overflow-hidden border-b border-white/10">
          <div className="absolute inset-0 bg-[var(--header-dark)]" />
          <div className="h-px bg-white/10" aria-hidden="true" />
          <div className="relative px-2 py-2 sm:py-3">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Left: Lock + Label + Badge - balanced inline grouping */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex items-center justify-center w-8 h-8 flex-shrink-0 rounded-lg bg-white/10 border border-white/15">
                  <LockClosedIconOutline className="w-4 h-4 text-white" />
                </div>
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <p className="text-xs font-semibold text-white">
                    Unlock Premium
                  </p>
                  {!hasUsedTrial && (
                    <span className="text-[10px] font-semibold text-white/95 bg-white/20 px-2 py-0.5 rounded-full border border-white/10 flex-shrink-0">
                      3-Day Trial
                    </span>
                  )}
                </div>
              </div>
              {/* Right: Subscribe CTA + Dismiss - 44px min tap targets for accessibility */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link
                  href="/subscribe"
                  className="inline-flex items-center justify-center min-h-[40px] px-4 py-2 rounded-xl bg-[var(--uscis-blue)] hover:bg-[var(--uscis-blue-dark)] active:scale-[0.98] text-white text-sm font-semibold transition-all touch-manipulation"
                >
                  Subscribe
                </Link>
                <button
                  onClick={() => setMobileBannerDismissed(true)}
                  className="flex items-center justify-center min-w-[40px] min-h-[40px] rounded-xl hover:bg-white/15 active:bg-white/25 transition-colors flex-shrink-0 touch-manipulation"
                  aria-label="Dismiss banner"
                >
                  <XMarkIcon className="w-5 h-5 text-white/90" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {shouldShowNav && (
        <header className="gov-travel-state-nav">
          {/* Microsoft-style main nav: white bar, no underline on menu links */}
          <nav className="hidden md:block bg-white border-b border-[var(--border-color)] nav-no-underline">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-2.5">
              {/* Left: Logo + VisaNova */}
              <Link href="/" className="flex items-center gap-2 shrink-0 no-underline hover:no-underline">
                <div className="w-7 h-7 flex items-center justify-center">
                  <img src="/logo.svg" alt="" className="w-full h-full object-contain" />
                </div>
                <span className="text-[var(--text-primary)] font-semibold text-sm">VisaNova</span>
              </Link>
              {/* Center: Menu items - Microsoft-style smaller fonts, Home first */}
              <div className="flex items-center justify-center gap-0.5 flex-1 min-w-0 flex-wrap">
                  <Link href="/" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">{t("home")}</Link>
                  <Link href="/resources" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">Resources</Link>
                  <Link href="/guides" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">{t("guides")}</Link>
                  <Link href="/tools/case-tools" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">Tools</Link>
                  <Link href="/stats" className="px-2.5 py-1.5 text-[var(--uscis-blue)] font-medium text-xs hover:bg-[var(--uscis-blue)]/5 rounded no-underline hover:no-underline transition-colors">Statistics Pro</Link>
                  <Link href="/news" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">{t("news")}</Link>
                  <Link href="/processing-times" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">Processing Times</Link>
                  <Link href="/fees" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">Fees</Link>
                  <Link href="/status-decoder" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">Status Decoder</Link>
                  <Link href="/official-links" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">Official Links</Link>
                  <Link href="/travel-safety" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">Travel Safety</Link>
                  <Link href="/travel-advisories" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">Travel Advisories</Link>
                  <Link href="/embassy" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">Embassy</Link>
                  <Link href="/about" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">About</Link>
                  <Link href="/help" className="px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">Help</Link>
              </div>
              {/* Right: All VisaNova dropdown + Search + Subscribe + User */}
              <div className="flex items-center gap-1 shrink-0">
                <div className="relative" onMouseLeave={() => setAllVisaNovaOpen(false)}>
                  <button
                    type="button"
                    onClick={() => setAllVisaNovaOpen(!allVisaNovaOpen)}
                    className="flex items-center gap-0.5 px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline transition-colors"
                  >
                    All VisaNova
                    <ChevronDownIcon className={`w-3.5 h-3.5 transition-transform ${allVisaNovaOpen ? "rotate-180" : ""}`} />
                  </button>
                  {allVisaNovaOpen && (
                    <div
                      className="absolute top-full right-0 mt-1 py-2 w-52 bg-white border border-[var(--border-color)] rounded-lg shadow-lg z-[60]"
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <Link href="/" onClick={() => setAllVisaNovaOpen(false)} className="block px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] no-underline">Home</Link>
                      <Link href="/resources" onClick={() => setAllVisaNovaOpen(false)} className="block px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] no-underline">Resources</Link>
                      <Link href="/guides" onClick={() => setAllVisaNovaOpen(false)} className="block px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] no-underline">{t("guides")}</Link>
                      <Link href="/tools/case-tools" onClick={() => setAllVisaNovaOpen(false)} className="block px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] no-underline">Tools</Link>
                      <Link href="/stats" onClick={() => setAllVisaNovaOpen(false)} className="block px-4 py-2 text-xs text-[var(--uscis-blue)] font-medium hover:bg-[var(--bg-surface-alt)] no-underline">Statistics Pro</Link>
                      <Link href="/news" onClick={() => setAllVisaNovaOpen(false)} className="block px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] no-underline">{t("news")}</Link>
                      <Link href="/travel-safety" onClick={() => setAllVisaNovaOpen(false)} className="block px-4 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] no-underline">Travel Safety</Link>
                      <Link href="/subscribe" onClick={() => setAllVisaNovaOpen(false)} className="block px-4 py-2 text-xs text-[var(--uscis-blue)] font-medium hover:bg-[var(--bg-surface-alt)] no-underline border-t border-[var(--border-color)] mt-1 pt-2">Subscribe</Link>
                    </div>
                  )}
                </div>
                <Link href="/search" className="flex h-8 w-8 items-center justify-center text-[var(--text-primary)] hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline" aria-label="Search">
                  <MagnifyingGlassIcon className="w-4 h-4" />
                </Link>
                {!subscriptionLoading && !isSubscribed && (
                  <Link href="/subscribe" className="px-3 py-1.5 bg-[var(--uscis-blue)] hover:bg-[var(--uscis-blue-dark)] text-white text-xs font-medium rounded no-underline hover:no-underline transition-colors">
                    Subscribe
                  </Link>
                )}
                {user ? (
                  <Link href="/settings" className="flex items-center gap-1.5 px-2.5 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors" title={user.displayName || user.email || "User"}>
                    <span className="hidden lg:inline text-xs">{user.displayName?.split(" ")[0] || user.email?.split("@")[0] || "User"}</span>
                    <div className="w-7 h-7 rounded-full bg-[var(--uscis-blue)]/20 flex items-center justify-center font-semibold text-[var(--uscis-blue)] text-xs">
                      {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || "U"}
                    </div>
                  </Link>
                ) : (
                  <Link href="/login" className="px-3 py-1.5 text-[var(--text-primary)] text-xs hover:bg-[var(--bg-surface-alt)] rounded no-underline hover:no-underline transition-colors">
                    {t("login")}
                  </Link>
                )}
              </div>
            </div>
          </nav>

          {/* Mobile: compact dark bar + hamburger */}
          <nav className="md:hidden surface-dark relative overflow-hidden bg-[var(--state-main-nav)]">
            <div className="relative max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <img src="/logo.svg" alt="VisaNova" className="w-full h-full object-contain" />
                </div>
                <span className="font-bold text-white truncate">VisaNova</span>
              </Link>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="min-w-[44px] min-h-[44px] w-11 h-11 rounded bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
                aria-label="Toggle Menu"
              >
                {mobileMenuOpen ? <XMarkIcon className="w-6 h-6" /> : <Bars3Icon className="w-6 h-6" />}
              </button>
            </div>
          </nav>

          {/* Mobile Hamburger Menu - Slide Out */}
          {mobileMenuOpen && (
            <div className="md:hidden fixed inset-0 z-[100]">
              {/* Backdrop */}
              <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-md transition-opacity duration-300 z-[100]" 
                onClick={() => setMobileMenuOpen(false)}
              />
              
              {/* Slide-out Menu - smooth slide from right */}
              <div className="surface-dark mobile-menu-panel absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-[var(--hero-dark)] shadow-2xl overflow-y-auto z-[101] rounded-l-2xl border-l border-white/10 pointer-events-auto">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-[var(--hero-dark)]/95 backdrop-blur-md px-3 py-3 md:px-5 md:py-5 border-b border-white/15 rounded-tl-2xl">
                  <div className="h-0.5 bg-[var(--uscis-blue)] rounded-full mb-3" aria-hidden="true" />
                  <div className="relative flex items-center justify-between">
                    <h3 className="text-lg font-bold text-white">Menu</h3>
                    <button
                      onClick={() => setMobileMenuOpen(false)}
                      className="min-w-[44px] min-h-[44px] w-10 h-10 rounded-xl bg-white/15 hover:bg-white/25 active:bg-white/35 flex items-center justify-center transition-colors touch-manipulation"
                      aria-label="Close Menu"
                    >
                      <XMarkIcon className="w-6 h-6 text-white" />
                    </button>
                  </div>
                </div>
                
                {/* Mobile Search */}
                <div className="px-3 pb-3">
                  <form action="/search" method="get" className="flex rounded-xl border border-white/20 bg-white/10 overflow-hidden">
                    <input
                      type="search"
                      name="q"
                      placeholder="Search site..."
                      className="flex-1 min-w-0 px-3 py-2.5 text-sm text-white placeholder:text-white/60 bg-transparent border-0 focus:outline-none focus:ring-0"
                    />
                    <button
                      type="submit"
                      className="px-3 py-2.5 bg-[var(--state-red-accent)] text-white shrink-0"
                      aria-label="Search"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </button>
                  </form>
                </div>

                {/* Menu Items */}
                <div className="px-3 py-4 space-y-1 relative z-10">
                  {/* Navigation Items - Always show these first */}
                  {navItems && navItems.length > 0 ? (
                    navItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.path || (item.id === "resources" && (pathname.startsWith("/resources") || pathname === "/official-links" || pathname === "/embassy" || pathname === "/travel-advisories" || pathname === "/travel-safety" || pathname === "/processing-times" || pathname === "/fees" || pathname === "/status-decoder")) || (item.id === "guides" && pathname.startsWith("/guides")) || (item.id === "tools" && pathname.startsWith("/tools")) || (item.id === "stats" && pathname.startsWith("/stats")) || (item.id === "news" && pathname.startsWith("/news"));
                      return (
                        <Link
                          key={item.id}
                          href={item.path}
                          onClick={() => {
                            setMobileMenuOpen(false);
                          }}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 min-h-[44px] touch-manipulation active:scale-[0.98] relative z-10 cursor-pointer ${
                            isActive
                              ? item.id === "stats"
                                ? "bg-white/20 border border-white/25 text-yellow-400"
                                : "bg-white/20 border border-white/25 text-white"
                              : item.id === "stats"
                              ? "text-yellow-400 hover:bg-white/10 hover:text-yellow-300 active:bg-white/15 border border-transparent"
                              : "text-white/90 hover:bg-white/10 hover:text-white active:bg-white/15 border border-transparent"
                          }`}
                        >
                          <Icon className={`w-6 h-6 flex-shrink-0 ${item.id === "stats" ? "text-yellow-400" : "text-white/90"}`} />
                          <span className={`font-semibold text-base flex-1 ${item.id === "stats" ? "text-yellow-400" : "text-inherit"}`}>{item.label}</span>
                          {isActive && (
                            <div className="ml-auto w-2 h-2 rounded-full bg-white" />
                          )}
                        </Link>
                      );
                    })
                  ) : (
                    <div className="text-white/80 text-sm py-2 px-4">No menu items available</div>
                  )}

                  {/* More links - parity with desktop top bar */}
                  <div className="my-3 pt-2 border-t border-white/15 space-y-1">
                    <Link href="/travel-safety" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-xl text-white/80 hover:bg-white/10 hover:text-white text-sm transition-colors">
                      Travel Safety Checker
                    </Link>
                    <Link href="/travel-advisories" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-xl text-white/80 hover:bg-white/10 hover:text-white text-sm transition-colors">
                      Travel Advisories
                    </Link>
                    <Link href="/about" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-xl text-white/80 hover:bg-white/10 hover:text-white text-sm transition-colors">
                      About Us
                    </Link>
                    <Link href="/help" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-xl text-white/80 hover:bg-white/10 hover:text-white text-sm transition-colors">
                      Help Center
                    </Link>
                  </div>

                  {/* Divider */}
                  <div className="my-4 border-t border-white/15" />

                  {/* User Section */}
                  {user ? (
                    <>
                      <Link
                        href="/settings"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/90 hover:bg-white/10 hover:text-white active:bg-white/15 transition-all duration-200 min-h-[44px] touch-manipulation active:scale-[0.98] relative z-10 cursor-pointer"
                      >
                        <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center border border-white/25">
                          <span className="font-bold text-base text-white">
                            {user.displayName?.charAt(0).toUpperCase() ||
                              user.email?.charAt(0).toUpperCase() ||
                              "U"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-base text-white truncate">{user.displayName || "User"}</p>
                          <p className="text-xs text-white/70 mt-0.5 truncate">{user.email}</p>
                        </div>
                      </Link>
                      <button
                        onClick={async () => {
                          setMobileMenuOpen(false);
                          const { signOut } = await import("firebase/auth");
                          const { auth } = await import("@/lib/firebase");
                          await signOut(auth);
                          router.push("/login");
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-white/90 hover:bg-white/10 hover:text-white active:bg-white/15 transition-all duration-200 border border-white/15 min-h-[44px] touch-manipulation active:scale-[0.98] relative z-10 cursor-pointer"
                      >
                        <ArrowRightOnRectangleIcon className="w-6 h-6 text-white/90" />
                        <span className="font-semibold text-base text-inherit">Sign Out</span>
                      </button>
                    </>
                  ) : (
                    <Link
                      href="/login"
                      onClick={() => {
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center justify-center gap-3 px-3 py-2.5 rounded-xl bg-white/20 text-white hover:bg-white/30 active:bg-white/40 transition-all duration-200 font-semibold border border-white/25 min-h-[44px] touch-manipulation active:scale-[0.98] relative z-10 cursor-pointer"
                    >
                      <span className="font-semibold text-base">{t("login")}</span>
                    </Link>
                  )}

                </div>
              </div>
            </div>
          )}
        </header>
      )}

      {/* Main Content - pb on mobile for safe area (notched devices) & scroll comfort */}
      <main className="min-h-[60vh] main-content-mobile-pb">{children}</main>

      {/* Footer – same gradient as top nav / impact-at-a-glance */}
      {shouldShowNav && <SiteFooter />}
    </div>
  );
}
