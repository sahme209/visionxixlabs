"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Link from "next/link";

export default function EmailVerificationBanner() {
  const { user, emailVerified, refreshUser } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [message, setMessage] = useState("");
  const [isRateLimited, setIsRateLimited] = useState(false);

  // Don't show if user is not logged in, is anonymous (no email to verify), email is verified, or banner is dismissed
  if (!user || user.isAnonymous || emailVerified || isDismissed) {
    return null;
  }

  const handleResendVerification = async () => {
    if (!user || isRateLimited) return;

    setIsSending(true);
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
      setTimeout(() => setMessage(""), 5000);
    } catch (err: any) {
      console.error("Error sending verification email:", err);
      if (err.code === "auth/too-many-requests") {
        setMessage("Too many requests. Please wait 10–15 minutes before trying again.");
        setIsRateLimited(true);
      } else {
        setMessage("Failed to send. Please try again.");
      }
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setIsSending(false);
    }
  };

  const handleCheckVerification = async () => {
    try {
      await refreshUser();
      if (auth.currentUser?.emailVerified) {
        setIsDismissed(true);
      }
    } catch (err) {
      console.error("Error checking verification:", err);
    }
  };

  return (
    <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mb-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-orange-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-orange-800">
            Please verify your email address
          </h3>
          <div className="mt-2 text-sm text-orange-700">
            <p>
              We've sent a verification email to <strong>{user.email}</strong>. 
              Please verify your email to access all features and receive important updates.
            </p>
          </div>
          {message && (
            <div className="mt-2 text-sm text-orange-800 font-medium">
              {message}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={handleResendVerification}
              disabled={isSending || isRateLimited}
              className="text-sm font-medium text-orange-800 hover:text-orange-900 underline disabled:opacity-50"
            >
              {isSending
                ? "Sending..."
                : isRateLimited
                ? "Temporarily disabled"
                : "Resend verification email"}
            </button>
            <span className="text-orange-600">•</span>
            <button
              onClick={handleCheckVerification}
              className="text-sm font-medium text-orange-800 hover:text-orange-900 underline"
            >
              I've verified my email
            </button>
            <span className="text-orange-600">•</span>
            <Link
              href="/verify-email"
              className="text-sm font-medium text-orange-800 hover:text-orange-900 underline"
            >
              Go to verification page
            </Link>
          </div>
        </div>
        <div className="ml-4 flex-shrink-0">
          <button
            onClick={() => setIsDismissed(true)}
            className="text-orange-400 hover:text-orange-500"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
