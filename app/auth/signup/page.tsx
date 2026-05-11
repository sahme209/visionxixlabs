"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CpuChipIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

export default function SignUpPage() {
  return (
    <Suspense>
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
    <div className="min-h-screen flex bg-slate-950">
      {/* Left panel — form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-8">
        <div className="w-full max-w-md">
          <Link href={isOperatorFlow ? "/operator" : "/"} className="inline-flex items-center gap-2 text-slate-400 hover:text-violet-400 mb-8 transition-colors">
            <CpuChipIcon className="h-5 w-5" />
            <span className="font-semibold text-sm">Cloud Operator</span>
          </Link>

          <h1 className="text-2xl font-bold text-slate-100 mb-1">Create your account</h1>
          <p className="text-slate-500 mb-8 text-sm">
            {isOperatorFlow
              ? "Scan your cloud and get findings in under 5 minutes."
              : "Start managing your cloud infrastructure."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@company.com"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="8+ characters"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 text-sm"
              />
            </div>
            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 py-3 font-semibold text-white hover:shadow-lg hover:shadow-violet-500/20 disabled:opacity-60 flex items-center justify-center gap-2 text-sm transition-all"
            >
              {loading ? "Creating account..." : "Create account"}
              <ArrowRightIcon className="h-4 w-4" />
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-600 text-center">
            Already have an account?{" "}
            <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(redirect)}`} className="text-violet-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>

      {/* Right panel — trust signals (hidden on mobile) */}
      {isOperatorFlow && (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-slate-900/50 border-l border-slate-800/50 px-12">
          <div className="max-w-sm">
            <h2 className="text-lg font-semibold text-slate-200 mb-6">What you get — free:</h2>
            <div className="space-y-5">
              {[
                { icon: ShieldCheckIcon, text: "Connect your AWS account with read-only access" },
                { icon: CheckCircleIcon, text: "AI-powered infrastructure analysis" },
                { icon: CheckCircleIcon, text: "Cost, security, and drift findings" },
                { icon: CheckCircleIcon, text: "Prioritized recommendations report" },
                { icon: CheckCircleIcon, text: "Phased execution plans (on upgrade)" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-slate-400">
                  <item.icon className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                  {item.text}
                </div>
              ))}
            </div>
            <div className="mt-8 pt-6 border-t border-slate-800">
              <p className="text-xs text-slate-600">
                No credit card required. Free plan includes 1 cloud connection and full analysis.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
