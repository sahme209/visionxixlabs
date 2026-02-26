"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { HERO_IMAGES } from "@/lib/images";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess(
        "If an account exists for this email, a password reset link has been sent."
      );
    } catch (err: any) {
      let message = "Unable to send reset email. Please try again.";
      if (err.code === "auth/invalid-email") {
        message = "Please enter a valid email address.";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="surface-dark relative min-h-screen overflow-hidden bg-gradient-to-br from-[var(--uscis-blue)] via-[var(--uscis-blue-dark)] to-[var(--uscis-blue)] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
      <div className="absolute inset-0">
        <Image src={HERO_IMAGES.documents} alt="" fill className="object-cover object-center opacity-[0.08]" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--uscis-blue)]/95 via-[var(--uscis-blue-dark)]/95 to-[var(--uscis-blue)]/95" />
      </div>
      <div className="relative z-10 w-full max-w-md">
        {/* Header / Brand - Government-style */}
        <div className="mb-6 sm:mb-8 lg:mb-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-[var(--hero-dark)] to-[var(--uscis-blue-dark)] rounded-2xl sm:rounded-3xl mb-5 sm:mb-6 shadow-2xl border-2 border-[var(--uscis-blue)] hover:scale-[1.03] transition-all duration-300 hover:shadow-[var(--uscis-blue)]/30">
            <img src="/logo.svg" alt="VisaNova" className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 object-contain" />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white mb-3 sm:mb-4">
            Reset Password
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-white/90 max-w-2xl mx-auto leading-relaxed font-medium">
            Enter your email address and we&apos;ll send you a secure password reset link.
          </p>
        </div>

        {/* Auth Card - Government-style form */}
        <div className="surface-dark bg-[var(--hero-dark-soft)] rounded-2xl sm:rounded-3xl shadow-2xl shadow-[var(--uscis-blue)]/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border-2 border-white/20 text-white px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 backdrop-blur-sm">
          {/* Section title */}
          <div className="mb-5 sm:mb-6">
            <p className="text-[11px] sm:text-xs font-semibold tracking-[0.18em] uppercase text-white/90 mb-2">
              Secure password reset
            </p>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white leading-tight">
              Reset your password
            </h2>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl">
              <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="mb-4 p-3.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30 rounded-xl">
              <p className="text-xs sm:text-sm text-green-700 dark:text-green-300 font-medium">
                {success}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-semibold text-white mb-2.5"
              >
                Email address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3.5 bg-white/10 border border-white/25 rounded-xl text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white transition-all duration-200 text-base"
                  placeholder="name@example.com"
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[var(--uscis-blue)] hover:bg-[var(--uscis-blue-dark)] text-white font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 active:scale-[0.98] text-base"
            >
              {loading ? "Sending reset link..." : "Send reset link"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/15">
            <Link
              href="/login"
              className="flex items-center justify-center text-sm sm:text-base text-white/90 hover:text-white transition-colors font-medium"
            >
              ← Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

