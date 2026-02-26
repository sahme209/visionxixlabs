"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserCircleIcon,
  BellIcon,
  CalendarIcon,
  GlobeAltIcon,
  EnvelopeIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
  DocumentTextIcon,
  ShareIcon,
  UserIcon,
  Cog6ToothIcon,
  QuestionMarkCircleIcon,
  BookOpenIcon,
  NewspaperIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  TrashIcon,
  CreditCardIcon,
  ChartBarIcon,
} from "@heroicons/react/24/outline";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AccountActivityChart from "@/components/charts/AccountActivityChart";
import { HERO_IMAGES } from "@/lib/images";
import SubscriptionUsageChart from "@/components/charts/SubscriptionUsageChart";

export default function SettingsPage() {
  const { user } = useAuth();
  const { isSubscribed, loading: subscriptionLoading, status: subscriptionStatus, isTrialing } = useSubscription();
  
  // Debug log subscription status
  useEffect(() => {
    if (!subscriptionLoading && user) {
      console.log("[SETTINGS] Subscription status:", {
        isSubscribed,
        expiresAt: subscriptionStatus.expiresAt?.toISOString(),
        cancelAtPeriodEnd: subscriptionStatus.cancelAtPeriodEnd,
        fullStatus: subscriptionStatus,
      });
    }
  }, [subscriptionLoading, isSubscribed, subscriptionStatus, user]);
  const { language, setLanguage: setLanguageContext, t } = useLanguage();
  const router = useRouter();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [weeklySummaryEmailEnabled, setWeeklySummaryEmailEnabled] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  
  const languageDisplayName = language === "en" ? "English" : "Español";

  useEffect(() => {
    if (typeof window !== "undefined") {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setNotificationsEnabled(data.notificationsEnabled ?? false);
        setCalendarSyncEnabled(data.calendarSyncEnabled ?? false);
        setWeeklySummaryEmailEnabled(data.weeklySummaryEmailEnabled ?? false);
        // Language is managed by LanguageContext, so we don't need to set it here
        // The context will handle language loading from localStorage
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const saveSettings = async (key: string, value: any) => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      await setDoc(docRef, { [key]: value }, { merge: true });
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };


  const handleNotificationToggle = (enabled: boolean) => {
    setNotificationsEnabled(enabled);
    saveSettings("notificationsEnabled", enabled);
    if (enabled && "Notification" in window) {
      Notification.requestPermission();
    }
  };

  const handleCalendarToggle = (enabled: boolean) => {
    setCalendarSyncEnabled(enabled);
    saveSettings("calendarSyncEnabled", enabled);
  };

  const handleWeeklyEmailToggle = (enabled: boolean) => {
    setWeeklySummaryEmailEnabled(enabled);
    saveSettings("weeklySummaryEmailEnabled", enabled);
  };

  const shareProgress = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      alert("Link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy link:", err);
      alert("Failed to copy link. Please try again.");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      alert("Please type 'DELETE' to confirm account deletion.");
      return;
    }

    if (!user) return;

    setIsDeleting(true);
    try {
      // Get auth token
      const { getIdToken } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      const token = await getIdToken(user);

      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete account");
      }

      alert("Your account has been permanently deleted. You will be signed out.");
      // Sign out and redirect
      const { signOut } = await import("firebase/auth");
      await signOut(auth);
      router.push("/login");
    } catch (error: any) {
      console.error("Error deleting account:", error);
      alert(`Failed to delete account: ${error.message || "An unexpected error occurred"}`);
      setIsDeleting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user) return;

    setIsCancelling(true);
    try {
      // Get auth token
      const { getIdToken } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      const token = await getIdToken(user);

      const response = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel subscription");
      }

      // Show success message instead of alert
      setSuccessMessage(data.message || "Your subscription has been cancelled successfully.");
      setShowSuccessMessage(true);
      setShowCancelDialog(false);
      
      // Hide success message after 5 seconds and reload
      setTimeout(() => {
        setShowSuccessMessage(false);
        window.location.reload();
      }, 5000);
    } catch (error: any) {
      console.error("Error cancelling subscription:", error);
      alert(`Failed to cancel subscription: ${error.message || "An unexpected error occurred"}`);
      setIsCancelling(false);
    }
  };

  const handleManageSubscription = async () => {
    if (!user) return;

    setIsOpeningPortal(true);
    try {
      const { getIdToken } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      const token = await getIdToken(user);

      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      const response = await fetch("/api/stripe/create-portal-session", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ returnUrl: `${baseUrl}/settings` }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to open billing portal");
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error("Error opening portal:", error);
      alert(error.message || "Failed to open billing. Please try again.");
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const handleRestoreSubscription = async () => {
    if (!user) return;

    setIsRestoring(true);
    try {
      // Get auth token
      const { getIdToken } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");
      const token = await getIdToken(user);

      const response = await fetch("/api/subscription/restore", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to restore subscription");
      }

      // Expired sub: redirect to subscribe instead of showing success
      if (data.expired && data.canResubscribe && data.redirectTo) {
        window.location.href = data.redirectTo;
        return;
      }

      alert(data.message || "Your subscription has been restored successfully.");
      window.location.reload();
    } catch (error: any) {
      console.error("Error restoring subscription:", error);
      // If error mentions "expired" or "subscribe again", redirect to subscribe
      const msg = error.message || "";
      if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("subscribe again")) {
        window.location.href = "/subscribe";
        return;
      }
      alert(`Failed to restore subscription: ${msg}`);
      setIsRestoring(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-8 md:pb-12">
      {/* Header — Apple-style clean */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b border-white/10">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.office} alt="" fill className="object-cover object-center opacity-15 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/85" />
        </div>
        <div className="relative z-10 w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">Settings</h1>
          <p className="text-sm sm:text-base text-white/75 mt-1 max-w-xl">
            Manage your account, preferences, and subscription. Your data stays private and secure.
          </p>
        </div>
      </div>

      {/* Main Content - responsive padding, two-col on desktop */}
      <main className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-3 md:py-10 w-full min-w-0">
        {/* Success Message Banner */}
        {showSuccessMessage && successMessage && (
          <div className="mb-4 md:mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl shadow-sm">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">Success</p>
                <p className="text-xs text-green-700 dark:text-green-300 leading-relaxed">{successMessage}</p>
              </div>
              <button
                onClick={() => {
                  setShowSuccessMessage(false);
                  window.location.reload();
                }}
                className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Trial Status Banner */}
        {!subscriptionLoading && isTrialing && subscriptionStatus.trialEnd && (
          <div className="mb-4 md:mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl shadow-sm">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="w-5 h-5 text-[var(--text-primary)] mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  Trial ends on{" "}
                  {subscriptionStatus.trialEnd instanceof Date
                    ? subscriptionStatus.trialEnd.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : ""}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  You’ll be charged $4.99/month after your 3-day free trial unless you cancel before it ends.
                </p>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-5 md:space-y-8">
        {/* Account & Profile — Apple-style section */}
        <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
          <div className="px-4 py-4 sm:px-5 sm:py-5 border-b border-[var(--border-color)]/50">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Account & Profile</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
              Your name, email, and profile photo. Edit anytime to keep your information up to date.
            </p>
          </div>
          <div className="p-4 md:p-6 space-y-3 md:space-y-4">
            {user ? (
              <>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 p-4 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border-color)]/50">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] flex items-center justify-center shadow-lg flex-shrink-0">
                      <span className="text-xl sm:text-2xl font-bold text-white">
                        {user.displayName?.charAt(0).toUpperCase() ||
                          user.email?.charAt(0).toUpperCase() ||
                          "U"}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-[var(--text-primary)] text-base sm:text-lg truncate">
                        {user.displayName || "User"}
                      </p>
                      <p className="text-xs sm:text-sm text-[var(--text-secondary)] truncate">{user.email}</p>
                    </div>
                  </div>
                  <Link
                    href="/profile-setup"
                    className="sm:ml-auto inline-flex items-center justify-center px-4 py-2.5 bg-[var(--uscis-blue)] text-white !text-white rounded-xl hover:bg-[var(--uscis-blue-dark)] transition-colors text-sm font-semibold touch-manipulation"
                  >
                    Edit Profile
                  </Link>
                </div>

                <button
                  onClick={shareProgress}
                  className="w-full flex items-center justify-between p-4 md:p-4 bg-[var(--bg-surface-alt)] rounded-xl border border-[var(--border-color)]/50 hover:border-[var(--uscis-blue)]/30 hover:bg-[var(--bg-surface)] transition-all touch-manipulation active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
                      <ShareIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-[var(--text-primary)]">Share Progress</p>
                      <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">Invite friends and family to track their cases with VisaNova. Share the link anytime.</p>
                    </div>
                  </div>
                  <ArrowRightOnRectangleIcon className="w-5 h-5 text-[var(--text-secondary)] flex-shrink-0" />
                </button>
              </>
            ) : (
              <div className="text-center py-8">
                <UserCircleIcon className="w-16 h-16 mx-auto text-[var(--text-secondary)] mb-4" />
                <p className="text-[var(--text-primary)] mb-4">
                  Sign in to access your profile and save your case information.
                </p>
                <Link
                  href="/login"
                  className="uscis-button inline-block"
                >
                  Sign In
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* App Preferences — Apple-style */}
        <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
          <div className="px-4 py-4 sm:px-5 sm:py-5 border-b border-[var(--border-color)]/50">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">App Preferences</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
              Control how and when you receive updates. Choose your language and notification settings.
            </p>
          </div>
          <div className="divide-y divide-[var(--border-color)]">
            {/* Notifications */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 hover:bg-[var(--bg-surface-alt)]/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <BellIcon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)] text-sm md:text-base">Notifications</p>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                    Get alerted when your case status changes or important milestones are reached.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 touch-manipulation min-h-[44px] min-w-[44px] justify-end">
                <input type="checkbox" className="sr-only peer" checked={notificationsEnabled} onChange={(e) => handleNotificationToggle(e.target.checked)} />
                <div className="relative w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-[var(--uscis-blue)] peer-focus:ring-2 peer-focus:ring-[var(--uscis-blue)]/30 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            {/* Weekly Summary Email */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 hover:bg-[var(--bg-surface-alt)]/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center flex-shrink-0">
                  <EnvelopeIcon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)] text-sm md:text-base">Weekly Summary</p>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                    A weekly email digest with approval trends and processing statistics for your form type.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 touch-manipulation min-h-[44px] min-w-[44px] justify-end">
                <input type="checkbox" className="sr-only peer" checked={weeklySummaryEmailEnabled} onChange={(e) => handleWeeklyEmailToggle(e.target.checked)} />
                <div className="relative w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-[var(--uscis-blue)] peer-focus:ring-2 peer-focus:ring-[var(--uscis-blue)]/30 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            {/* Calendar Sync */}
            <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 hover:bg-[var(--bg-surface-alt)]/50 transition-colors">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-[var(--uscis-gray-dark)] flex items-center justify-center flex-shrink-0">
                  <CalendarIcon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)] text-sm md:text-base">Calendar Sync</p>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5 leading-relaxed">
                    Automatically add case milestones and estimated dates to your calendar.
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 touch-manipulation min-h-[44px] min-w-[44px] justify-end">
                <input type="checkbox" className="sr-only peer" checked={calendarSyncEnabled} onChange={(e) => handleCalendarToggle(e.target.checked)} />
                <div className="relative w-11 h-6 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-[var(--uscis-blue)] peer-focus:ring-2 peer-focus:ring-[var(--uscis-blue)]/30 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            {/* Language */}
            <Link
              href="/settings/language"
              className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 hover:bg-[var(--bg-surface-alt)]/50 transition-colors touch-manipulation active:bg-[var(--bg-surface-alt)]"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center flex-shrink-0">
                  <GlobeAltIcon className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)] text-sm md:text-base">{t("language")}</p>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">Display language for the app. Currently: {languageDisplayName}</p>
                </div>
              </div>
              <ArrowRightOnRectangleIcon className="w-5 h-5 text-[var(--text-secondary)] flex-shrink-0" />
            </Link>
          </div>
        </div>

        {/* Daily Briefing — Apple-style */}
        <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
          <div className="px-4 py-4 sm:px-5 sm:py-5 border-b border-[var(--border-color)]/50">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Daily Briefing</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
              A personalized digest of your case status and today&apos;s relevant updates. Updated each morning.
            </p>
          </div>
          <div className="p-4 md:p-6">
            <Link
              href="/daily-briefing"
              className="flex items-center justify-between gap-4 p-4 md:p-5 bg-gradient-to-br from-[var(--bg-surface-alt)] to-[var(--bg-surface)] rounded-xl border border-[var(--border-color)] hover:shadow-lg hover:border-[var(--uscis-blue)]/30 transition-all touch-manipulation active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-blue-500 flex items-center justify-center text-white shadow-lg flex-shrink-0">
                  <NewspaperIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-[var(--text-primary)]">View Daily Briefing</p>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">See your case status, approvals, and key dates for today.</p>
                </div>
              </div>
              <ArrowRightOnRectangleIcon className="w-5 h-5 text-[var(--text-primary)] flex-shrink-0" />
            </Link>
          </div>
        </div>

        {/* Account Analytics */}
        {user && (
          <>
            <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
              <div className="px-4 py-4 sm:px-5 sm:py-5 border-b border-[var(--border-color)]/50">
                <h2 className="text-lg font-semibold text-[var(--text-primary)]">Account Activity</h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                  Login history and activity over the last 30 days. Helps you keep track of account access.
                </p>
              </div>
              <div className="p-4 md:p-6">
                <AccountActivityChart />
              </div>
            </div>

            {isSubscribed && (
              <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
                <div className="px-4 py-4 sm:px-5 sm:py-5 border-b border-[var(--border-color)]/50">
                  <h2 className="text-lg font-semibold text-[var(--text-primary)]">Feature Usage</h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                    See how often you use timelines, approvals, and other premium features. Available to subscribers.
                  </p>
                </div>
                <div className="p-4 md:p-6">
                  <SubscriptionUsageChart />
                </div>
              </div>
            )}
          </>
        )}

        {/* Subscription Management */}
        {user && (
          <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
            <div className="px-4 py-4 sm:px-5 sm:py-5 border-b border-[var(--border-color)]/50">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Subscription</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">Billing and plan management. Update payment method, view invoices, or cancel anytime.</p>
              {!subscriptionLoading && isTrialing && (() => {
                const trialEndDate = subscriptionStatus.trialEnd ?? subscriptionStatus.currentPeriodEnd ?? subscriptionStatus.expiresAt;
                if (!trialEndDate) return null;
                const d = trialEndDate instanceof Date ? trialEndDate : new Date(trialEndDate);
                return (
                  <p className="text-xs font-medium text-[var(--uscis-blue)] mt-2 flex items-center gap-1.5">
                    <span className="inline-flex w-2 h-2 rounded-full bg-[var(--uscis-blue)] animate-pulse" />
                    Trial ends{" "}
                    {d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {" "}· You&apos;ll be charged $4.99/month after that
                  </p>
                );
              })()}
            </div>
            <div className="p-4 md:p-6 space-y-3">
              {/* Trial ending notice – show when trialing */}
              {!subscriptionLoading && isTrialing && (() => {
                const trialEndDate = subscriptionStatus.trialEnd ?? subscriptionStatus.currentPeriodEnd ?? subscriptionStatus.expiresAt;
                if (!trialEndDate) return null;
                const d = trialEndDate instanceof Date ? trialEndDate : new Date(trialEndDate);
                return (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex w-2.5 h-2.5 rounded-full bg-[var(--uscis-blue)] animate-pulse mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Trial ending soon</p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          Your 3-day free trial ends on{" "}
                          <span className="font-semibold">
                            {d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                          </span>
                          . You&apos;ll be charged $4.99/month after that unless you cancel before the trial ends.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Payment failed recovery – show when past_due or unpaid */}
              {!subscriptionLoading && (subscriptionStatus.status === "past_due" || subscriptionStatus.status === "unpaid") && (
                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <ExclamationTriangleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Payment failed</p>
                      <p className="text-xs text-[var(--text-secondary)] mb-3">
                        Your last payment could not be processed. Update your payment method to restore access to premium features.
                      </p>
                      <button
                        onClick={handleManageSubscription}
                        disabled={isOpeningPortal}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 disabled:opacity-50"
                      >
                        {isOpeningPortal ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            Opening...
                          </>
                        ) : (
                          <>
                            <CreditCardIcon className="w-4 h-4" />
                            Update Payment Method
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!subscriptionLoading && isSubscribed ? (
                <>
                  {/* Manage Subscription button – always show for subscribers with Stripe record */}
                  {(subscriptionStatus.stripeCustomerId || subscriptionStatus.stripeSubscriptionId) && (
                    <button
                      onClick={handleManageSubscription}
                      disabled={isOpeningPortal}
                      className="w-full flex items-center justify-between p-4 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border-color)] hover:border-[var(--uscis-blue)]/30 hover:shadow-md transition-all disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <CreditCardIcon className="w-6 h-6 text-[var(--text-primary)]" />
                        <div className="text-left">
                          <span className="font-semibold text-[var(--text-primary)]">Manage Subscription</span>
                          <p className="text-xs text-[var(--text-secondary)]">
                            Update payment method, view invoices, or cancel
                          </p>
                        </div>
                      </div>
                      {isOpeningPortal ? (
                        <div className="w-5 h-5 border-2 border-[var(--uscis-blue)] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ArrowRightOnRectangleIcon className="w-5 h-5 text-[var(--text-secondary)]" />
                      )}
                    </button>
                  )}

                  {/* Subscription Status Info */}
                  {subscriptionStatus.cancelAtPeriodEnd && subscriptionStatus.expiresAt ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start gap-3">
                          <ExclamationTriangleIcon className="w-5 h-5 text-gray-800 dark:text-gray-200 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                              Subscription Cancelled
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              Your subscription will remain active until{" "}
                              <span className="font-semibold">
                                {new Date(subscriptionStatus.expiresAt).toLocaleDateString('en-US', {
                                  month: 'long',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                              . You will continue to have access to all premium features until then.
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* Restore Button */}
                      <button
                        onClick={handleRestoreSubscription}
                        disabled={isRestoring}
                        className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <div className="text-left">
                            <span className="font-semibold text-[var(--text-primary)]">
                              {isRestoring ? "Restoring..." : "Restore Subscription"}
                            </span>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {subscriptionStatus.expiresAt ? (
                                <>
                                  Reactivate your subscription to continue after {new Date(subscriptionStatus.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </>
                              ) : (
                                <>
                                  Reactivate your subscription to continue and restore access to premium features.
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        {!isRestoring && (
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ) : subscriptionStatus.expiresAt ? (
                    <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-3">
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0"></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                            {subscriptionStatus.status === "trialing" ? "Free Trial Active" : "Active Subscription"}
                          </p>
                          {subscriptionStatus.status === "trialing" && subscriptionStatus.trialEnd ? (
                            <div className="space-y-1">
                              <p className="text-xs text-green-700 dark:text-green-300">
                                Trial ends:{" "}
                                <span className="font-semibold">
                                  {subscriptionStatus.trialEnd instanceof Date
                                    ? subscriptionStatus.trialEnd.toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                      })
                                    : ""}
                                </span>
                              </p>
                              {subscriptionStatus.currentPeriodEnd && (
                                <p className="text-xs text-green-700 dark:text-green-300">
                                  Next charge:{" "}
                                  <span className="font-semibold">
                                    {subscriptionStatus.currentPeriodEnd instanceof Date
                                      ? subscriptionStatus.currentPeriodEnd.toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                        })
                                      : ""}
                                  </span>
                                  {" "}($4.99/month)
                                </p>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-green-700 dark:text-green-300">
                              Next billing date:{" "}
                              <span className="font-semibold">
                                {subscriptionStatus.currentPeriodEnd instanceof Date
                                  ? subscriptionStatus.currentPeriodEnd.toLocaleDateString("en-US", {
                                      month: "long",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : subscriptionStatus.expiresAt instanceof Date
                                  ? subscriptionStatus.expiresAt.toLocaleDateString("en-US", {
                                      month: "long",
                                      day: "numeric",
                                      year: "numeric",
                                    })
                                  : ""}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                  
                  {/* Cancel Button */}
                  {!subscriptionStatus.cancelAtPeriodEnd && (
                    <button
                      onClick={() => setShowCancelDialog(true)}
                      className="w-full flex items-center justify-between p-4 bg-[var(--bg-surface-alt)] rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                        <div className="text-left">
                          <span className="font-semibold text-[var(--text-primary)]">Cancel Subscription</span>
                          <p className="text-xs text-[var(--text-secondary)]">
                            Cancel at end of billing cycle - access continues until then
                          </p>
                        </div>
                      </div>
                      <ArrowRightOnRectangleIcon className="w-5 h-5 text-[var(--text-secondary)]" />
                    </button>
                  )}
                </>
              ) : !subscriptionLoading && !isSubscribed ? (
                <div className="space-y-3">
                  {/* Past_due/unpaid: Payment failed banner handles it; show Manage Subscription for billing */}
                  {(subscriptionStatus.status === "past_due" || subscriptionStatus.status === "unpaid") &&
                   (subscriptionStatus.stripeCustomerId || subscriptionStatus.stripeSubscriptionId) ? (
                    <button
                      onClick={handleManageSubscription}
                      disabled={isOpeningPortal}
                      className="w-full flex items-center justify-between p-4 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border-color)] hover:border-[var(--uscis-blue)]/30 transition-all disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <CreditCardIcon className="w-6 h-6 text-[var(--text-primary)]" />
                        <div className="text-left">
                          <span className="font-semibold text-[var(--text-primary)]">Manage Subscription</span>
                          <p className="text-xs text-[var(--text-secondary)]">Update payment method or view invoices</p>
                        </div>
                      </div>
                      {isOpeningPortal ? (
                        <div className="w-5 h-5 border-2 border-[var(--uscis-blue)] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <ArrowRightOnRectangleIcon className="w-5 h-5 text-[var(--text-secondary)]" />
                      )}
                    </button>
                  ) : /* Check if subscription was cancelled but period hasn't ended - show Restore. If period ended, show Subscribe Again */
                  ((subscriptionStatus.expiresAt && 
                   new Date(subscriptionStatus.expiresAt) > new Date() && 
                   subscriptionStatus.cancelAtPeriodEnd) ||
                   (subscriptionStatus.stripeSubscriptionId && !isSubscribed && subscriptionStatus.status !== "past_due" && subscriptionStatus.status !== "unpaid" && subscriptionStatus.expiresAt && new Date(subscriptionStatus.expiresAt) > new Date()) ||
                   (subscriptionStatus.cancelAtPeriodEnd && subscriptionStatus.expiresAt && new Date(subscriptionStatus.expiresAt) > new Date())) ? (
                    <div className="space-y-3">
                      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="flex items-start gap-3">
                          <ExclamationTriangleIcon className="w-5 h-5 text-gray-800 dark:text-gray-200 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                              Subscription Cancelled
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {subscriptionStatus.expiresAt ? (
                                <>
                                  Your subscription will remain active until{" "}
                                  <span className="font-semibold">
                                    {new Date(subscriptionStatus.expiresAt).toLocaleDateString('en-US', {
                                      month: 'long',
                                      day: 'numeric',
                                      year: 'numeric'
                                    })}
                                  </span>
                                  . You will continue to have access to all premium features until then.
                                </>
                              ) : (
                                <>
                                  Your subscription is scheduled for cancellation but the expiration date is unavailable. 
                                  Click "Restore Subscription" to reactivate and continue your subscription.
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                      {/* Restore Button */}
                      <button
                        onClick={handleRestoreSubscription}
                        disabled={isRestoring}
                        className="w-full flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          <div className="text-left">
                            <span className="font-semibold text-[var(--text-primary)]">
                              {isRestoring ? "Restoring..." : "Restore Subscription"}
                            </span>
                            <p className="text-xs text-[var(--text-secondary)]">
                              {subscriptionStatus.expiresAt ? (
                                <>
                                  Reactivate your subscription to continue after {new Date(subscriptionStatus.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                </>
                              ) : (
                                <>
                                  Reactivate your subscription to continue and restore access to premium features.
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        {!isRestoring && (
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ) : (
                    <div className="text-center py-4 px-2">
                      <p className="text-sm text-[var(--text-secondary)] mb-4">
                        {subscriptionStatus.cancelAtPeriodEnd || subscriptionStatus.expiresAt
                          ? "Your subscription has expired. Subscribe again to regain access."
                          : "You don't have an active subscription."}
                      </p>
                      <Link
                        href="/subscribe"
                        className="block w-full sm:w-auto sm:inline-block px-6 py-3 bg-[var(--uscis-blue)] text-white font-semibold rounded-xl hover:bg-[var(--uscis-blue-dark)] transition-colors touch-manipulation"
                      >
                        {subscriptionStatus.cancelAtPeriodEnd || subscriptionStatus.expiresAt ? "Subscribe Again" : "Subscribe Now"}
                      </Link>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[var(--uscis-blue)] mx-auto"></div>
                  <p className="text-sm text-[var(--text-secondary)] mt-2">Loading subscription status...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Quick Actions — Apple-style */}
        <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
          <div className="px-4 py-4 sm:px-5 sm:py-5 border-b border-[var(--border-color)]/50">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Quick Actions</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
              Jump to your most-used features. Case tools, statistics, guides, and news—all in one place.
            </p>
          </div>
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <Link
                href="/tools/case-tools"
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 rounded-xl border border-[var(--border-color)] hover:border-[var(--border-color-hover)] transition-all touch-manipulation active:scale-[0.98]"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-md flex-shrink-0">
                  <DocumentTextIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--text-primary)] text-sm">Case Tools</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Document templates and case preparation tools.</p>
                </div>
                <ArrowRightOnRectangleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-secondary)] hidden sm:block flex-shrink-0" />
              </Link>
              <Link
                href="/stats"
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-[var(--bg-surface-alt)] dark:bg-[var(--bg-surface-alt)]/50 rounded-xl border border-[var(--border-color)] hover:border-[var(--border-color-hover)] transition-all touch-manipulation active:scale-[0.98]"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-purple-500 flex items-center justify-center shadow-md flex-shrink-0">
                  <ChartBarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--text-primary)] text-sm">Statistics</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Processing times and approval analytics.</p>
                </div>
                <ArrowRightOnRectangleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-secondary)] hidden sm:block flex-shrink-0" />
              </Link>
              <Link
                href="/guides"
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl border border-green-200 dark:border-green-700 hover:shadow-lg hover:border-green-300 dark:hover:border-green-600 transition-all touch-manipulation active:scale-[0.98]"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-green-500 flex items-center justify-center shadow-md flex-shrink-0">
                  <BookOpenIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--text-primary)] text-sm">Guides</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Step-by-step immigration process help.</p>
                </div>
                <ArrowRightOnRectangleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-secondary)] hidden sm:block flex-shrink-0" />
              </Link>
              <Link
                href="/news"
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl border border-red-200 dark:border-red-700 hover:shadow-lg hover:border-red-300 dark:hover:border-red-600 transition-all touch-manipulation active:scale-[0.98]"
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-red-500 flex items-center justify-center shadow-md flex-shrink-0">
                  <NewspaperIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[var(--text-primary)] text-sm">News</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">Latest immigration policy and USCIS updates.</p>
                </div>
                <ArrowRightOnRectangleIcon className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--text-secondary)] hidden sm:block flex-shrink-0" />
              </Link>
            </div>
          </div>
        </div>

        {/* Help & Support — Apple-style */}
        <div className="rounded-2xl overflow-hidden border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-sm">
          <div className="px-4 py-4 sm:px-5 sm:py-5 border-b border-[var(--border-color)]/50">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Help & Support</h2>
            <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
              FAQs, user guides, and resources to get the most out of VisaNova.
            </p>
          </div>
          <div className="divide-y divide-[var(--border-color)]">
            <Link
              href="/help"
              className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 hover:bg-[var(--bg-surface-alt)]/50 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-[var(--uscis-blue)] flex items-center justify-center flex-shrink-0">
                  <QuestionMarkCircleIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-semibold text-[var(--text-primary)] text-sm md:text-base">Help Center</span>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">Frequently asked questions and troubleshooting.</p>
                </div>
              </div>
              <ArrowRightOnRectangleIcon className="w-5 h-5 text-[var(--text-secondary)] flex-shrink-0" />
            </Link>
            <Link
              href="/guides"
              className="flex items-center justify-between gap-3 px-4 py-3 md:px-6 md:py-4 hover:bg-[var(--bg-surface-alt)]/50 transition-colors touch-manipulation"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 md:w-11 md:h-11 rounded-xl bg-indigo-500 flex items-center justify-center flex-shrink-0">
                  <BookOpenIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-semibold text-[var(--text-primary)] text-sm md:text-base">User Guide</span>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-0.5">Learn how to use VisaNova step by step.</p>
                </div>
              </div>
              <ArrowRightOnRectangleIcon className="w-5 h-5 text-[var(--text-secondary)] flex-shrink-0" />
            </Link>
          </div>
        </div>

        {/* Danger Zone — Apple-style */}
        {user && (
          <div className="rounded-2xl overflow-hidden border-2 border-red-200 dark:border-red-800 shadow-sm">
            <div className="px-4 py-4 sm:px-5 sm:py-5 bg-red-50/50 dark:bg-red-900/10 border-b border-red-200/50 dark:border-red-800/50">
              <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
              <p className="text-sm text-[var(--text-secondary)] mt-1 leading-relaxed">
                Permanent account deletion. This cannot be undone—all your data will be removed from our servers.
              </p>
            </div>
            <div className="p-4 md:p-6">
              <button
                onClick={() => setShowDeleteDialog(true)}
                className="w-full flex items-center justify-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-600 dark:text-red-400 touch-manipulation font-semibold"
              >
                <TrashIcon className="w-5 h-5" />
                Delete My Account
              </button>
            </div>
          </div>
        )}

          {/* Sign Out */}
          {user && (
            <button
              onClick={async () => {
                const { signOut } = await import("firebase/auth");
                const { auth } = await import("@/lib/firebase");
                await signOut(auth);
                router.push("/login");
              }}
              className="w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 md:p-6 flex items-center justify-center gap-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors touch-manipulation font-semibold"
            >
              <ArrowRightOnRectangleIcon className="w-5 h-5" />
              Sign Out
            </button>
          )}

          {/* Footer */}
          <footer className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-[var(--border-color)]">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[var(--text-secondary)]">
            <div className="flex items-center gap-6">
              <Link
                href="/terms"
                className="transition-colors text-black hover:opacity-80 dark:text-white dark:hover:opacity-90"
              >
                Terms of Use
              </Link>
              <Link
                href="/privacy"
                className="transition-colors text-black hover:opacity-80 dark:text-white dark:hover:opacity-90"
              >
                Privacy Policy
              </Link>
              <Link
                href="/help"
                className="transition-colors text-black hover:opacity-80 dark:text-white dark:hover:opacity-90"
              >
                Help Center
              </Link>
              </div>
              <div className="text-xs text-[var(--text-tertiary)]">
                <p>VisaNova v1.0.0</p>
              </div>
            </div>
          </footer>
        </div>
      </main>

      {/* Delete Account Dialog */}
          {showDeleteDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-[var(--bg-surface)] rounded-2xl border-2 border-red-300 dark:border-red-700 shadow-2xl max-w-md w-full mx-4">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">Delete Account</h3>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    This action cannot be undone. This will permanently delete your account and remove all of your data from our servers.
                  </p>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">What will be deleted:</p>
                    <ul className="text-xs text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                      <li>Your profile and case information</li>
                      <li>Your subscription data</li>
                      <li>Your settings and preferences</li>
                      <li>Your notifications</li>
                      <li>All other account data</li>
                    </ul>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-[var(--text-primary)] mb-2">
                      Type <span className="text-red-600 dark:text-red-400 font-mono">DELETE</span> to confirm:
                    </label>
                    <input
                      type="text"
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder="DELETE"
                      className="w-full px-4 py-2 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-red-500"
                      disabled={isDeleting}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowDeleteDialog(false);
                        setDeleteConfirmText("");
                      }}
                      disabled={isDeleting}
                      className="flex-1 px-4 py-2 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      disabled={isDeleting || deleteConfirmText !== "DELETE"}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isDeleting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Deleting...
                        </>
                      ) : (
                        <>
                          <TrashIcon className="w-4 h-4" />
                          Delete Account
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cancel Subscription Dialog */}
          {showCancelDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-[var(--bg-surface)] rounded-2xl border-2 border-red-300 dark:border-red-700 shadow-2xl max-w-md w-full mx-4">
                <div className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <ExclamationTriangleIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">Cancel Subscription</h3>
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Are you sure you want to cancel your subscription? Your access to premium features will continue until the end of your current billing period.
                  </p>
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">What happens:</p>
                    <ul className="text-xs text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                      <li>Your subscription will be cancelled at the end of your current billing period</li>
                      <li>You will continue to have access to premium features until then</li>
                      <li>You will lose access to all premium features</li>
                      <li>You will not be charged for future billing periods</li>
                      <li>You can resubscribe at any time</li>
                    </ul>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCancelDialog(false)}
                      disabled={isCancelling}
                      className="flex-1 px-4 py-2 bg-[var(--bg-surface-alt)] border border-[var(--border-color)] rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors disabled:opacity-50"
                    >
                      Keep Subscription
                    </button>
                    <button
                      onClick={handleCancelSubscription}
                      disabled={isCancelling}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isCancelling ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Cancelling...
                        </>
                      ) : (
                        "Cancel Subscription"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
