"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  EyeIcon,
  EyeSlashIcon,
} from "@heroicons/react/24/outline";
import { RealisticFogBackground } from "@/components/ui/realistic-fog-background";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign up failed");
        return;
      }
      router.push(`/auth/signin?callbackUrl=${encodeURIComponent(redirect)}`);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const isOperatorFlow = redirect.includes("operator");

  return (
    <div className="min-h-screen flex bg-[#09090b] relative overflow-hidden">
      <RealisticFogBackground backgroundColor="transparent" opacity={0.15} darken contained />
      {/* Spotlight orb */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] spotlight-orb opacity-30 pointer-events-none" aria-hidden />
      {/* Floating blur orbs */}
      <div className="absolute -top-40 right-0 w-80 h-80 rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-20 -left-20 w-60 h-60 rounded-full bg-blue-600/8 blur-[90px] pointer-events-none" aria-hidden />
      {/* Grid mesh background */}
      <div className="absolute inset-0 bg-grid-mesh opacity-30 pointer-events-none" aria-hidden />

      <Link href="/" className="absolute top-6 left-6 text-sm text-zinc-500 hover:text-white transition-colors z-20">
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
              <span className="text-sm font-semibold text-gradient">
                Vision XIX Labs
              </span>
            </Link>

            <h1 className="text-2xl font-bold mb-1 tracking-[-0.04em]">Create your account</h1>
            <p className="text-sm text-zinc-500 mb-8">
              {isOperatorFlow
                ? "Scan your cloud and get findings in under 5 minutes."
                : "Get started with Axiom."}
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
                    minLength={8}
                    placeholder="8+ characters"
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
              {error && (
                <div className="rounded-lg border border-red-500/20 bg-red-500/[0.06] px-3.5 py-2.5 text-sm text-red-400">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="btn-huly btn-amber-shimmer w-full rounded-full bg-white py-3 text-sm font-semibold text-zinc-900 hover:bg-zinc-100 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.08)]"
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
              <button type="button" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.02] text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-all">
                Sign up with Google
              </button>
              <button type="button" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.02] text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-all">
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
              No credit card required. Free plan includes 1 cloud account.
            </p>
          </div>
        </Reveal>
      </div>

      {isOperatorFlow && (
        <div className="hidden lg:flex flex-1 items-center justify-center border-l border-white/[0.04] px-12 relative z-10">
          <Reveal direction="up" blur delay={0.2}>
            <div className="max-w-xs">
              <h2 className="text-sm font-semibold mb-6 tracking-[-0.04em]">
                What you get — <span className="text-gradient">free</span>
              </h2>
              <Stagger delay={0.1} interval={0.06}>
                {[
                  { icon: ShieldCheckIcon, text: "Read-only AWS access via assume-role" },
                  { icon: CheckCircleIcon, text: "Full infrastructure scan and analysis" },
                  { icon: CheckCircleIcon, text: "Cost, security, and drift findings" },
                  { icon: CheckCircleIcon, text: "Prioritized recommendations" },
                  { icon: CheckCircleIcon, text: "Execution plans on upgrade" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-zinc-400">
                    <item.icon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    {item.text}
                  </div>
                ))}
              </Stagger>
            </div>
          </Reveal>
        </div>
      )}
    </div>
  );
}
