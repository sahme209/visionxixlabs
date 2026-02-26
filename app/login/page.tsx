"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  sendEmailVerification,
  browserLocalPersistence,
  setPersistence,
  type UserCredential,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { analytics } from "@/lib/analytics";
import Link from "next/link";
import {
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { HERO_IMAGES } from "@/lib/images";

export default function LoginPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [showResetHint, setShowResetHint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirectHandled, setRedirectHandled] = useState(false);

  // Set persistence so auth survives redirect; required for redirect sign-in on mobile/custom domains
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch((err) => {
      console.warn("Auth persistence:", err);
    });
  }, []);

  // Process Google sign-in result (shared for both popup and redirect)
  const processGoogleUser = useCallback((userCredential: UserCredential) => {
      const creation = userCredential.user.metadata?.creationTime ?? "";
      const lastSignIn = userCredential.user.metadata?.lastSignInTime ?? "";
      const isNewUser = creation === lastSignIn;
      if (isNewUser) {
        analytics.signupCompleted("google");
      } else {
        analytics.loginCompleted("google");
      }
      if (isNewUser && userCredential.user.email) {
        fetch("/api/send-welcome-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: userCredential.user.email,
            name: userCredential.user.displayName || userCredential.user.email.split("@")[0],
          }),
        }).catch((err) => {
          console.error("Failed to send welcome email:", err);
        });
      }
      router.replace("/");
    },
    [router]
  );

  // Handle redirect result when user returns from Google sign-in (runs on every load and on bfcache restore)
  useEffect(() => {
    let cancelled = false;

    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (cancelled) return;
        setRedirectHandled(true);
        if (result) {
          processGoogleUser(result);
        }
      } catch (err: any) {
        if (cancelled) return;
        setRedirectHandled(true);
        console.error("Redirect result error:", err);
        if (err.code === "auth/network-request-failed") {
          setError("Network error. Please check your connection and try again.");
        } else if (err.code !== "auth/popup-closed-by-user") {
          setError(err.message || "Failed to complete sign in");
        }
      }
    };

    handleRedirectResult();

    // When page is restored from back/forward cache, getRedirectResult can be missed; run again
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted && !redirectHandled) {
        handleRedirectResult();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router, processGoogleUser]);

  // Track page view
  useEffect(() => {
    if (isLogin) {
      analytics.loginStarted();
    } else {
      analytics.signupStarted();
    }
  }, [isLogin]);

  // Redirect if already logged in
  if (user) {
    router.push("/");
    return null;
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setShowResetHint(false);
    setLoading(true);

    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError("Please enter your email and password.");
      setLoading(false);
      return;
    }

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        analytics.loginCompleted("email");
        router.push("/");
      } else {
        const trimmedConfirm = confirmPassword.trim();
        if (trimmedPassword !== trimmedConfirm) {
          setError("Passwords do not match");
          setLoading(false);
          return;
        }
        if (trimmedPassword.length < 6) {
          setError("Password must be at least 6 characters");
          setLoading(false);
          return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
        analytics.signupCompleted("email");
        
        // Send email verification with link that opens our app (required for verify-email page to receive oobCode)
        try {
          const continueUrl =
            typeof window !== "undefined"
              ? `${window.location.origin}/verify-email`
              : `${process.env.NEXT_PUBLIC_BASE_URL || "https://visanova.app"}/verify-email`;
          await sendEmailVerification(userCredential.user, {
            url: continueUrl,
            handleCodeInApp: true,
          });
          console.log("[Signup] ✅ Verification email sent");
        } catch (verificationError: any) {
          console.error("[Signup] ❌ Failed to send verification email:", verificationError);
          // Don't block signup if verification email fails
        }
        
        // Send welcome email (fire and forget, but log errors for debugging)
        fetch("/api/send-welcome-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            name: userCredential.user.displayName || email.split("@")[0],
          }),
        })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) {
            console.error("[Signup] ❌ Failed to send welcome email:", data.error || data.message);
            console.error("[Signup] Response status:", response.status);
            console.error("[Signup] Full response:", data);
          } else {
            console.log("[Signup] ✅ Welcome email sent successfully");
          }
        })
        .catch((err) => {
          console.error("[Signup] ❌ Network error sending welcome email:", err);
        });
        
        // Redirect to email verification page instead of profile setup
        router.push("/verify-email");
      }
    } catch (err: any) {
      let errorMessage = "An error occurred";
      if (err.code === "auth/network-request-failed") {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else if (err.code === "auth/email-already-in-use") {
        errorMessage = "This email is already registered. Please sign in instead.";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email address";
      } else if (err.code === "auth/weak-password") {
        errorMessage = "Password is too weak";
      } else if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password";
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/invalid-login-credentials") {
        errorMessage = "Invalid email or password.";
        setShowResetHint(true);
      } else if (err.code === "auth/user-disabled") {
        errorMessage = "This account has been disabled";
      } else {
        errorMessage = err.message || "An error occurred";
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      // Prefer popup: stays on same page and works when third-party cookies are allowed
      const result = await signInWithPopup(auth, provider);
      processGoogleUser(result);
    } catch (err: any) {
      const useRedirect =
        err?.code === "auth/popup-blocked" ||
        err?.code === "auth/cancelled-popup-request" ||
        err?.code === "auth/network-request-failed" ||
        err?.message?.includes("RECEIVER_UNAVAILABLE");
      if (useRedirect) {
        try {
          await signInWithRedirect(auth, provider);
          // Page will navigate away; getRedirectResult runs when user returns
        } catch (redirectErr: any) {
          setLoading(false);
          setError(redirectErr?.message || "Failed to sign in with Google");
        }
      } else {
        setLoading(false);
        if (err.code === "auth/popup-closed-by-user") {
          setError("");
        } else if (err.code === "auth/network-request-failed") {
          setError("Network error. Please check your connection and try again.");
        } else {
          setError(err.message || "Failed to sign in with Google");
        }
      }
    }
  };


  return (
    <div className="surface-dark relative min-h-screen overflow-hidden bg-gradient-to-br from-[var(--uscis-blue)] via-[var(--uscis-blue-dark)] to-[var(--uscis-blue)] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 lg:py-16">
      <div className="absolute inset-0">
        <Image src={HERO_IMAGES.familyTravel} alt="" fill className="object-cover object-center opacity-[0.08]" sizes="100vw" />
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--uscis-blue)]/95 via-[var(--uscis-blue-dark)]/95 to-[var(--uscis-blue)]/95" />
      </div>
      <div className="relative z-10 w-full w-full">
        {/* Header / Brand - Government-style */}
        <div className="mb-6 sm:mb-8 lg:mb-10 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-gradient-to-br from-[var(--hero-dark)] to-[var(--uscis-blue-dark)] rounded-2xl sm:rounded-3xl mb-5 sm:mb-6 shadow-2xl border-2 border-[var(--uscis-blue)] hover:scale-[1.03] transition-all duration-300 hover:shadow-[var(--uscis-blue)]/30">
            <img src="/logo.svg" alt="VisaNova" className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 object-contain" />
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-fg mb-3 sm:mb-4">
            VisaNova
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-muted max-w-2xl mx-auto leading-relaxed font-medium">
            Know where you stand. Track your case with real USCIS-backed estimates.
          </p>
        </div>

        {/* Auth + Context Card - Government-style form */}
        <div className="surface-dark bg-[var(--hero-dark-soft)] rounded-2xl sm:rounded-3xl shadow-2xl shadow-[var(--uscis-blue)]/10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border-2 border-white/20 text-fg px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10 backdrop-blur-sm">
          <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] gap-6 md:gap-10 lg:gap-12 items-start">
            {/* Left: Form */}
            <div className="space-y-6">
              {/* Section title - Enhanced */}
              <div className="mb-5 sm:mb-6">
                <p className="text-[11px] sm:text-xs font-semibold tracking-[0.18em] uppercase text-fg mb-2">
                  Secure sign in
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-fg leading-tight">
                  Sign in to see your case.
                </h2>
              </div>

              {/* Toggle Login/Sign Up */}
              <div className="flex gap-1.5 mb-6 p-1.5 bg-gray-100 dark:bg-[var(--hero-dark-soft)] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-inner">
                <button
                  onClick={() => {
                    setIsLogin(true);
                    setError("");
                    setShowResetHint(false);
                  }}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    isLogin
                      ? "bg-[var(--uscis-blue)] text-white shadow-sm"
                      : "text-fg hover:text-fg"
                  }`}
                >
                  {t("login")}
                </button>
                <button
                  onClick={() => {
                    setIsLogin(false);
                    setError("");
                    setShowResetHint(false);
                  }}
                  className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-semibold transition-all duration-200 ${
                    !isLogin
                      ? "bg-[var(--uscis-blue)] text-white shadow-sm"
                      : "text-fg hover:text-fg"
                  }`}
                >
                  {t("signup")}
                </button>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mb-4 p-3.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-xl">
                  <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 font-medium">{error}</p>
                  {showResetHint && isLogin && (
                    <Link
                      href="/reset-password"
                      className="mt-2 inline-block text-xs sm:text-sm font-semibold text-[var(--text-primary)] hover:underline"
                    >
                      Reset your password →
                    </Link>
                  )}
                </div>
              )}

              {/* Social Sign In Buttons */}
              <div className="mb-4">
                <button
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-gray-700 dark:bg-gray-700 border border-gray-600 dark:border-gray-600 text-white rounded-xl font-semibold hover:bg-gray-600 dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md active:scale-[0.98] min-h-[52px] touch-manipulation text-base"
                >
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  <span className="font-semibold">
                    Continue with Google
                  </span>
                </button>
              </div>

              {/* Divider */}
              <div className="my-4">
                <div className="w-full border-t border-[var(--border-color)]" />
              </div>

              {/* Email/Password Form */}
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label
                    htmlFor="email"
                    className="block text-xs sm:text-sm font-medium text-fg mb-2"
                  >
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-4 bg-[var(--uscis-blue-dark)] border border-[var(--uscis-blue)]/30 rounded-xl text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]/60 focus:border-[var(--uscis-blue)] transition-all duration-200 text-base min-h-[52px]"
                    placeholder="name@example.com"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs sm:text-sm font-medium text-fg mb-2"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 pr-[5rem] sm:pr-16 py-4 bg-[var(--uscis-blue-dark)] border border-[var(--uscis-blue)]/30 rounded-xl text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]/60 focus:border-[var(--uscis-blue)] transition-all duration-200 text-base min-h-[52px]"
                      placeholder="Enter your password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 sm:pr-5 flex items-center text-white/70 hover:text-white active:scale-95 transition-all z-10 min-w-[44px] min-h-[44px] touch-manipulation"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                      ) : (
                        <EyeIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                      )}
                    </button>
                  </div>
                </div>

                {isLogin && (
                  <div className="flex justify-end">
                    <a
                      href="/reset-password"
                      className="text-xs sm:text-sm text-fg hover:underline transition-colors"
                    >
                      Forgot your password?
                    </a>
                  </div>
                )}

                {!isLogin && (
                  <div>
                    <label
                      htmlFor="confirmPassword"
                      className="block text-xs sm:text-sm font-medium text-fg mb-2"
                    >
                      {t("confirmPassword")}
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 pr-[5rem] sm:pr-16 py-4 bg-[var(--uscis-blue-dark)] border border-[var(--uscis-blue)]/30 rounded-xl text-white placeholder:text-white/70 focus:outline-none focus:ring-2 focus:ring-[var(--uscis-blue)]/60 focus:border-[var(--uscis-blue)] transition-all duration-200 text-base min-h-[52px]"
                        placeholder={t("confirmPassword")}
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3 sm:pr-5 flex items-center text-white/70 hover:text-white active:scale-95 transition-all z-10 min-w-[44px] min-h-[44px] touch-manipulation"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? (
                          <EyeSlashIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                        ) : (
                          <EyeIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 px-4 bg-gradient-to-r from-[var(--uscis-blue)] to-[var(--uscis-blue-dark)] hover:from-[var(--uscis-blue-dark)] hover:to-[var(--uscis-blue)] text-white font-bold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/40 active:scale-[0.98] text-base min-h-[52px] touch-manipulation"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      {isLogin ? t("signingIn") : t("creatingAccount")}
                    </span>
                  ) : (
                    <span>{isLogin ? t("signIn") : t("createAccount")}</span>
                  )}
                </button>
              </form>

              {/* Footer (toggle) */}
              <p className="mt-5 text-center text-xs sm:text-sm text-fg">
                {isLogin ? t("dontHaveAccount") + " " : t("alreadyHaveAccount") + " "}
                <button
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError("");
                  }}
                  className="text-fg font-semibold hover:underline transition-colors"
                >
                  {isLogin ? t("signUp") : t("signIn")}
                </button>
              </p>
            </div>

            {/* Right: Trust & authenticity column - Enhanced Desktop */}
            <div className="hidden md:flex flex-col gap-5 lg:gap-6 border-l border-white/20 pl-6 lg:pl-8">
              <div className="text-sm lg:text-base text-fg space-y-3">
                <p className="font-bold text-fg text-base lg:text-lg">
                  Independent.
                </p>
                <p className="text-muted leading-relaxed">
                  VisaNova uses public USCIS data and historical approval patterns to estimate timelines and show how
                  service centers move. It does not replace official case status from the government.
                </p>
              </div>
              <div className="text-sm text-fg space-y-2 bg-white/10 border border-white/20 rounded-xl p-4 lg:p-5">
                <p className="font-bold text-fg text-xs lg:text-sm tracking-wide uppercase mb-2">
                  How your information is used
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted leading-relaxed">
                  <li>Used only to authenticate you and personalize your timeline.</li>
                  <li>Not shared or sold to advertisers or data brokers.</li>
                  <li>You can delete your account and data at any time.</li>
                </ul>
              </div>
              <div className="mt-auto text-xs lg:text-sm text-muted leading-relaxed">
                By continuing, you agree to VisaNova&apos;s{" "}
                <a href="/terms" className="underline text-fg hover:opacity-80 font-medium">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="underline text-fg hover:opacity-80 font-medium">
                  Privacy Policy
                </a>
                .
              </div>
            </div>
          </div>
        </div>

        {/* Mobile privacy / authenticity footer */}
        <div className="mt-6 md:hidden">
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <a 
                href="https://visanova.app" 
                className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-white/10 border border-white/20 text-fg text-xs font-medium hover:bg-white/20 transition-colors"
              >
                visanova.app
              </a>
            </div>
            <div className="text-[10px] text-muted space-y-1.5">
              <p>
                VisaNova is an independent tool that uses public USCIS data.
              </p>
              <p>
                By continuing, you agree to our{" "}
                <a href="/terms" className="underline font-medium text-fg">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="/privacy" className="underline font-medium text-fg">
                  Privacy Policy
                </a>
                .
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
