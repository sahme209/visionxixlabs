"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { RealisticFogBackground } from "@/components/ui/realistic-fog-background";

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
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
    <div className="min-h-screen flex bg-white dark:bg-slate-950 relative overflow-hidden">
      <RealisticFogBackground backgroundColor="transparent" opacity={0.2} darken contained />
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-violet-500/5 dark:bg-violet-500/10 blur-3xl" aria-hidden />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-fuchsia-500/5 dark:bg-fuchsia-500/10 blur-3xl" aria-hidden />
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8 relative z-10">
        <div className="w-full max-w-sm">
          <Link href="/" className="flex items-center gap-2.5 mb-10">
            <Image
              src="/vision-xix-logo.png"
              alt="Vision XIX Labs"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Vision XIX Labs
            </span>
          </Link>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 mb-1">Create your account</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
            {isOperatorFlow
              ? "Scan your cloud and get findings in under 5 minutes."
              : "Get started with Axiom."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <div>
              <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Work email
              </label>
              <input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            <div>
              <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <input
                id="signup-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="8+ characters"
                autoComplete="new-password"
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
            {error && (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="btn-huly w-full rounded-lg bg-slate-900 dark:bg-slate-100 py-2.5 text-sm font-semibold text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              {loading ? "Creating account..." : "Create account"}
              {!loading && <ArrowRightIcon className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400 text-center">
            Already have an account?{" "}
            <Link
              href={`/auth/signin?callbackUrl=${encodeURIComponent(redirect)}`}
              className="font-medium text-violet-600 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300"
            >
              Sign in
            </Link>
          </p>

          <p className="mt-4 text-xs text-slate-400 dark:text-slate-500 text-center">
            No credit card required. Free plan includes 1 cloud account.
          </p>
        </div>
      </div>

      {isOperatorFlow && (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-50/80 dark:bg-slate-900/50 border-l border-slate-100 dark:border-slate-800/50 px-12 relative z-10 backdrop-blur-sm">
          <div className="max-w-xs">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-200 mb-5">
              What you get — free
            </h2>
            <div className="space-y-4">
              {[
                { icon: ShieldCheckIcon, text: "Read-only AWS access via assume-role" },
                { icon: CheckCircleIcon, text: "Full infrastructure scan and analysis" },
                { icon: CheckCircleIcon, text: "Cost, security, and drift findings" },
                { icon: CheckCircleIcon, text: "Prioritized recommendations" },
                { icon: CheckCircleIcon, text: "Execution plans on upgrade" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-400">
                  <item.icon className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
