"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRightIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { RealisticFogBackground } from "@/components/ui/realistic-fog-background";
import { Reveal } from "@/components/motion/Reveal";

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/download";
  const desktopChallenge = desktopChallengeFromRedirect(redirect);

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
          acceptedTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign up failed");
        return;
      }
      // Auto-sign-in right after creating the account — the user
      // wants to land in the dashboard, not bounce through signin.
      // signIn({ redirect: true, callbackUrl }) handles the full
      // session cookie + redirect for us; falls back to the signin
      // page if credentials auth isn't configured.
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

  return (
    <div className="min-h-screen flex bg-[#09090b] relative overflow-hidden">
      <RealisticFogBackground backgroundColor="transparent" opacity={0.15} darken contained />
      {/* Spotlight orb */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] spotlight-orb opacity-30 pointer-events-none" aria-hidden />
      {/* Huly-style coral + violet drifting pools (warm welcome) */}
      <div className="ambient-drift absolute -top-40 right-0 w-[460px] h-[460px] rounded-full bg-brand-violet/[0.10] blur-[120px] pointer-events-none" aria-hidden />
      <div className="ambient-drift absolute top-1/4 right-1/4 w-[420px] h-[320px] rounded-full bg-brand-coral/[0.09] blur-[110px] pointer-events-none" style={{ animationDelay: "-8s" }} aria-hidden />
      <div className="ambient-drift absolute bottom-20 -left-20 w-[360px] h-[360px] rounded-full bg-cyan-500/[0.07] blur-[100px] pointer-events-none" style={{ animationDelay: "-14s" }} aria-hidden />
      {/* Grid mesh background */}
      <div className="absolute inset-0 bg-grid-mesh opacity-30 pointer-events-none" aria-hidden />

      <Link href="/" className="absolute top-6 left-6 text-[12px] font-mono uppercase tracking-[0.18em] text-zinc-500 hover:text-brand-coral transition-colors z-20">
        ← Home
      </Link>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 relative z-10">
        <Reveal direction="up" blur delay={0.05}>
          <div className="w-full max-w-sm glass-card auth-gradient-border auth-card-huly rounded-2xl border border-white/[0.06] p-8">
            <div className="auth-gradient-corner" aria-hidden />
            <Link href="/" className="flex items-center gap-2.5 mb-10">
              <Image
                src="/vision-xix-logo.png"
                alt="Vision XIX Labs"
                width={28}
                height={28}
                className="rounded-lg"
              />
              <span className="text-sm font-semibold bg-gradient-to-r from-brand-coral via-fuchsia-400 to-brand-violet bg-clip-text text-transparent">
                Vision XIX Labs
              </span>
            </Link>

            <p className="text-[10px] font-mono uppercase tracking-[0.28em] text-zinc-500 inline-flex items-center gap-2 mb-2">
              <span className="text-brand-coral/90 tabular-nums">B</span>
              <span className="h-px w-5 bg-gradient-to-r from-brand-coral/60 to-transparent" />
              New account
            </p>
            <h1 className="text-3xl font-bold mb-2 tracking-[-0.04em]">
              Create yours.
              <span aria-hidden className="block h-[3px] w-14 mt-1.5 rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400 to-transparent opacity-85" />
            </h1>
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
                <input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 accent-violet-500" />
                <span>I agree to the <Link href="/terms" target="_blank" className="text-violet-300 underline">Terms</Link> and acknowledge the <Link href="/privacy" target="_blank" className="text-violet-300 underline">Privacy Policy</Link>.</span>
              </label>
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3.5 py-2.5 text-sm text-red-400">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading || !acceptedTerms || !desktopChallenge}
                className="btn-press w-full rounded-full py-3 text-sm font-semibold tracking-tight disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? "Creating account..." : "Create account"}
                {!loading && <ArrowRightIcon className="h-4 w-4" />}
              </button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-zinc-600">Or</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                disabled={loading || !acceptedTerms || !desktopChallenge}
                onClick={() => signIn("google", { callbackUrl: redirect })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.02] text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
              >
                Sign up with Google
              </button>
              <button
                type="button"
                disabled={loading || !acceptedTerms || !desktopChallenge}
                onClick={() => signIn("github", { callbackUrl: redirect })}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.02] text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-all disabled:opacity-50"
              >
                Sign up with GitHub
              </button>
            </div>
            <p className="mt-6 text-sm text-zinc-500 text-center">
              Already have an account?{" "}
              <Link
                href={`/auth/signin?callbackUrl=${encodeURIComponent(redirect)}`}
                className="font-medium text-violet-400 hover:text-violet-300"
              >
                Sign in
              </Link>
            </p>

            <p className="mt-4 text-xs text-zinc-600 text-center">
              A paid workspace entitlement is provisioned separately under approved commercial terms before deployment operations unlock.
            </p>
            {!desktopChallenge && <p role="alert" className="mt-3 text-xs text-amber-300 text-center">This sign-up link is not attached to a valid desktop pairing request. Return to Axiom Agent and choose Continue securely in browser.</p>}
          </div>
        </Reveal>
      </div>
    </div>
  );
}

function desktopChallengeFromRedirect(redirect: string): string {
  try {
    const url = new URL(redirect, "https://desktop-auth.invalid");
    return url.pathname === "/desktop/connect" ? url.searchParams.get("challenge")?.trim() ?? "" : "";
  } catch {
    return "";
  }
}
