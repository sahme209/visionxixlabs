import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { loadUserProfile, subscribeToProfile, UserProfile } from "@/lib/services/profileService";

export interface UseProfileResult {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  status: "idle" | "auth-loading" | "profile-loading" | "ready" | "missing" | "error";
}

/**
 * Hook to load and subscribe to user profile
 * Matches iOS profile loading pattern with timeout fail-safe
 */
export function useProfile(): UseProfileResult {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [status, setStatus] = useState<UseProfileResult["status"]>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // State machine: authLoading → profileLoading → ready/missing/error
    if (authLoading) {
      setStatus("auth-loading");
      return;
    }

    if (!user) {
      setStatus("idle");
      setProfile(null);
      return;
    }

    // User authenticated, load profile
    setStatus("profile-loading");
    setError(null);

    // Timeout fail-safe (12-15 seconds)
    const timeoutId = setTimeout(() => {
      setStatus("error");
      setError("Profile loading timeout. Please refresh the page.");
    }, 12000);

    // Subscribe to profile changes
    const unsubscribe = subscribeToProfile(user.uid, (profileData) => {
      clearTimeout(timeoutId);

      if (profileData) {
        setProfile(profileData);
        setStatus("ready");
        setError(null);
      } else {
        setProfile(null);
        setStatus("missing");
        setError(null);
      }
    });

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [user, authLoading]);

  return {
    profile,
    loading: status === "auth-loading" || status === "profile-loading",
    error,
    status,
  };
}
