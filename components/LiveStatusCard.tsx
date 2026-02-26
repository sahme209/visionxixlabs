"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import USCISStatusAPIDebug from "./USCISStatusAPIDebug";
import {
  ClockIcon,
  CheckCircleIcon,
  DocumentIcon,
  CheckIcon,
  BuildingOfficeIcon,
  CalendarIcon,
  UserIcon,
  PaperAirplaneIcon,
} from "@heroicons/react/24/solid";

type CaseMilestone = 
  | "uscis_processing"
  | "uscis_approved_sent_to_nvc"
  | "nvc_case_created"
  | "dq"
  | "medical_done"
  | "interview_scheduled"
  | "interview_done"
  | "visa_issued";

type CaseStage = "uscis" | "approved" | "nvc" | "dq" | "medical" | "interview" | "visaIssued";

interface LiveStatusCardProps {
  currentStage: CaseStage;
  milestoneSource?: "predicted" | "user_confirmed" | "auto_advanced";
  milestoneDate?: Date;
}

function milestoneFromCaseStage(stage: CaseStage): CaseMilestone {
  switch (stage) {
    case "uscis":
      return "uscis_processing";
    case "approved":
      return "uscis_approved_sent_to_nvc";
    case "nvc":
      return "nvc_case_created";
    case "dq":
      return "dq";
    case "medical":
      return "medical_done";
    case "interview":
      return "interview_scheduled";
    case "visaIssued":
      return "visa_issued";
    default:
      return "uscis_processing";
  }
}

function liveStatusText(milestone: CaseMilestone): string {
  switch (milestone) {
    case "uscis_processing":
      return "Case is still being processed by USCIS";
    case "uscis_approved_sent_to_nvc":
      return "Case was approved and sent to NVC";
    case "nvc_case_created":
      return "NVC case number created — preparing next steps";
    case "dq":
      return "Documentarily Qualified (DQ) — awaiting interview queue";
    case "medical_done":
      return "Medical completed — waiting for interview";
    case "interview_scheduled":
      return "Interview scheduled";
    case "interview_done":
      return "Interview completed — awaiting visa decision";
    case "visa_issued":
      return "Visa issued";
  }
}

function encouragingMessage(milestone: CaseMilestone): string {
  switch (milestone) {
    case "uscis_processing":
      return "Your case is actively being reviewed. Processing times vary, and your case is moving through the system.";
    case "uscis_approved_sent_to_nvc":
      return "Your petition has been approved and forwarded to the National Visa Center. Next steps will be communicated by NVC.";
    case "nvc_case_created":
      return "Your case has been received by NVC. Prepare your required documents to expedite the next phase of processing.";
    case "dq":
      return "You have been documentarily qualified. Your case is now in queue for interview scheduling at the embassy.";
    case "medical_done":
      return "Medical examination completed. Your case is ready for interview scheduling. Continue monitoring for updates.";
    case "interview_scheduled":
      return "Interview date has been scheduled. Prepare all required documents and review interview guidelines.";
    case "interview_done":
      return "Interview completed successfully. Your case is under final administrative review for visa issuance.";
    case "visa_issued":
      return "Your visa has been issued. Review the validity dates and prepare for travel. Safe journey ahead.";
  }
}

function milestoneIcon(milestone: CaseMilestone): React.ComponentType<{ className?: string }> {
  switch (milestone) {
    case "uscis_processing":
      return ClockIcon;
    case "uscis_approved_sent_to_nvc":
      return CheckCircleIcon;
    case "nvc_case_created":
      return DocumentIcon;
    case "dq":
      return CheckIcon;
    case "medical_done":
      return BuildingOfficeIcon;
    case "interview_scheduled":
      return CalendarIcon;
    case "interview_done":
      return UserIcon;
    case "visa_issued":
      return PaperAirplaneIcon;
  }
}

function milestoneColor(milestone: CaseMilestone): string {
  switch (milestone) {
    case "uscis_processing":
      return "blue";
    case "uscis_approved_sent_to_nvc":
      return "green";
    case "nvc_case_created":
      return "blue";
    case "dq":
      return "orange";
    case "medical_done":
      return "purple";
    case "interview_scheduled":
      return "indigo";
    case "interview_done":
      return "green";
    case "visa_issued":
      return "green";
  }
}

