"use client";

import { useState, Suspense, useEffect } from "react";
import { signIn, getProviders } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowRightIcon, EyeIcon, EyeSlashIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | "google" | "github">(null);
  const [enabledProviders, setEnabledProviders] = useState<{ google: boolean; github: boolean } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeInternalPath(searchParams.get("callbackUrl"), "/auth/success");

  // Surface a clear hint when the OAuth callback errored.
  const oauthError = searchParams.get("error");

  // Fetch the actually-registered NextAuth providers so we can disable
  // buttons + show a real reason when env vars aren't set on the host.
  useEffect(() => {
    let cancelled = false;
    getProviders().then((p) => {
      if (cancelled) return;
      setEnabledProviders({
        google: Boolean(p && "google" in p),
        github: Boolean(p && "github" in p),
      });
    }).catch(() => {
      if (!cancelled) setEnabledProviders({ google: false, github: false });
    });
    return () => { cancelled = true; };
  }, []);

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

  const handleOAuth = async (provider: "google" | "github") => {
    // Hard-stop when the provider isn't actually registered on the server.
    if (enabledProviders && !enabledProviders[provider]) {
      setError(
        `${provider === "google" ? "Google" : "GitHub"} sign-in is not available for this workspace yet. ` +
        "Use email sign-in or contact the Axiom team for access."
      );
      return;
    }
    setOauthLoading(provider);
    setError("");
    try {
      const res = await signIn(provider, { callbackUrl, redirect: true });
      // When redirect: true succeeds, the browser navigates away. If it
      // returns instead (e.g. cancelled / popup blocked), surface a hint.
      if (res?.error) {
        setError(`We couldn't complete ${provider === "google" ? "Google" : "GitHub"} sign-in. Try again or use email sign-in.`);
      }
    } catch {
      setError(`We couldn't start ${provider === "google" ? "Google" : "GitHub"} sign-in. Try again or use email sign-in.`);
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <div className="axiom-canvas relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-20">
      <div aria-hidden className="absolute inset-0 bg-cover bg-center opacity-20" style={{ backgroundImage: "url('/images/axiom-hero-landscape-v1.png')" }} />
      <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(11,12,11,0.76),rgba(11,12,11,0.96)_72%,#0c0d0c)]" />
      <Link href="/" className="absolute left-6 top-6 z-20 flex items-center gap-2.5 text-sm font-semibold text-zinc-200 transition-colors hover:text-white">
        <Image src="/vision-xix-logo.png" alt="" width={27} height={27} className="rounded-md" />
        Vision XIX Labs
      </Link>

      <div className="relative z-10 w-full max-w-lg rounded-[28px] border border-white/[0.09] bg-black/25 p-6 shadow-[0_28px_100px_rgba(0,0,0,0.26)] backdrop-blur-md sm:p-9">
        <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.045]">
          <Image src="/vision-xix-logo.png" alt="" width={30} height={30} className="rounded-md" />
        </div>
        <h1 className="mb-2 text-3xl font-normal tracking-[-0.045em]">Welcome to Axiom</h1>
        <p className="mb-2 text-sm text-zinc-400">Sign in to your web companion for account settings, connection context, and release guidance.</p>
        <p className="mb-8 text-xs leading-5 text-zinc-600">The installed Agent remains the secure place for provider configuration and deployment operations.</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
              placeholder="you@company.com"
              className="block w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-violet-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="block w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 pr-10 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-violet-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-violet-500/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-zinc-500 hover:text-zinc-200 transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" aria-live="assertive" className="rounded-lg border border-red-500/20 bg-red-500/[0.08] px-3.5 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || oauthLoading !== null}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
            {!loading && <ArrowRightIcon className="h-4 w-4" />}
          </button>
        </form>

        {/* OAuth buttons — only render when actually configured. Cleaner than
            showing greyed-out "NOT SET" buttons (the previous approach). */}
        {(enabledProviders === null || enabledProviders.google || enabledProviders.github) && (
          <>
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-xs text-zinc-600">Or</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            {oauthError && (
              <div className="mb-3 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3.5 py-2.5 text-xs text-amber-200 flex items-start gap-2">
                <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>OAuth returned <span className="font-mono">{oauthError}</span>.</span>
              </div>
            )}

            <div className={`grid gap-3 ${enabledProviders === null ? "grid-cols-2" : enabledProviders.google && enabledProviders.github ? "grid-cols-2" : "grid-cols-1"}`}>
              {(enabledProviders === null || enabledProviders.google) && (
                <button
                  type="button"
                  onClick={() => handleOAuth("google")}
                  disabled={oauthLoading !== null || loading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-2.5 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <GoogleMark className="h-4 w-4" />
                  {oauthLoading === "google" ? "Opening…" : "Sign in with Google"}
                </button>
              )}
              {(enabledProviders === null || enabledProviders.github) && (
                <button
                  type="button"
                  onClick={() => handleOAuth("github")}
                  disabled={oauthLoading !== null || loading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-white/[0.025] px-3 py-2.5 text-xs font-medium text-zinc-200 transition hover:bg-white/[0.07] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <GitHubMark className="h-4 w-4" />
                  {oauthLoading === "github" ? "Opening…" : "Sign in with GitHub"}
                </button>
              )}
            </div>
          </>
        )}

        <p className="mt-6 text-sm text-zinc-500 text-center">
          Don&apos;t have an account?{" "}
          {callbackUrl.startsWith("/desktop/") ? (
            <Link href={`/auth/signup?redirect=${encodeURIComponent(callbackUrl)}`} className="font-medium text-zinc-200 hover:text-white">
              Create one
            </Link>
          ) : (
            <Link href="/plans" className="font-medium text-zinc-200 hover:text-white">
              Request pilot access
            </Link>
          )}
        </p>
        <p className="mt-2 text-xs text-zinc-500 text-center">
          Need the application?{" "}
          <Link href="/download" className="font-medium text-zinc-300 underline decoration-white/20 underline-offset-2 hover:text-white">
            Return to downloads →
          </Link>
        </p>
      </div>
    </div>
  );
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

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 0-24c3 0 5.7 1.1 7.8 2.9l5.7-5.7A20 20 0 1 0 24 44c11 0 20-8 20-20 0-1.2-.1-2.3-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 2.9l5.7-5.7A20 20 0 0 0 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.5l6.3 5.3C41.9 35 44 30 44 24c0-1.2-.1-2.3-.4-3.5z" />
    </svg>
  );
}

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 .5C5.7.5.7 5.6.7 11.8c0 5 3.3 9.2 7.8 10.7.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1.1-.8.1-.8.1-.8 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.7.9 1.2 2 1.2 3.2 0 4.6-2.8 5.5-5.4 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6 4.5-1.5 7.8-5.8 7.8-10.7C23.3 5.6 18.3.5 12 .5z"
      />
    </svg>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="axiom-canvas min-h-screen flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
