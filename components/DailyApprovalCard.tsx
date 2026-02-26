"use client";

import React from "react";
import { useState, useEffect } from "react";
import { collection, query, where, orderBy, limit, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ExclamationTriangleIcon, StarIcon, DocumentIcon, ClockIcon, CheckCircleIcon } from "@heroicons/react/24/solid";
import { PremiumUpsell } from "./PremiumUpsell";
import LoadingState from "./LoadingState";
import Tooltip from "./Tooltip";
import OfficialBadge from "./OfficialBadge";
import DataSourceIndicator from "./DataSourceIndicator";

interface DailyApprovalCardProps {
  formType?: string; // Used to determine initial selected type
  isSubscribed?: boolean; // For premium gating
}

type ApprovalType = "i130" | "i129f";

interface DailyApproval {
  id: string;
  title: string;
  body: string;
  createdAt: Date | null;
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const approvalDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (approvalDate.getTime() === today.getTime()) {
    return `Today at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  } else if (approvalDate.getTime() === yesterday.getTime()) {
    return `Yesterday at ${date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  } else {
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
}

/**
 * Daily Approval Card
 * Exact match of iOS DailyApprovalCard.swift
 */
export default function DailyApprovalCard({ formType, isSubscribed = false }: DailyApprovalCardProps) {
  // Determine initial selected type based on user's form type
  const getInitialType = (): ApprovalType => {
    if (!formType) return "i130";
    const formTypeUpper = formType.toUpperCase();
    if (
      formTypeUpper.includes("I-129F") ||
      formTypeUpper.includes("I129F") ||
      formTypeUpper.includes("K-1") ||
      formTypeUpper.includes("K1")
    ) {
      return "i129f";
    }
    return "i130";
  };

  const [selectedType, setSelectedType] = useState<ApprovalType>(getInitialType());
  const [approvals, setApprovals] = useState<DailyApproval[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isSubscribed) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const collectionName = selectedType === "i130" ? "dailyApproval" : "i129fApprovals";
    
    if (!collectionName || collectionName.trim() === "") {
      console.warn("[DailyApprovalCard] Empty collection name, skipping query");
      setApprovals([]);
      setIsLoading(false);
      return;
    }

    let q;
    try {
      if (collectionName === "i129fApprovals") {
        // Use composite index: formType + createdAt (desc)
        q = query(
          collection(db, collectionName),
          where("formType", "==", "I-129F"),
          orderBy("createdAt", "desc"),
          limit(50)
        );
      } else {
        // dailyApproval collection uses regular collection (not a collectionGroup)
        q = query(collection(db, collectionName), orderBy("createdAt", "desc"), limit(50));
      }
    } catch (queryError: any) {
      console.error(`[DailyApprovalCard] Error creating query for ${selectedType}:`, queryError);
      setApprovals([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const approvalData: DailyApproval[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          approvalData.push({
            id: doc.id,
            title: data.title || "",
            body: data.body || "",
            createdAt: data.createdAt?.toDate?.() || null,
          });
        });

        setApprovals(approvalData);
        setIsLoading(false);
      },
      (err: any) => {
        const isIndexError =
          err?.code === "failed-precondition" ||
          (typeof err?.message === "string" && err.message.toLowerCase().includes("index"));
        const isPermissionError =
          err?.code === "permission-denied" ||
          (typeof err?.message === "string" &&
            (err.message.toLowerCase().includes("permission") ||
              err.message.toLowerCase().includes("insufficient")));

        if (isIndexError) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[DailyApprovalCard] Index missing for ${selectedType}, using fallback`);
          }
          // Try without orderBy as fallback
          try {
            const fallbackQ = query(collection(db, collectionName), limit(50));
            const fallbackUnsub = onSnapshot(
              fallbackQ,
              (snap) => {
                const data: DailyApproval[] = [];
                snap.forEach((doc) => {
                  const docData = doc.data();
                  data.push({
                    id: doc.id,
                    title: docData.title || "",
                    body: docData.body || "",
                    createdAt: docData.createdAt?.toDate?.() || null,
                  });
                });
                // Sort in memory by createdAt desc
                data.sort((a, b) => {
                  if (!a.createdAt || !b.createdAt) return 0;
                  return b.createdAt.getTime() - a.createdAt.getTime();
                });
                setApprovals(data.slice(0, 50));
                setIsLoading(false);
              },
              (fallbackErr: any) => {
                if (process.env.NODE_ENV === "development") {
                  console.warn(`[DailyApprovalCard] Fallback query also failed for ${selectedType}:`, fallbackErr);
                }
                setApprovals([]);
                setIsLoading(false);
              }
            );
            return () => fallbackUnsub();
          } catch (fallbackError) {
            if (process.env.NODE_ENV === "development") {
              console.warn(`[DailyApprovalCard] Fallback query creation failed:`, fallbackError);
            }
            setApprovals([]);
            setIsLoading(false);
          }
        } else if (isPermissionError) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[DailyApprovalCard] Permission denied for ${selectedType}`);
          }
          setApprovals([]);
          setIsLoading(false);
        } else {
          console.error(`[DailyApprovalCard] Error listening to ${selectedType}:`, err);
          setError(err.message);
          setApprovals([]);
          setIsLoading(false);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [selectedType, isSubscribed]);

  return (
    <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] p-4 sm:p-6 shadow-sm hover:shadow-md transition-shadow w-full min-w-0 overflow-hidden">
      {/* Header - Approvals-style */}
      <div className="mb-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-surface-alt)] border border-[var(--border-color)] flex-shrink-0">
            <CheckCircleIcon className="w-5 h-5 text-[var(--text-primary)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">Daily Approval Activity</h3>
              <Tooltip 
                content="Real-time approval notifications from the community. These are actual case approvals reported by users, updated throughout the day."
                iconOnly 
                position="top"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-[var(--text-secondary)] font-medium">Live Updates</span>
              </div>
              <OfficialBadge variant="verified" size="sm" />
              <DataSourceIndicator source="community" />
            </div>
          </div>
          {isLoading && (
            <div className="ml-auto h-5 w-5 animate-spin rounded-full border-2 border-[var(--uscis-blue)] border-t-transparent flex-shrink-0"></div>
          )}
        </div>

        {/* Segmented Control */}
        <div className="flex gap-1 rounded-xl bg-[var(--bg-surface-alt)] p-1">
          <button
            onClick={() => setSelectedType("i130")}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              selectedType === "i130"
                ? "bg-[var(--uscis-blue)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            I-130
          </button>
          <button
            onClick={() => setSelectedType("i129f")}
            className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
              selectedType === "i129f"
                ? "bg-[var(--uscis-blue)] text-white"
                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            K-1
          </button>
        </div>
      </div>

      {/* Premium check - show paywall message for non-subscribers */}
      {!isSubscribed ? (
        <PremiumUpsellMessage />
      ) : isLoading ? (
        <LoadingState message="Loading approvals" variant="spinner" size="md" className="py-8" />
      ) : approvals.length === 0 ? (
        <EmptyState />
      ) : (
        <ScrollableApprovalsView approvals={approvals} />
      )}

      {/* Error state */}
      {error && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-red-500/10 p-2">
          <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
          <span className="text-xs text-[var(--text-secondary)]">Unable to load: {error}</span>
        </div>
      )}
    </div>
  );
}

