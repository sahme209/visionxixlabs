"use client";

import { VerificationRecovery } from "@/components/auth/VerificationRecovery";
import { verificationDesktopCallback } from "@/lib/auth/verificationCallback";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRightIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="axiom-canvas min-h-screen flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      }
    >
      <SignUpForm />
    </Suspense>
  );
}

function SignUpForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<null | "google" | "github">(null);
  const [enabledProviders, setEnabledProviders] = useState<{ google: boolean; github: boolean } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = safeInternalPath(searchParams.get("redirect"), "/download");
  const desktopChallenge = desktopChallengeFromRedirect(redirect);

  useEffect(() => {
    let cancelled = false;
    getProviders().then((providers) => {
      if (cancelled) return;
      setEnabledProviders({
        google: Boolean(providers && "google" in providers),
        github: Boolean(providers && "github" in providers),
      });
    }).catch(() => {
      if (!cancelled) setEnabledProviders({ google: false, github: false });
    });
    return () => { cancelled = true; };
  }, []);

  const handleOAuth = async (provider: "google" | "github") => {
    if (!acceptedTerms || !desktopChallenge || enabledProviders?.[provider] !== true) return;
    setOauthLoading(provider);
    setError("");
    try {
      const result = await signIn(provider, { callbackUrl: redirect, redirect: true });
      if (result?.error) setError(`Could not start ${provider} sign-up: ${result.error}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not start ${provider} sign-up.`);
    } finally {
      setOauthLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: name.trim() || undefined,
          desktopChallenge,
          callbackUrl: verificationDesktopCallback(redirect),
          acceptedTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign up failed");
        return;
      }
      if (data.verificationRequired === true) {
        // Email proof is mandatory. Do not attempt a credentials login before
        // the user follows the verification link or discard the pairing context.
        setVerificationEmail(email.trim());
        setPassword("");
        return;
      }
      // Compatibility for a successful response that does not require proof.
      const signInResult = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });
      if (signInResult?.ok) {
        router.push(redirect);
        router.refresh();
      } else {
        // Fall back to the manual signin page — at least the
        // account is created.
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(redirect)}`);
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (verificationEmail !== null) {
    return (
      <div className="axiom-canvas flex min-h-screen items-center justify-center px-5 py-24">
        <section aria-labelledby="verification-title" className="w-full max-w-lg space-y-5">
          <h1 id="verification-title" className="text-3xl tracking-tight">Check your email</h1>
          <p role="status" className="text-sm text-zinc-300">
            We sent a verification link to {verificationEmail}. Open it to verify your email address before signing in.
          </p>
          <p className="text-sm text-zinc-400">
            After verification, return here to continue pairing. If the desktop request expires, return to Axiom Agent and choose Log in again.
          </p>
          <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(redirect)}`} className="inline-block rounded-lg bg-zinc-100 px-5 py-3 text-sm font-semibold text-zinc-950">
            Continue to sign in
          </Link>
          <p className="text-xs text-zinc-500">Account creation does not grant deployment access. Your workspace entitlement and approvals still apply.</p>
          <VerificationRecovery initialEmail={verificationEmail} callbackUrl={redirect} />
        </section>
      </div>
    );
  }

  return (
    <div className="axiom-canvas relative flex min-h-screen overflow-hidden">
      <Link href="/" className="absolute left-6 top-6 z-20 flex items-center gap-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:text-white">
        <Image src="/vision-xix-logo.png" alt="" width={27} height={27} className="rounded-md" />
        Vision XIX Labs
      </Link>

      <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-24 sm:px-8">
          <div className="w-full max-w-lg p-2 sm:p-8">
            <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.035]">
              <Image src="/vision-xix-logo.png" alt="" width={30} height={30} className="rounded-md" />
            </div>
            <h1 className="mb-2 text-3xl font-normal tracking-[-0.045em]">Create your account</h1>
            <p className="text-sm text-zinc-500 mb-8">
              Create the identity used to pair this installed application. Account creation does not include production access.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="auth-input w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white transition-all duration-300 placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Work email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="auth-input w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white transition-all duration-300 placeholder:text-zinc-600"
                />
              </div>
              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={12}
                    maxLength={128}
                    placeholder="12+ characters"
                    autoComplete="new-password"
                    className="auth-input w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 pr-10 text-sm text-white placeholder:text-zinc-600 transition-all duration-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle-btn"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs leading-5 text-zinc-400">
                <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 accent-orange-500" />
                <span>I agree to the <Link href="/terms" target="_blank" className="text-orange-300 underline">Terms</Link> and acknowledge the <Link href="/privacy" target="_blank" className="text-orange-300 underline">Privacy Policy</Link>.</span>
              </label>
              {error && (
                <div role="alert" aria-live="assertive" className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3.5 py-2.5 text-sm text-red-400">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !acceptedTerms || !desktopChallenge}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-50"
              >
                {loading ? "Creating account..." : "Create account"}
                {!loading && <ArrowRightIcon className="h-4 w-4" />}
              </button>
            </form>

            {(enabledProviders?.google || enabledProviders?.github) && (
              <>
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-white/[0.06]" />
                  <span className="text-xs text-zinc-600">Or use your organization identity</span>
                  <div className="flex-1 h-px bg-white/[0.06]" />
                </div>
                <div className={`grid gap-3 ${enabledProviders.google && enabledProviders.github ? "grid-cols-2" : "grid-cols-1"}`}>
                  {enabledProviders.google && (
                    <button
                      type="button"
                      disabled={loading || oauthLoading !== null || !acceptedTerms || !desktopChallenge}
                      onClick={() => void handleOAuth("google")}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
                    >
                      {oauthLoading === "google" ? "Opening…" : "Continue with Google"}
                    </button>
                  )}
                  {enabledProviders.github && (
                    <button
                      type="button"
                      disabled={loading || oauthLoading !== null || !acceptedTerms || !desktopChallenge}
                      onClick={() => void handleOAuth("github")}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
                    >
                      {oauthLoading === "github" ? "Opening…" : "Continue with GitHub"}
                    </button>
                  )}
                </div>
              </>
            )}
            <VerificationRecovery initialEmail={email} callbackUrl={redirect} />
            <p className="mt-6 text-sm text-zinc-500 text-center">
              Already have an account?{" "}
              <Link
                href={`/auth/signin?callbackUrl=${encodeURIComponent(redirect)}`}
                className="font-medium text-zinc-200 hover:text-white"
              >
                Sign in
              </Link>
            </p>

            <p className="mt-4 text-xs text-zinc-600 text-center">
              An approved pilot or commercial workspace entitlement is provisioned separately before deployment operations unlock.
            </p>
            {!desktopChallenge && <p role="alert" className="mt-3 text-xs text-zinc-300 text-center">This sign-up link is not attached to a valid desktop pairing request. Return to Axiom Agent and choose Log in again.</p>}
          </div>
      </div>
    </div>
  );
}

function desktopChallengeFromRedirect(redirect: string): string {
  const callback = verificationDesktopCallback(redirect);
  return callback ? new URL(callback, "https://desktop-auth.invalid").searchParams.get("challenge") ?? "" : "";
}

function safeInternalPath(value: string | null, fallback: string): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const parsed = new URL(value, "https://visionxixlabs.com");
    return parsed.origin === "https://visionxixlabs.com" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}
