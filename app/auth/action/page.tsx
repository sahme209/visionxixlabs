"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  verifyPasswordResetCode,
  confirmPasswordReset,
  applyActionCode,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

type ViewState = "loading" | "form" | "success" | "error" | "verifying_email" | "email_verified" | "email_verify_error";

// This page depends on search params from the URL and should be fully dynamic
export const dynamic = "force-dynamic";

function FirebaseActionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");

  const [view, setView] = useState<ViewState>("loading");
  const isVerifyEmailMode = mode === "verifyEmail";
  const [email, setEmail] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Handle verifyEmail or resetPassword based on mode
  useEffect(() => {
    if (!mode || !oobCode) {
      setError("This link is invalid. Please request a new email.");
      setView("error");
      return;
    }

    let isMounted = true;

    if (mode === "verifyEmail") {
      setView("verifying_email");
      applyActionCode(auth, oobCode)
        .then(() => {
          if (!isMounted) return;
          setView("email_verified");
          if (typeof window !== "undefined") window.history.replaceState({}, "", "/auth/action");
          setTimeout(() => router.replace("/login?verified=1"), 2000);
        })
        .catch((err: any) => {
          if (!isMounted) return;
          if (err.code === "auth/expired-action-code") {
            setError("This verification link has expired. Please request a new one from your account.");
          } else if (err.code === "auth/invalid-action-code") {
            setError("This verification link is invalid or was already used. Please sign in or request a new link.");
          } else {
            setError("Verification failed. Please try again or request a new verification email.");
          }
          setView("email_verify_error");
        });
      return () => { isMounted = false; };
    }

    if (mode !== "resetPassword") {
      setError("This link type is not supported.");
      setView("error");
      return;
    }

    const verifyCode = async () => {
      try {
        const userEmail = await verifyPasswordResetCode(auth, oobCode);
        if (!isMounted) return;
        setEmail(userEmail);
        setView("form");
      } catch (err: any) {
        if (!isMounted) return;
        let message = "This reset link is invalid or has expired. Please request a new one.";
        if (err.code === "auth/expired-action-code") {
          message = "This reset link has expired. Please request a new password reset email.";
        } else if (err.code === "auth/invalid-action-code") {
          message = "This reset link is invalid. Please request a new password reset email.";
        }
        setError(message);
        setView("error");
      }
    };

    verifyCode();

    return () => {
      isMounted = false;
    };
  }, [mode, oobCode, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;

    setError(null);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setView("success");
    } catch (err: any) {
      let message = "Something went wrong while updating your password.";
      if (err.code === "auth/expired-action-code") {
        message = "This reset link has expired. Please request a new password reset email.";
      } else if (err.code === "auth/invalid-action-code") {
        message = "This reset link is invalid. Please request a new password reset email.";
      } else if (err.code === "auth/weak-password") {
        message = "Password is too weak. Please choose a stronger password.";
      }
      setError(message);
      setView("error");
    } finally {
      setSubmitting(false);
    }
  };

  const goToLogin = () => {
    router.push("/login");
  };

  const isEmailVerify = view === "verifying_email" || view === "email_verified" || view === "email_verify_error";

  return (
    <div className="min-h-screen bg-[var(--hero-dark)] flex items-center justify-center px-4 py-8 sm:py-12" style={{ background: "linear-gradient(to bottom, var(--hero-dark) 0%, var(--hero-dark-soft) 50%, var(--hero-dark) 100%)" }}>
      <div className="w-full max-w-md">
        {/* Logo / Brand - always white text */}
        <div className="text-center mb-8 sm:mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-br from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] rounded-2xl mb-4 sm:mb-5 shadow-lg shadow-blue-500/20">
            <img src="/logo.svg" alt="VisaNova" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold mb-1 sm:mb-2 tracking-tight" style={{ color: "#fff" }}>
            {isEmailVerify
              ? view === "email_verified"
                ? "Email verified"
                : view === "email_verify_error"
                ? "Verification issue"
                : "Verifying your email"
              : view === "success"
              ? "Password updated"
              : "Reset your password"}
          </h1>
          {!isEmailVerify && view !== "success" && (
            <p className="text-sm sm:text-base font-light max-w-xs mx-auto" style={{ color: "rgba(255,255,255,0.9)" }}>
              Choose a new password for your VisaNova account.
            </p>
          )}
          {view === "verifying_email" && (
            <p className="text-sm sm:text-base font-light max-w-xs mx-auto mt-2" style={{ color: "rgba(255,255,255,0.9)" }}>
              One moment…
            </p>
          )}
          {view === "email_verified" && (
            <p className="text-sm sm:text-base font-light max-w-xs mx-auto mt-2" style={{ color: "rgba(255,255,255,0.9)" }}>
              Redirecting you to sign in…
            </p>
          )}
        </div>

        <div className="rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/20 backdrop-blur-xl" style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "#fff" }}>
          {view === "verifying_email" && (
            <div className="flex flex-col items-center gap-5 py-8">
              <div className="h-12 w-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-base font-medium" style={{ color: "#fff" }}>Verifying your email…</p>
            </div>
          )}

          {view === "email_verified" && (
            <div className="flex flex-col items-center gap-5 py-6">
              <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-400/50 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-center font-medium" style={{ color: "#fff" }}>
                Your email is verified. You can now sign in to your account.
              </p>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.8)" }}>Redirecting…</p>
            </div>
          )}

          {view === "email_verify_error" && (
            <div className="space-y-5">
              <div className="p-4 rounded-2xl" style={{ backgroundColor: "rgba(239,68,68,0.2)", border: "1px solid rgba(248,113,113,0.5)" }}>
                <p className="text-sm font-medium" style={{ color: "#fecaca" }}>{error}</p>
              </div>
              <p className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>
                Sign in and open your account settings to resend a verification email, or try the link again if it was already used.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={goToLogin}
                  className="w-full py-3.5 px-4 rounded-2xl font-semibold transition-all duration-200 shadow-lg active:scale-[0.98] text-base"
                  style={{ backgroundColor: "var(--uscis-blue)", color: "#fff" }}
                >
                  Back to sign in
                </button>
                <Link
                  href="/verify-email"
                  className="text-center py-2 text-sm font-medium underline underline-offset-2"
                  style={{ color: "rgba(255,255,255,0.95)" }}
                >
                  Go to verification page to resend email
                </Link>
              </div>
            </div>
          )}

          {view === "loading" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="h-12 w-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-sm font-medium" style={{ color: "rgba(255,255,255,0.95)" }}>
                {isVerifyEmailMode ? "Verifying your email…" : "Checking your reset link…"}
              </p>
            </div>
          )}

          {view === "error" && (
            <div className="space-y-6">
              {error && (
                <div className="p-4 rounded-2xl" style={{ backgroundColor: "rgba(239,68,68,0.2)", border: "1px solid rgba(248,113,113,0.5)" }}>
                  <p className="text-sm font-medium" style={{ color: "#fecaca" }}>{error}</p>
                </div>
              )}
              <button
                type="button"
                onClick={goToLogin}
                className="w-full py-3.5 px-4 rounded-2xl font-semibold transition-all duration-200 shadow-lg active:scale-[0.98] text-base"
                style={{ backgroundColor: "var(--uscis-blue)", color: "#fff" }}
              >
                Back to sign in
              </button>
            </div>
          )}

          {view === "form" && (
            <form onSubmit={handleSubmit} className="space-y-5">
              {email && (
                <p className="text-xs sm:text-sm mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>
                  Resetting password for <span className="font-semibold" style={{ color: "#fff" }}>{email}</span>
                </p>
              )}

              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium mb-2.5" style={{ color: "rgba(255,255,255,0.9)" }}>
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl text-base transition-all duration-200 focus:outline-none focus:ring-2"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff" }}
                  placeholder="Enter a new password"
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium mb-2.5" style={{ color: "rgba(255,255,255,0.9)" }}>
                  Confirm new password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3.5 rounded-2xl text-base transition-all duration-200 focus:outline-none focus:ring-2"
                  style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.25)", color: "#fff" }}
                  placeholder="Re-enter your new password"
                  disabled={submitting}
                />
              </div>

              {error && (
                <div className="p-3 rounded-2xl" style={{ backgroundColor: "rgba(239,68,68,0.2)", border: "1px solid rgba(248,113,113,0.5)" }}>
                  <p className="text-sm font-medium" style={{ color: "#fecaca" }}>{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-2xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-[0.98] text-base"
                style={{ backgroundColor: "var(--uscis-blue)", color: "#fff" }}
              >
                {submitting ? "Updating password…" : "Update password"}
              </button>
            </form>
          )}

          {view === "success" && (
            <div className="space-y-6">
              <div className="p-4 rounded-2xl" style={{ backgroundColor: "rgba(34,197,94,0.2)", border: "1px solid rgba(74,222,128,0.5)" }}>
                <p className="text-sm font-medium" style={{ color: "#bbf7d0" }}>
                  Your password has been updated successfully. You can now sign in with your new password.
                </p>
              </div>
              <button
                type="button"
                onClick={goToLogin}
                className="w-full py-3.5 px-4 rounded-2xl font-semibold transition-all duration-200 shadow-lg active:scale-[0.98] text-base"
                style={{ backgroundColor: "var(--uscis-blue)", color: "#fff" }}
              >
                Go to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FirebaseActionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center px-4 py-8 sm:py-12" style={{ background: "linear-gradient(to bottom, var(--hero-dark) 0%, var(--hero-dark-soft) 50%, var(--hero-dark) 100%)" }}>
          <div className="w-full max-w-md flex flex-col items-center gap-4" style={{ color: "#fff" }}>
            <div className="h-12 w-12 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.9)" }}>Loading…</p>
          </div>
        </div>
      }
    >
      <FirebaseActionContent />
    </Suspense>
  );
}