// Premium Upsell Message (matches iOS premiumUpsellMessage)
function PremiumUpsellMessage() {
  return (
    <div className="py-4">
      <PremiumUpsell
        title="See Approval Activity As It Happens"
        subtitle="Know immediately when cases like yours get approved"
        features={["Live Daily Approvals Feed", "I-130 Case Tracking", "I-129F (K-1) Updates", "Real-time Notification Alerts"]}
        ctaText="Subscribe to Unlock"
        variant="default"
      />
    </div>
  );
}

// Empty State (matches iOS emptyState)
function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-5 text-center">
      <DocumentIcon className="w-8 h-8 text-[var(--text-secondary)]" />
      <span className="text-sm text-[var(--text-secondary)]">Approval data will appear here</span>
      <p className="max-w-xs text-xs text-[var(--text-secondary)] opacity-70">
        This updates automatically as new information becomes available
      </p>
    </div>
  );
}

// Scrollable Approvals View (matches iOS scrollableApprovalsView)
function ScrollableApprovalsView({ approvals }: { approvals: DailyApproval[] }) {
  return (
    <div className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
      {approvals.map((approval) => (
        <ApprovalCardItem key={approval.id} approval={approval} />
      ))}
    </div>
  );
}

// Approval Card Item (matches iOS ApprovalCardItem)
function ApprovalCardItem({ approval }: { approval: DailyApproval }) {
  return (
    <div className="rounded-lg border border-[var(--border-color)]/50 bg-[var(--bg-surface-alt)]/50 p-4">
      {/* Title */}
      <h4 className="mb-2.5 text-[17px] font-bold leading-tight text-[var(--text-primary)]">
        {approval.title}
      </h4>

      {/* Body */}
      <p className="mb-2 text-sm leading-relaxed text-[var(--text-secondary)]">{approval.body}</p>

      {/* Timestamp */}
      {approval.createdAt && (
        <div className="flex items-center gap-1 pt-1">
          <ClockIcon className="w-3 h-3 text-[var(--text-secondary)] opacity-70" />
          <span className="text-[11px] text-[var(--text-secondary)] opacity-70">
            {formatTimestamp(approval.createdAt)}
          </span>
        </div>
      )}
    </div>
  );
}
