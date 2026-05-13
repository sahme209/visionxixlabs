"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";
import { RealisticFogBackground } from "@/components/ui/realistic-fog-background";
import { Reveal } from "@/components/motion/Reveal";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email: email.trim(),
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Invalid email or password");
        return;
      }
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4 relative overflow-hidden">
      <RealisticFogBackground backgroundColor="transparent" opacity={0.2} darken contained />
      {/* Spotlight orb */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] spotlight-orb opacity-40 pointer-events-none" aria-hidden />
      {/* Floating blur orbs */}
      <div className="absolute -top-32 -left-32 w-72 h-72 rounded-full bg-violet-600/10 blur-[100px] pointer-events-none" aria-hidden />
      <div className="absolute bottom-0 right-0 w-56 h-56 rounded-full bg-blue-600/8 blur-[90px] pointer-events-none" aria-hidden />
      {/* Grid mesh background */}
      <div className="absolute inset-0 bg-grid-mesh opacity-30 pointer-events-none" aria-hidden />

      <Link href="/" className="absolute top-6 left-6 text-sm text-zinc-500 hover:text-white transition-colors z-20">
        ← Home
      </Link>

      <Reveal direction="up" blur delay={0.05}>
        <div className="w-full max-w-sm relative z-10 glass-card auth-gradient-border auth-card-huly rounded-2xl border border-white/[0.06] p-8">
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
          <h1 className="text-2xl font-bold mb-1 tracking-[-0.04em]">Sign in</h1>
          <p className="text-sm text-zinc-500 mb-8">
            Access your Axiom dashboard and operations.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="auth-input w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 text-sm text-white transition-all duration-300 placeholder:text-zinc-600"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="auth-input w-full rounded-lg border border-white/[0.06] bg-white/[0.03] px-3.5 py-2.5 pr-10 text-sm text-white transition-all duration-300 placeholder:text-zinc-600"
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
              {loading ? "Signing in..." : "Sign in"}
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
              Sign in with Google
            </button>
            <button type="button" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/[0.08] bg-white/[0.02] text-sm text-zinc-400 hover:bg-white/[0.06] hover:text-white transition-all">
              Sign in with GitHub
            </button>
          </div>
          <p className="mt-6 text-sm text-zinc-500 text-center">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="font-medium text-violet-400 hover:text-violet-300">
              Sign up
            </Link>
          </p>
        </div>
      </Reveal>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#09090b]">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
