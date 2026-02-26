"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { generateTimeline } from "@/lib/services/timelineService";
import { TimelineStage } from "@/lib/types";
import { HERO_IMAGES } from "@/lib/images";

interface Milestone {
  id: string;
  date: Date;
  title: string;
  type: "receipt" | "biometrics" | "interview" | "approval" | "outsideNormal";
}

export default function TimelineAlertsPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const [receiptToggle, setReceiptToggle] = useState(true);
  const [biometricsToggle, setBiometricsToggle] = useState(false);
  const [interviewToggle, setInterviewToggle] = useState(true);
  const [approvalToggle, setApprovalToggle] = useState(true);
  const [outsideNormalToggle, setOutsideNormalToggle] = useState(false);
  const [notificationLevel, setNotificationLevel] = useState(1); // 0: Off, 1: Important only, 2: All
  const [calendarSyncEnabled, setCalendarSyncEnabled] = useState(false);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: "success" | "info" } | null>(null);

  const showMessage = (text: string, type: "success" | "info" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    loadAlertSettings();
  }, [user]);

  useEffect(() => {
    if (!profile?.priorityDate) {
      setMilestones([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const priorityDate = new Date(profile.priorityDate!);
        const timeline = await generateTimeline(
          profile.formType || "I-130",
          priorityDate,
          profile.country,
          profile.processingPath as "Consular" | "AOS" | undefined,
          undefined,
          profile.currentStage,
          profile.serviceCenter
        );

        if (cancelled) return;
        if (!timeline) {
          setMilestones([]);
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const upcomingMilestones: Milestone[] = [];

        const toDate = (d: unknown): Date | null => {
          if (!d) return null;
          if (d instanceof Date) return isNaN(d.getTime()) ? null : d;
          if (typeof d === "string") {
            const parsed = new Date(d);
            return isNaN(parsed.getTime()) ? null : parsed;
          }
          if (typeof d === "object" && d !== null && "toDate" in d && typeof (d as { toDate: () => Date }).toDate === "function") {
            return (d as { toDate: () => Date }).toDate();
          }
          return null;
        };

        for (const stage of timeline.stages) {
          if (stage.isCompleted) continue;

          const rawDate = stage.latestDate || stage.earliestDate;
          const stageDate = toDate(rawDate);
          if (!stageDate || stageDate <= today) continue;

          let milestoneType: Milestone["type"];
          let milestoneTitle = stage.name;

          const stageId = stage.id.toLowerCase();
          if (stageId.includes("receipt") || stageId.includes("noa1")) {
            milestoneType = "receipt";
            milestoneTitle = "Receipt Notice Expected";
          } else if (stageId.includes("biometric") || stageId.includes("fingerprint")) {
            milestoneType = "biometrics";
            milestoneTitle = "Biometrics Appointment Expected";
        } else if (stageId.includes("interview") || stageId.includes("medical") || stageId.includes("embassy") || stageId.includes("dq") || stageId.includes("nvc")) {
          milestoneType = "interview";
          milestoneTitle = stage.name;
        } else if (stageId.includes("visa_issued") || stageId.includes("approval") || stageId.includes("approved") || stageId.includes("noa2")) {
            milestoneType = "approval";
            milestoneTitle = stage.name.includes("Approval") ? stage.name : "Approval Expected";
          } else if (stageId.includes("outside") || stageId.includes("delayed")) {
            milestoneType = "outsideNormal";
            milestoneTitle = stage.name;
          } else {
            milestoneType = "approval";
          }

          upcomingMilestones.push({
            id: stage.id,
            date: stageDate,
            title: milestoneTitle,
            type: milestoneType,
          });
        }

        if (cancelled) return;

        upcomingMilestones.sort((a, b) => a.date.getTime() - b.date.getTime());
        setMilestones(upcomingMilestones.slice(0, 10));
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading milestones:", error);
          setMilestones([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [profile?.priorityDate, profile?.formType, profile?.country, profile?.processingPath, profile?.serviceCenter]);

  const loadAlertSettings = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setReceiptToggle(data.timelineAlertReceipt ?? true);
        setBiometricsToggle(data.timelineAlertBiometrics ?? false);
        setInterviewToggle(data.timelineAlertInterview ?? true);
        setApprovalToggle(data.timelineAlertApproval ?? true);
        setOutsideNormalToggle(data.timelineAlertOutsideNormal ?? false);
        setNotificationLevel(data.timelineNotificationLevel ?? 1);
        setCalendarSyncEnabled(data.calendarSyncEnabled ?? false);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error loading alert settings:", error);
      setLoading(false);
    }
  };

  const saveAlertSettings = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      await setDoc(
        docRef,
        {
          timelineAlertReceipt: receiptToggle,
          timelineAlertBiometrics: biometricsToggle,
          timelineAlertInterview: interviewToggle,
          timelineAlertApproval: approvalToggle,
          timelineAlertOutsideNormal: outsideNormalToggle,
          timelineNotificationLevel: notificationLevel,
          calendarSyncEnabled: calendarSyncEnabled,
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error saving alert settings:", error);
    }
  };

  const requestNotificationPermission = async () => {
    if ("Notification" in window) {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        showMessage("Notifications enabled");
        saveAlertSettings();
      } else if (permission === "denied") {
        showMessage("Notifications blocked. Enable in browser settings.", "info");
      }
    } else {
      showMessage("Your browser doesn't support notifications.", "info");
    }
  };

  const syncToCalendar = () => {
    if (milestones.length === 0) {
      showMessage("Complete your profile to see milestones.", "info");
      return;
    }

    // Generate .ics file for calendar import
    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//VisaNova//Timeline Alerts//EN\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n";
    
    const enabledMilestones = milestones.filter((milestone) => {
      return (
        (milestone.type === "receipt" && receiptToggle) ||
        (milestone.type === "biometrics" && biometricsToggle) ||
        (milestone.type === "interview" && interviewToggle) ||
        (milestone.type === "approval" && approvalToggle) ||
        (milestone.type === "outsideNormal" && outsideNormalToggle)
      );
    });

    for (const milestone of enabledMilestones) {
      const dateStr = milestone.date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const nowStr = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
      const uid = `${milestone.id}-${milestone.date.getTime()}@visanova.app`;
      
      icsContent += `BEGIN:VEVENT\n`;
      icsContent += `UID:${uid}\n`;
      icsContent += `DTSTAMP:${nowStr}\n`;
      icsContent += `DTSTART:${dateStr}\n`;
      icsContent += `DTEND:${dateStr}\n`;
      icsContent += `SUMMARY:${milestone.title}\n`;
      icsContent += `DESCRIPTION:Immigration case milestone - ${milestone.title}\n`;
      icsContent += `STATUS:CONFIRMED\n`;
      icsContent += `END:VEVENT\n`;
    }
    
    icsContent += "END:VCALENDAR\n";

    // Download .ics file
    const blob = new Blob([icsContent], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "visanova-timeline-milestones.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showMessage(`Exported ${enabledMilestones.length} milestone(s). Import the .ics file into your calendar.`);
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  };

  const getDaysUntil = (date: Date) => {
    const days = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  useEffect(() => {
    if (user && !loading) {
      saveAlertSettings();
    }
  }, [receiptToggle, biometricsToggle, interviewToggle, approvalToggle, outsideNormalToggle, notificationLevel, calendarSyncEnabled, loading, user]);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Hero Header */}
      <div className="surface-dark relative overflow-hidden bg-[var(--hero-dark)] border-b-2 border-[var(--uscis-blue)]">
        <div className="absolute inset-0 w-full">
          <Image src={HERO_IMAGES.calendar} alt="" fill className="object-cover object-center opacity-20 w-full" sizes="100vw" />
          <div className="absolute inset-0 bg-[var(--hero-dark)]/70" />
        </div>
        <div className="h-0.5 bg-gradient-to-r from-[var(--uscis-blue)] via-[var(--uscis-blue-light)] to-[var(--uscis-blue)]" aria-hidden="true" />
        <div className="relative w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-6 w-full min-w-0">
          <h1 className="text-2xl font-bold text-white">Timeline Alerts & Reminders</h1>
          <p className="text-sm text-white/90 mt-1">
            Smart notifications + calendar sync for your immigration milestones
          </p>
        </div>
      </div>
      <div className="w-full mx-auto px-2 min-[380px]:px-3 sm:px-6 lg:px-8 py-8 w-full min-w-0">
        <div className="uscis-card mb-6">
          <div className="p-6">
            {message && (
              <div
                className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
                  message.type === "success"
                    ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200"
                    : "bg-blue-50 dark:bg-blue-900/20 text-gray-800 dark:text-gray-200"
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Notification Permissions */}
            <div className="uscis-card mb-6">
              <div className="p-4">
                <h3 className="font-semibold text-[var(--text-primary)] mb-3">Browser Notifications</h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                  Enable browser notifications to receive alerts for important milestones.
                </p>
                <button
                  onClick={requestNotificationPermission}
                  className="uscis-button"
                >
                  Enable Notifications
                </button>
              </div>
            </div>

            {/* Alert Preferences */}
            <div className="uscis-card mb-6">
              <div className="p-4">
                <h3 className="font-semibold text-[var(--text-primary)] mb-4">Alert Preferences</h3>
                <div className="space-y-4">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Receipt Notice</p>
                      <p className="text-xs text-[var(--text-secondary)]">Get notified when receipt notice is expected</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={receiptToggle}
                      onChange={(e) => setReceiptToggle(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-gray-800 dark:text-gray-200 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Biometrics Appointment</p>
                      <p className="text-xs text-[var(--text-secondary)]">Get notified about biometrics scheduling</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={biometricsToggle}
                      onChange={(e) => setBiometricsToggle(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-gray-800 dark:text-gray-200 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Interview</p>
                      <p className="text-xs text-[var(--text-secondary)]">Get notified when interview is scheduled</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={interviewToggle}
                      onChange={(e) => setInterviewToggle(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-gray-800 dark:text-gray-200 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Approval</p>
                      <p className="text-xs text-[var(--text-secondary)]">Get notified of approval milestones</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={approvalToggle}
                      onChange={(e) => setApprovalToggle(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-gray-800 dark:text-gray-200 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">Outside Normal Processing</p>
                      <p className="text-xs text-[var(--text-secondary)]">Get notified if your case falls outside normal processing times</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={outsideNormalToggle}
                      onChange={(e) => setOutsideNormalToggle(e.target.checked)}
                      className="w-5 h-5 rounded border-gray-300 text-gray-800 dark:text-gray-200 focus:ring-blue-500"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Notification Level */}
            <div className="uscis-card mb-6">
              <div className="p-4">
                <h3 className="font-semibold text-[var(--text-primary)] mb-3">Notification Level</h3>
                <div className="space-y-2">
                  {[
                    { value: 0, label: "Off", description: "No notifications" },
                    { value: 1, label: "Important Only", description: "Only critical milestones" },
                    { value: 2, label: "All Updates", description: "All timeline milestones" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-[var(--bg-surface-alt)] cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="notificationLevel"
                        value={option.value}
                        checked={notificationLevel === option.value}
                        onChange={() => setNotificationLevel(option.value)}
                        className="w-4 h-4 text-gray-800 dark:text-gray-200 focus:ring-blue-500"
                      />
                      <div>
                        <p className="font-medium text-[var(--text-primary)]">{option.label}</p>
                        <p className="text-xs text-[var(--text-secondary)]">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Upcoming Milestones */}
            <div className="uscis-card mb-6">
              <div className="p-4">
                <h3 className="font-semibold text-[var(--text-primary)] mb-4">Upcoming Milestones</h3>
                {loading ? (
                  <div className="py-8 text-center">
                    <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent mb-2"></div>
                    <p className="text-xs text-[var(--text-secondary)]">Loading milestones...</p>
                  </div>
                ) : milestones.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-[var(--text-secondary)] mb-3">
                      {profile?.priorityDate
                        ? "No upcoming milestones found. Check back later as processing times update."
                        : "Add your priority date and case details to see upcoming milestones."}
                    </p>
                    {!profile?.priorityDate && (
                      <Link
                        href="/profile-setup"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--uscis-blue)] text-white text-sm font-medium hover:opacity-90"
                      >
                        Set Up Profile
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {milestones.map((milestone) => {
                      const daysUntil = getDaysUntil(milestone.date);
                      const isEnabled =
                        (milestone.type === "receipt" && receiptToggle) ||
                        (milestone.type === "biometrics" && biometricsToggle) ||
                        (milestone.type === "interview" && interviewToggle) ||
                        (milestone.type === "approval" && approvalToggle) ||
                        (milestone.type === "outsideNormal" && outsideNormalToggle);

                      return (
                        <div
                          key={milestone.id}
                          className="flex items-center justify-between p-3 bg-[var(--bg-surface-alt)] rounded-lg border border-[var(--border-color)]"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-medium text-[var(--text-primary)]">{milestone.title}</p>
                              {isEnabled && (
                                <span className="text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                                  Enabled
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--text-secondary)] mt-1">
                              {formatDate(milestone.date)} ({daysUntil > 0 ? `${daysUntil} days` : "Today"})
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Calendar Sync */}
            <div className="uscis-card mb-6">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)]">Calendar Sync</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Add milestones to your calendar
                    </p>
                  </div>
                  <button
                    onClick={syncToCalendar}
                    className="uscis-button"
                  >
                    Sync Now
                  </button>
                </div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={calendarSyncEnabled}
                    onChange={(e) => setCalendarSyncEnabled(e.target.checked)}
                    className="w-5 h-5 rounded border-gray-300 text-gray-800 dark:text-gray-200 focus:ring-blue-500"
                  />
                  <div>
                    <span className="text-sm text-[var(--text-primary)]">Save preference for future auto-sync</span>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">Use &quot;Sync Now&quot; to download .ics file for import.</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-6">
              <Link href="/tools/case-tools" className="uscis-link text-sm font-semibold">
                ← Back to Case Tools
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