function progressChecklist(milestone: CaseMilestone): Array<{ text: string; isCompleted: boolean }> {
  switch (milestone) {
    case "uscis_processing":
      return [
        { text: "Case has been submitted", isCompleted: true },
        { text: "Case is still being processed", isCompleted: false },
      ];
    case "uscis_approved_sent_to_nvc":
      return [
        { text: "Case has been submitted", isCompleted: true },
        { text: "Case approved by USCIS", isCompleted: true },
        { text: "Case forwarded to NVC", isCompleted: false },
      ];
    case "nvc_case_created":
      return [
        { text: "Case has been submitted", isCompleted: true },
        { text: "Case approved by USCIS", isCompleted: true },
        { text: "NVC case number assigned", isCompleted: true },
        { text: "Document submission in progress", isCompleted: false },
      ];
    case "dq":
      return [
        { text: "Case has been submitted", isCompleted: true },
        { text: "Case approved by USCIS", isCompleted: true },
        { text: "NVC case number assigned", isCompleted: true },
        { text: "Documentarily qualified (DQ)", isCompleted: true },
        { text: "Interview scheduling", isCompleted: false },
      ];
    case "medical_done":
      return [
        { text: "Case has been submitted", isCompleted: true },
        { text: "Case approved by USCIS", isCompleted: true },
        { text: "NVC case number assigned", isCompleted: true },
        { text: "Documentarily qualified (DQ)", isCompleted: true },
        { text: "Medical examination completed", isCompleted: true },
        { text: "Interview scheduling", isCompleted: false },
      ];
    case "interview_scheduled":
      return [
        { text: "Case has been submitted", isCompleted: true },
        { text: "Case approved by USCIS", isCompleted: true },
        { text: "NVC case number assigned", isCompleted: true },
        { text: "Documentarily qualified (DQ)", isCompleted: true },
        { text: "Medical examination completed", isCompleted: true },
        { text: "Interview scheduled", isCompleted: true },
        { text: "Interview completion", isCompleted: false },
      ];
    case "interview_done":
      return [
        { text: "Case has been submitted", isCompleted: true },
        { text: "Case approved by USCIS", isCompleted: true },
        { text: "NVC case number assigned", isCompleted: true },
        { text: "Documentarily qualified (DQ)", isCompleted: true },
        { text: "Medical examination completed", isCompleted: true },
        { text: "Interview scheduled", isCompleted: true },
        { text: "Interview completed", isCompleted: true },
        { text: "Visa issuance", isCompleted: false },
      ];
    case "visa_issued":
      return [
        { text: "Case has been submitted", isCompleted: true },
        { text: "Case approved by USCIS", isCompleted: true },
        { text: "NVC case number assigned", isCompleted: true },
        { text: "Documentarily qualified (DQ)", isCompleted: true },
        { text: "Medical examination completed", isCompleted: true },
        { text: "Interview scheduled", isCompleted: true },
        { text: "Interview completed", isCompleted: true },
        { text: "Visa issued", isCompleted: true },
      ];
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) {
    return "just now";
  } else if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export default function LiveStatusCard({
  currentStage,
  milestoneSource = "predicted",
  milestoneDate,
}: LiveStatusCardProps) {
  const router = useRouter();
  const milestone = milestoneFromCaseStage(currentStage);
  const statusText = liveStatusText(milestone);
  const encouragingMsg = encouragingMessage(milestone);
  const icon = milestoneIcon(milestone);
  const color = milestoneColor(milestone);
  const checklist = progressChecklist(milestone);
  const lastUpdated = milestoneDate || new Date();

  // Secret 7-tap USCIS debug trigger on the clock icon
  const [secretTapCount, setSecretTapCount] = useState(0);
  const [showDebugView, setShowDebugView] = useState(false);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const SECRET_TAP_THRESHOLD = 7;
  const TAP_TIMEOUT_MS = 3000;

  const handleSecretTap = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    setSecretTapCount((prev) => {
      const next = prev + 1;
      console.log(`[LiveStatusCard] Secret tap on clock icon: ${next}/${SECRET_TAP_THRESHOLD}`);

      if (next >= SECRET_TAP_THRESHOLD) {
        console.log("[LiveStatusCard] ✅ Showing USCISStatusAPIDebug");
        setShowDebugView(true);
        if (tapTimeoutRef.current) {
          clearTimeout(tapTimeoutRef.current);
          tapTimeoutRef.current = null;
        }
        return 0;
      }

      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }

      tapTimeoutRef.current = setTimeout(() => {
        setSecretTapCount(0);
        console.log("[LiveStatusCard] ⏱️ Secret tap count reset (timeout)");
      }, TAP_TIMEOUT_MS);

      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) {
        clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  const subtitle =
    milestoneSource === "user_confirmed"
      ? "Updated by you"
      : "Based on your case timeline";

  const badgeText = milestoneSource === "user_confirmed" ? "Confirmed" : "Official";
  const showConfirmationPrompt = milestoneSource === "auto_advanced";

  const colorClasses: Record<string, string> = {
    blue: "bg-[var(--uscis-blue)]",
    green: "bg-green-500",
    orange: "bg-red-500",
    purple: "bg-purple-500",
    indigo: "bg-indigo-500",
  };

  return (
    <>
      {showDebugView && (
        <USCISStatusAPIDebug onClose={() => setShowDebugView(false)} />
      )}
      <div className="uscis-card relative">
        {/* Top accent border in USCIS blue - desktop/tablet only to avoid mobile visual glitch */}
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-[var(--uscis-blue)] rounded-t-lg hidden sm:block"></div>

        <div className="p-5">
          {/* Official USCIS Header */}
          <div className="flex items-center gap-2 mb-3">
            <svg
              className="w-4 h-4 text-[var(--text-primary)]"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-xs font-medium text-[var(--text-primary)]">
              U.S. Citizenship and Immigration Services
            </span>
          </div>

          {/* Header section */}
          <div className="flex items-start gap-3 mb-5">
            {/* Icon with secret tap handler */}
            <button
              type="button"
              onClick={handleSecretTap}
              className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center text-white flex-shrink-0 cursor-pointer hover:opacity-90 active:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-white/60 focus:ring-offset-2`}
              aria-label="Case Status Icon"
            >
              {React.createElement(icon, { className: "w-6 h-6" })}
            </button>

          {/* Title and status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                USCIS Case Status
              </h3>
              {badgeText && (
                <span className="text-[9px] font-bold tracking-wide uppercase text-white bg-green-500 px-2 py-1 rounded-full">
                  {badgeText}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-[var(--text-secondary)] leading-snug">
              {statusText}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-[var(--border-color)] mb-5"></div>

        {/* Progress checklist */}
        <div className="space-y-2.5 mb-4">
          {checklist.map((item, index) => (
            <div key={index} className="flex items-center gap-2.5">
              {item.isCompleted ? (
                <div className="w-4.5 h-4.5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="w-2.5 h-2.5 text-white"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              ) : (
                <div className="w-4.5 h-4.5 rounded-full border-2 border-[var(--border-color)] flex-shrink-0"></div>
              )}
              <span
                className={`text-xs ${
                  item.isCompleted
                    ? "font-medium text-[var(--text-primary)] line-through opacity-60"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {item.text}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg
                className="w-3 h-3 text-[var(--text-secondary)] opacity-70"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-xs text-[var(--text-secondary)]">
                {subtitle}
              </span>
            </div>
            {showConfirmationPrompt && (
              <Link
                href="/profile-setup"
                className="text-xs font-medium px-2.5 py-1 rounded-full"
                style={{ color: `var(--uscis-${color})` }}
              >
                Confirm
              </Link>
            )}
          </div>

          {/* Official USCIS data badge */}
          <div className="flex items-center gap-1">
            <svg
              className="w-2.5 h-2.5 text-[var(--text-primary)] opacity-80"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-[10px] font-medium text-[var(--text-primary)] opacity-80">
              Official USCIS data
            </span>
          </div>
        </div>
      </div>

      {/* Edit button with pencil and text */}
      <Link
        href="/profile-setup"
        className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--uscis-blue)]/10 hover:bg-[var(--uscis-blue)]/20 transition-colors"
        title="Edit case status"
      >
        <svg
          className="w-3 h-3 text-[var(--text-primary)]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
          />
        </svg>
        <span className="text-xs font-semibold text-[var(--text-primary)]">Edit</span>
      </Link>
    </div>
    </>
  );
}
