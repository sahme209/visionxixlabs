"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { collection, query, orderBy, limit, onSnapshot, doc, getDoc, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { QueuePositionEngine } from "@/lib/calculations/queuePosition";
import {
  CalendarIcon,
  CheckCircleIcon,
  NewspaperIcon,
  LightBulbIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";
import { format } from "date-fns";
import Link from "next/link";
import { HERO_IMAGES } from "@/lib/images";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: "milestone" | "alert" | "update" | "tip";
  createdAt: any;
  read: boolean;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DailyBriefing() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [latestNews, setLatestNews] = useState<any>(null);
  const [casesMoved, setCasesMoved] = useState<number | null>(null);
  const [currentLatestPD, setCurrentLatestPD] = useState<Date | null>(null);
  const [queuePosition, setQueuePosition] = useState<{ position: number | null; daysRemaining: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdStatsExtra, setPdStatsExtra] = useState<{ avgTimeDays?: number; pacePdsPerDay?: number } | null>(null);
  const [recentApprovalsCount, setRecentApprovalsCount] = useState<number | null>(null);
  const [systemSnapshot, setSystemSnapshot] = useState<{ i130?: { latestPD: Date; avgDays?: number }; i129f?: { latestPD: Date; avgDays?: number } }>({});

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Fetch notifications
    const q = query(
      collection(db, "notifications"),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as Notification))
      );
    });

    // Fetch latest news
    const newsQ = query(
      collection(db, "news"),
      orderBy("createdAt", "desc"),
      limit(1)
    );
    const unsubNews = onSnapshot(newsQ, (snap) => {
      if (!snap.empty) setLatestNews(snap.docs[0].data());
      else setLatestNews(null);
    });

    // Load pdStats for both I-130 and I-129F (system snapshot) + user's form for queue/extra
    const loadPdStats = async () => {
      const formType = profile?.formType?.toUpperCase();
      try {
        const [s130, s129] = await Promise.all([
          getDoc(doc(db, "pdStats", "petitionType:I-130")),
          getDoc(doc(db, "pdStats", "petitionType:I-129F")),
        ]);
        const snapshot: typeof systemSnapshot = {};
        if (s130.exists()) {
          const d = s130.data();
          const lp = d.latestApprovedPD ? new Date(d.latestApprovedPD) : null;
          if (lp && !isNaN(lp.getTime())) {
            snapshot.i130 = { latestPD: lp, avgDays: d.avgTimeDays != null ? Number(d.avgTimeDays) : undefined };
            if (formType === "I-130") {
              setCurrentLatestPD(lp);
              setPdStatsExtra(d.avgTimeDays != null || d.pacePdsPerDay != null ? { avgTimeDays: d.avgTimeDays != null ? Number(d.avgTimeDays) : undefined, pacePdsPerDay: d.pacePdsPerDay != null ? Number(d.pacePdsPerDay) : undefined } : null);
            }
          }
        }
        if (s129.exists()) {
          const d = s129.data();
          const lp = d.latestApprovedPD ? new Date(d.latestApprovedPD) : null;
          if (lp && !isNaN(lp.getTime())) {
            snapshot.i129f = { latestPD: lp, avgDays: d.avgTimeDays != null ? Number(d.avgTimeDays) : undefined };
            if (formType === "I-129F") {
              setCurrentLatestPD(lp);
              setPdStatsExtra(d.avgTimeDays != null || d.pacePdsPerDay != null ? { avgTimeDays: d.avgTimeDays != null ? Number(d.avgTimeDays) : undefined, pacePdsPerDay: d.pacePdsPerDay != null ? Number(d.pacePdsPerDay) : undefined } : null);
            }
          }
        }
        setSystemSnapshot(snapshot);
      } catch (error) {
        console.error("Error loading pdStats:", error);
      }
    };
    loadPdStats();

    // Recent approvals count (last 7 days) from i130Approvals or i129fApprovals
    const fetchRecentCount = async () => {
      const formType = profile?.formType?.toUpperCase() || "I-130";
      const col = formType === "I-129F" ? "i129fApprovals" : "i130Approvals";
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      try {
        const q = formType === "I-129F"
          ? query(collection(db, col), where("formType", "==", "I-129F"), orderBy("createdAt", "desc"), limit(300))
          : query(collection(db, col), where("formType", "==", "I-130"), orderBy("createdAt", "desc"), limit(300));
        const snap = await getDocs(q);
        let count = 0;
        snap.docs.forEach((d) => {
          const created = d.data().createdAt?.toDate?.() ?? d.data().createdAt;
          const t = created ? new Date(created) : null;
          if (t && t >= cutoff) count++;
        });
        setRecentApprovalsCount(count);
      } catch {
        setRecentApprovalsCount(null);
      }
    };
    fetchRecentCount();

    setLoading(false);

    return () => {
      unsub();
      unsubNews();
    };
  }, [user, profile]);

  // Calculate queue position when profile and latest PD are available
  useEffect(() => {
    if (!profile || !profile.priorityDate || !profile.formType || !currentLatestPD) {
      setQueuePosition(null);
      return;
    }

    try {
      const priorityDate = new Date(profile.priorityDate);
      if (isNaN(priorityDate.getTime())) {
        setQueuePosition(null);
        return;
      }

      const formType = profile.formType.toUpperCase();
      const processingPath = (profile.processingPath || "Consular").toUpperCase();
      
      const result = QueuePositionEngine.calculateQueuePosition(
        priorityDate,
        currentLatestPD,
        formType,
        processingPath
      );

      if (result) {
        setQueuePosition({
          position: result.position,
          daysRemaining: result.daysRemaining,
        });
      } else {
        setQueuePosition(null);
      }
    } catch (error) {
      console.error("Error calculating queue position:", error);
      setQueuePosition(null);
    }
  }, [profile, currentLatestPD]);

  const tips = [
    "Keep all your documents organized in one place. Use the Document Pack Organizer tool.",
    "Set up calendar reminders for important milestones in your case timeline.",
    "Review the RFE Response tool if you receive a Request for Evidence.",
    "Check your queue position regularly to track your progress.",
    "Join the community to connect with others in similar situations.",
  ];

  const randomTip = tips[Math.floor(Math.random() * tips.length)];

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header — pro gradient + hero image */}
      <div className="surface-dark relative bg-gradient-to-br from-[var(--hero-dark)] via-[var(--hero-dark-soft)] to-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)] overflow-hidden">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.passport} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative z-10 w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-white/30 shadow-xl">
              <NewspaperIcon className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-1 tracking-tight text-white">Daily Briefing</h1>
              <p className="text-gray-100/95 text-sm sm:text-base">
                Where you stand today · {format(new Date(), "MMMM d, yyyy")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5 sm:space-y-6 min-w-0">
        {/* Pro status strip */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 py-3 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-sm min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-xs font-semibold border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
            Live data
          </span>
          {profile?.formType && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--uscis-blue)]/10 text-[var(--text-primary)] dark:text-gray-200 text-xs font-semibold border border-[var(--uscis-blue)]/30">
              {profile.formType}
            </span>
          )}
          {profile?.serviceCenter && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-violet-500/10 text-violet-700 dark:text-violet-300 text-xs font-semibold border border-violet-500/30">
              {profile.serviceCenter}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium border border-slate-200 dark:border-slate-700">
            {format(new Date(), "MMM d, yyyy")}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-300 text-xs font-medium border border-orange-500/30">
            US-based estimates
          </span>
        </div>

        {user && !profile?.priorityDate && (
          <div className="rounded-2xl border-2 border-dashed border-[var(--uscis-blue)]/40 bg-[var(--uscis-blue)]/5 p-4 sm:p-5 min-w-0">
            <p className="text-sm font-semibold text-[var(--text-primary)] mb-2">Complete your profile to see your queue position and estimates</p>
            <Link href="/profile-setup" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--uscis-blue)] text-white text-sm font-semibold hover:opacity-90 transition-opacity">
              Set up profile
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>
        )}

        {/* At a glance — 4 compact stat pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-0">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Form type</p>
            <p className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">{profile?.formType || "—"}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Service center</p>
            <p className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">{profile?.serviceCenter || "—"}</p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Priority date</p>
            <p className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
              {profile?.priorityDate ? formatDate(new Date(profile.priorityDate)) : "—"}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Queue position</p>
            <p className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">
              {queuePosition?.position ? `#${queuePosition.position.toLocaleString()}` : "—"}
            </p>
          </div>
        </div>

        {/* System snapshot — real data for I-130 & I-129F (always show when we have it) */}
        {(systemSnapshot.i130 || systemSnapshot.i129f) && (
          <div className="rounded-2xl border border-[var(--border-color)] bg-gradient-to-br from-slate-50 to-slate-100/80 dark:from-slate-900/50 dark:to-slate-800/50 p-4 sm:p-5 shadow-md overflow-hidden min-w-0">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">System snapshot</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {systemSnapshot.i130 && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">I-130</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{formatDate(systemSnapshot.i130.latestPD)}</p>
                    {systemSnapshot.i130.avgDays != null && <p className="text-xs text-[var(--text-secondary)]">~{Math.round(systemSnapshot.i130.avgDays)} days avg</p>}
                  </div>
                </div>
              )}
              {systemSnapshot.i129f && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">I-129F</span>
                  <div className="text-right">
                    <p className="text-sm font-bold text-[var(--text-primary)]">{formatDate(systemSnapshot.i129f.latestPD)}</p>
                    {systemSnapshot.i129f.avgDays != null && <p className="text-xs text-[var(--text-secondary)]">~{Math.round(systemSnapshot.i129f.avgDays)} days avg</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Today's Overview — hero card */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-5 lg:p-6 shadow-md hover:shadow-lg transition-shadow overflow-hidden min-w-0">
          <div className="flex items-center gap-3 mb-4">
            <ChartBarIcon className="w-6 h-6 text-[var(--text-primary)]" />
            <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary)]">Today&apos;s Overview</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Your priority date</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {profile?.priorityDate ? formatDate(new Date(profile.priorityDate)) : "—"}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {currentLatestPD ? `Latest approved: ${formatDate(currentLatestPD)}` : loading ? "Loading…" : "Add profile for your date"}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Approvals</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {casesMoved !== null ? `+${casesMoved} today` : recentApprovalsCount !== null ? `${recentApprovalsCount}` : "—"}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{casesMoved !== null ? "Today" : recentApprovalsCount !== null ? "Last 7 days" : "—"}</p>
            </div>
            <div className="p-4 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Est. remaining</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">
                {queuePosition?.daysRemaining ? `~${queuePosition.daysRemaining} days` : pdStatsExtra?.avgTimeDays != null ? `~${Math.round(pdStatsExtra.avgTimeDays)} days avg` : "—"}
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-1">Current estimate</p>
            </div>
          </div>
        </div>

        {/* Two-column: Queue Position + Today's Movement */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 min-w-0">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-5 shadow-md hover:shadow-lg transition-shadow overflow-hidden min-w-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <ArrowTrendingUpIcon className="w-6 h-6 text-[var(--text-primary)]" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">Your Position</h3>
              </div>
              <Link href="/tools/queue-position" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
                View Details →
              </Link>
            </div>
            <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">Queue position</p>
              <p className="text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-1">
                {queuePosition?.position ? `#${queuePosition.position.toLocaleString()}` : "—"}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                {queuePosition?.daysRemaining ? `Est. approval: ~${queuePosition.daysRemaining} days` : profile ? "Calculating..." : "Complete your profile to see queue position"}
              </p>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-5 shadow-md hover:shadow-lg transition-shadow overflow-hidden min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <ClockIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">Today&apos;s Movement</h3>
            </div>
            {casesMoved !== null ? (
              <div className="p-4 rounded-xl bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border border-green-200 dark:border-green-800">
                <p className="text-xl font-bold text-green-800 dark:text-green-300 mb-1">+{casesMoved} today</p>
                <p className="text-sm text-[var(--text-secondary)]">cases moved forward</p>
              </div>
            ) : recentApprovalsCount !== null ? (
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-50 to-green-100 dark:from-emerald-900/20 dark:to-green-800/20 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300 mb-1">{recentApprovalsCount}</p>
                <p className="text-sm text-[var(--text-secondary)]">approvals in last 7 days</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
                <p className="text-sm font-semibold text-[var(--text-primary)] mb-1">Data refreshes daily</p>
                <p className="text-xs text-[var(--text-secondary)]">See Statistics for approval trends.</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Updates + Latest News row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 min-w-0">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-5 shadow-md hover:shadow-lg transition-shadow overflow-hidden min-w-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Recent Updates</h3>
              <Link href="/settings" className="text-sm font-medium text-[var(--text-primary)] hover:underline">
                Manage →
              </Link>
            </div>
            {notifications.length === 0 ? (
              <div className="text-center py-6 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
                <CheckCircleIcon className="w-10 h-10 text-[var(--text-tertiary)] mx-auto mb-2 opacity-60" />
                <p className="text-sm text-[var(--text-secondary)]">No recent notifications</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => (
                  <div key={notif.id} className="p-3 sm:p-4 rounded-xl bg-[var(--bg-surface-alt)] border-l-4 border-[var(--uscis-blue)]">
                    <p className="font-semibold text-[var(--text-primary)] mb-1">{notif.title}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{notif.body}</p>
                    <span className="text-xs text-[var(--text-tertiary)] mt-2 block">
                      {notif.createdAt ? format(notif.createdAt?.toDate?.() || new Date(notif.createdAt), "MMM d") : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-5 shadow-md hover:shadow-lg transition-shadow overflow-hidden min-w-0">
            <div className="flex items-center gap-3 mb-4">
              <NewspaperIcon className="w-6 h-6 text-[var(--text-primary)]" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">Latest News</h3>
            </div>
            {latestNews ? (
              <div className="p-4 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
                <p className="font-semibold text-[var(--text-primary)] mb-2">{latestNews.title}</p>
                <p className="text-sm text-[var(--text-secondary)]">{latestNews.summary || latestNews.body}</p>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)]">
                <p className="text-sm text-[var(--text-secondary)]">No news items right now. Check back later.</p>
              </div>
            )}
          </div>
        </div>

        {/* Today's Tip — full width */}
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-5 shadow-md hover:shadow-lg transition-shadow overflow-hidden min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <LightBulbIcon className="w-6 h-6 text-sky-600 dark:text-sky-400" />
            <h3 className="text-base font-bold text-[var(--text-primary)]">Today&apos;s Tip</h3>
          </div>
          <div className="p-4 rounded-xl bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-900/20 dark:to-blue-900/20 border border-sky-200 dark:border-sky-800">
            <p className="text-[var(--text-primary)] font-medium">{randomTip}</p>
          </div>
        </div>

        {/* Bottom strip — back to dashboard + stats */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 py-4 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-sm min-w-0">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 7l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            Back to dashboard
          </Link>
          <span className="text-[var(--text-tertiary)] hidden sm:inline">·</span>
          <Link href="/stats" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] hover:text-[var(--text-primary)] transition-colors">
            <ChartBarIcon className="w-4 h-4" />
            Statistics
          </Link>
        </div>
      </main>
    </div>
  );
}

