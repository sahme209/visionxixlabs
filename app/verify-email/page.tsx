"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import Image from "next/image";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import { sendEmailVerification, applyActionCode } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";
import { HERO_IMAGES } from "@/lib/images";

function VerifyEmailContent() {
  const { user, loading: authLoading, emailVerified, refreshUser } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [applyingLink, setApplyingLink] = useState<"idle" | "applying" | "done" | "error">("idle");
  const appliedRef = useRef(false);

  const oobCode = searchParams.get("oobCode");
  const mode = searchParams.get("mode");

  // When user lands from the email verify link, apply the code first
  useEffect(() => {
    if (appliedRef.current || applyingLink !== "idle") return;
    if (mode !== "verifyEmail" || !oobCode) return;

    appliedRef.current = true;
    setApplyingLink("applying");

    applyActionCode(auth, oobCode)
      .then(async () => {
        if (typeof window !== "undefined") {
          window.history.replaceState({}, "", "/verify-email");
        }
        setApplyingLink("done");
        setMessage("Email verified! Redirecting...");
        try {
          await refreshUser();
        } catch (_) {}
        const currentUser = auth.currentUser;
        if (currentUser?.emailVerified) {
          setTimeout(() => router.replace("/profile-setup"), 1200);
        } else {
          setTimeout(() => router.replace("/login?verified=1"), 1200);
        }
      })
      .catch((err: any) => {
        setApplyingLink("error");
        if (err.code === "auth/expired-action-code") {
          setError("This verification link has expired. Please request a new one below.");
        } else if (err.code === "auth/invalid-action-code") {
          setError("This verification link is invalid or was already used. You can request a new one below.");
        } else {
          setError("Verification failed. Please try again or request a new link.");
        }
      });
  }, [mode, oobCode, applyingLink, refreshUser, router]);

  useEffect(() => {
    if (applyingLink === "applying" || (mode === "verifyEmail" && oobCode)) return;
    if (!authLoading && !user) {
      router.replace("/login");
      return;
    }

    // Anonymous users don't have email to verify — redirect to home
    if (user?.isAnonymous) {
      router.replace("/");
      return;
    }

    if (user && emailVerified) {
      router.replace("/profile-setup");
      return;
    }

    const checkInterval = setInterval(async () => {
      if (user && !emailVerified) {
        setIsChecking(true);
        try {
          await refreshUser();
          const currentUser = auth.currentUser;
          if (currentUser?.emailVerified) {
            setMessage("Email verified! Redirecting...");
            setTimeout(() => router.replace("/profile-setup"), 1500);
            clearInterval(checkInterval);
          }
        } catch (err) {
          console.error("Error checking verification:", err);
        } finally {
          setIsChecking(false);
        }
      }
    }, 3000);

    return () => clearInterval(checkInterval);
  }, [user, authLoading, emailVerified, refreshUser, router, applyingLink, mode, oobCode]);

  const handleResendVerification = async () => {
    if (!user || isRateLimited) return;

    setIsSending(true);
    setError("");
    setMessage("");

    try {
      const continueUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/verify-email`
          : `${process.env.NEXT_PUBLIC_BASE_URL || "https://visanova.app"}/verify-email`;
      await sendEmailVerification(user, {
        url: continueUrl,
        handleCodeInApp: true,
      });
      setMessage("Verification email sent! Please check your inbox.");
    } catch (err: any) {
      console.error("Error sending verification email:", err);
      if (err.code === "auth/too-many-requests") {
        setError("Too many requests. Please wait 10–15 minutes before trying again.");
        setIsRateLimited(true);
      } else {
        setError("Failed to send verification email. Please try again.");
      }
    } finally {
      setIsSending(false);
    }
  };

  // Stable "Verifying..." when user tapped the email link (applyActionCode in progress)
  if (applyingLink === "applying") {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--uscis-blue)] border-t-transparent mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-[var(--text-primary)] mb-1">Verifying your email</p>
          <p className="text-sm text-[var(--text-secondary)]">One moment…</p>
        </div>
      </div>
    );
  }

  if (authLoading && !oobCode) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--uscis-blue)] border-t-transparent mx-auto mb-4"></div>
          <p className="text-[var(--text-secondary)]">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user && !oobCode) {
    return null;
  }

  // Link failed and no session: show error and sign-in link
  if (applyingLink === "error" && !user) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-md)] p-8 overflow-hidden">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Verification link problem</h1>
              <p className="text-sm text-[var(--text-secondary)] mb-4">{error}</p>
              <Link href="/login" className="text-[var(--text-primary)] font-medium hover:underline">
                Back to sign in
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Link applied: show success briefly before redirect
  if (applyingLink === "done" && message) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-lg font-semibold text-[var(--text-primary)] mb-1">Email verified</p>
          <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-[0.06]">
        <Image src={HERO_IMAGES.passport} alt="" fill className="object-cover" sizes="100vw" />
      </div>
      <div className="relative z-10 max-w-md w-full">
        <div className="rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] shadow-[var(--shadow-md)] overflow-hidden relative">
          <div className="absolute inset-0 opacity-[0.04]">
            <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover" sizes="600px" />
          </div>
          <div className="relative bg-[var(--bg-surface-alt)] border-b border-[var(--border-color)] px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-[var(--uscis-blue)]/10 flex items-center justify-center border border-[var(--uscis-blue)]/20">
                <svg className="w-6 h-6 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                Verify Your Email
              </h1>
            </div>
          </div>

          <div className="p-8">
            <div className="mb-6">
              <div className="flex items-center justify-center mb-4">
                <div className="w-20 h-20 bg-[var(--uscis-blue)]/10 rounded-full flex items-center justify-center border-2 border-[var(--uscis-blue)]/20">
                  <svg className="w-10 h-10 text-[var(--text-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-lg font-semibold text-[var(--text-primary)] text-center mb-2">
                Check Your Email
              </h2>
              <p className="text-[var(--text-secondary)] text-center mb-4">
                We've sent a verification email to:
              </p>
              <p className="text-[var(--text-primary)] font-medium text-center mb-6">
                {user ? (user.email ?? "") : ""}
              </p>
              <p className="text-sm text-[var(--text-secondary)] text-center leading-relaxed">
                Click the link in the email to verify your account. You’ll then get case updates and keep your account secure.
              </p>
            </div>

            {message && (
              <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-green-800 text-sm">{message}</p>
              </div>
            )}

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            {isChecking && (
              <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                  <p className="text-blue-800 text-sm">Checking verification status...</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={handleResendVerification}
                disabled={isSending || isRateLimited}
                className="uscis-button w-full disabled:opacity-50"
              >
                {isSending
                  ? "Sending..."
                  : isRateLimited
                  ? "Temporarily disabled. Please try again later."
                  : "Resend Verification Email"}
              </button>

              <div className="text-center">
                <p className="text-sm text-[var(--text-secondary)] mb-2">
                  Already verified?
                </p>
                <button
                  onClick={async () => {
                    if (!user) return;
                    setIsChecking(true);
                    setError("");
                    setMessage("");
                    try {
                      await refreshUser();
                      // Check if email is now verified after refresh
                      const currentUser = auth.currentUser;
                      if (currentUser?.emailVerified) {
                        setMessage("Email verified! Redirecting...");
                        setTimeout(() => {
                          router.push("/profile-setup");
                        }, 1500);
                      } else {
                        setError("Email not yet verified. Please check your inbox.");
                      }
                    } catch (err) {
                      console.error("Error checking verification:", err);
                      setError("Error checking verification status. Please try again.");
                    } finally {
                      setIsChecking(false);
                    }
                  }}
                  disabled={isChecking}
                  className="text-[var(--text-primary)] hover:underline text-sm font-medium disabled:opacity-50"
                >
                  {isChecking ? "Checking..." : "Check Verification Status"}
                </button>
              </div>

              <div className="pt-4 border-t border-[var(--border-color)]">
                <Link
                  href="/login"
                  className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-center block"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div>
                    <p className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-1">
                      Can't find the email? Check your spam/junk folder!
                    </p>
                    <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed mb-2">
                      Sometimes verification emails end up in spam folders. Please check your junk/spam folder if you don't see the email in your inbox.
                    </p>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-[var(--text-primary)]">
                        <strong>Why emails go to spam:</strong>
                      </p>
                      <ul className="text-xs text-[var(--text-primary)] list-disc list-inside space-y-0.5 ml-2">
                        <li>New sender addresses (first time receiving from support@visanova.app)</li>
                        <li>Email filters learning your preferences</li>
                        <li>Automated emails sometimes flagged by spam filters</li>
                      </ul>
                      <p className="text-xs text-orange-700 dark:text-orange-300 mt-2">
                        <strong>Solution:</strong> Add <span className="font-mono bg-orange-100 dark:bg-orange-900/40 px-1.5 py-0.5 rounded">support@visanova.app</span> to your contacts to prevent future emails from going to spam.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[var(--uscis-blue)]/5 rounded-lg border border-[var(--uscis-blue)]/10">
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                  <strong className="text-[var(--text-primary)]">Note:</strong> The verification link will expire after 24 hours. 
                  If you need a new link, click "Resend Verification Email" above.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[var(--uscis-blue)] border-t-transparent mx-auto mb-4" />
            <p className="text-[var(--text-secondary)]">Loading...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
