"use client";

import { useAuth } from "@/contexts/AuthContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useEffect, useState } from "react";

interface UserProfile {
  formType?: string;
  priorityDate?: string;
  serviceCenter?: string;
  country?: string;
}

export default function WhatsNextForYouSection() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const profileRef = doc(db, "userProfiles", user.uid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
          setProfile(profileSnap.data() as UserProfile);
        }
      } catch (error) {
        console.error("Error loading profile:", error);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [user]);

  if (loading || !profile || !profile.priorityDate) {
    return null;
  }

  // Determine current stage based on case age
  const getCurrentStage = (): "uscis" | "approved" | "nvc" | "dq" | "medical" | "interview" | "visaIssued" => {
    const pdDate = new Date(profile.priorityDate!);
    const caseAge = Math.floor((Date.now() - pdDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (caseAge < 180) return "uscis";
    if (caseAge < 360) return "uscis";
    if (caseAge < 540) return "approved";
    return "nvc";
  };

  const currentStage = getCurrentStage();
  const estimatedDate = profile.priorityDate
    ? new Date(new Date(profile.priorityDate).getTime() + 480 * 24 * 60 * 60 * 1000)
    : null;

  const nextActionText = {
    uscis: "Expected review:",
    approved: "Awaiting DQ status:",
    nvc: "Awaiting DQ status:",
    dq: "Schedule medical exam:",
    medical: "Prepare for interview:",
    interview: "Awaiting visa issuance:",
    visaIssued: "Visa issued",
  }[currentStage];

  return (
    <div className="uscis-card">
      <div className="uscis-card-header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-gray-800 dark:text-gray-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">What Happens Next For You</h3>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              Your personalized next steps
            </p>
          </div>
        </div>
      </div>
      <div className="p-6">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-[var(--text-secondary)] mb-2">{nextActionText}</p>
            {estimatedDate && (
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-gray-800 dark:text-gray-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                  {estimatedDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
