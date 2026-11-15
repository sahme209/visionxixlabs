"use client";

import { VerificationRecovery } from "@/components/auth/VerificationRecovery";
import { useState, Suspense, useEffect, useRef } from "react";
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
  const authInFlight = useRef(false);
  const [oauthLoading, setOauthLoading] = useState<null | "google" | "github" | "cognito">(null);
  const [enabledProviders, setEnabledProviders] = useState<{ google: boolean; github: boolean; cognito: boolean } | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeInternalPath(searchParams.get("callbackUrl"), "/control");
  const switchingAccount = searchParams.get("switchAccount") === "1";

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
        cognito: Boolean(p && "cognito" in p),
      });
    }).catch(() => {
      if (!cancelled) setEnabledProviders({ google: false, github: false, cognito: false });
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authInFlight.current) return;
    authInFlight.current = true;
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
      authInFlight.current = false;
      setLoading(false);
    }
  };

  const providerLabel = (provider: "google" | "github" | "cognito") =>
    provider === "google" ? "Google" : provider === "github" ? "GitHub" : "Cognito";

  const handleOAuth = async (provider: "google" | "github" | "cognito") => {
    if (authInFlight.current) return;
    // Hard-stop when the provider isn't actually registered on the server.
    if (enabledProviders && !enabledProviders[provider]) {
      setError(
        `${providerLabel(provider)} sign-in is not available for this workspace yet. ` +
        "Use email sign-in or contact the Axiom team for access."
      );
      return;
    }
    authInFlight.current = true;
    setOauthLoading(provider);
    setError("");
    try {
      const res = switchingAccount && provider === "google"
        ? await signIn(provider, { callbackUrl, redirect: true }, { prompt: "select_account" })
        : await signIn(provider, { callbackUrl, redirect: true });
      // When redirect: true succeeds, the browser navigates away. If it
      // returns instead (e.g. cancelled / popup blocked), surface a hint.
      if (res?.error) {
        setError(`We couldn't complete ${providerLabel(provider)} sign-in. Try again or use email sign-in.`);
      }
    } catch {
      setError(`We couldn't start ${providerLabel(provider)} sign-in. Try again or use email sign-in.`);
    } finally {
      authInFlight.current = false;
      setOauthLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0908] px-6 py-16 text-zinc-100">
      <div className="w-full max-w-[360px]">
        <Link href="/" aria-label="vxix home" className="mx-auto mb-8 flex w-fit rounded-sm focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-zinc-300">
          <Image src="/brand/vxix-wordmark.svg" alt="vxix" width={120} height={30} priority />
        </Link>
        <h1 className="text-center text-[28px] font-medium tracking-[-0.04em]">Welcome to Axiom</h1>
        <p className="mb-8 mt-2 text-center text-[15px] text-zinc-400">Your engineering workspace.</p>

        {switchingAccount && <p role="status" className="mb-5 rounded-lg border border-white/10 p-3 text-sm text-zinc-300">Choose the account you want to pair. Google will ask you to select an account. Signing out here does not sign you out of GitHub: switch to the intended account on GitHub before continuing if needed. You must still review and approve the desktop after signing in.</p>}

        {searchParams.get("verified") === "1" && <p role="status" className="mb-5 rounded-lg border border-white/10 p-3 text-sm text-zinc-300">Email verification completed. Sign in to continue. This confirmation does not sign you in or approve desktop pairing.</p>}

        {oauthError && <div role="alert" className="mb-6 flex items-start gap-2 rounded-lg border border-white/15 bg-white/5 p-3 text-sm leading-6 text-zinc-300">
          <ExclamationTriangleIcon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
          <p>We couldn&apos;t complete sign-in. Try again, or <Link href="/support" className="underline underline-offset-4 hover:text-white">contact support</Link> if it continues.</p>
        </div>}
        {/* OAuth buttons — only render when actually configured. Cleaner than
            showing greyed-out "NOT SET" buttons (the previous approach). */}
        {(enabledProviders === null || enabledProviders.google || enabledProviders.github || enabledProviders.cognito) && (
          <>

            <div className="grid gap-2.5">
              {(enabledProviders === null || enabledProviders.google) && (
                <button
                  type="button"
                  onClick={() => handleOAuth("google")}
                  disabled={oauthLoading !== null || loading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-zinc-100 px-4 py-3 text-sm font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-300"
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
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-300"
                >
                  <GitHubMark className="h-4 w-4" />
                  {oauthLoading === "github" ? "Opening…" : "Sign in with GitHub"}
                </button>
              )}
              {enabledProviders?.cognito && (
                <button
                  type="button"
                  onClick={() => handleOAuth("cognito")}
                  disabled={oauthLoading !== null || loading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-300"
                >
                  <SsoMark className="h-4 w-4" />
                  {oauthLoading === "cognito" ? "Opening…" : "Sign in with Cognito"}
                </button>
              )}
            </div>
          </>
        )}

        {(enabledProviders === null || enabledProviders.google || enabledProviders.github || enabledProviders.cognito) && <div className="my-6 flex items-center gap-3" aria-hidden="true"><span className="h-px flex-1 bg-white/10" /><span className="text-xs text-zinc-500">or use email</span><span className="h-px flex-1 bg-white/10" /></div>}
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
              placeholder="you@company.com"
              className="block w-full rounded-lg border border-white/8 bg-white/4 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-400 outline-hidden transition focus:border-white/30 focus:bg-white/6 focus:ring-2 focus:ring-white/15"
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
                className="block w-full rounded-lg border border-white/8 bg-white/4 px-3.5 py-2.5 pr-12 text-sm text-white placeholder:text-zinc-400 outline-hidden transition focus:border-white/30 focus:bg-white/6 focus:ring-2 focus:ring-white/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-0.5 top-1/2 inline-flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-sm text-zinc-400 hover:text-zinc-200 transition-colors focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-200"
                aria-label={showPassword ? "Hide password" : "Show password"}

              >
                {showPassword ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
          </div>
          {error && (
            <div role="alert" aria-live="assertive" className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-zinc-200">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || oauthLoading !== null}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
            {!loading && <ArrowRightIcon className="h-4 w-4" />}
          </button>
        </form>

        <VerificationRecovery initialEmail={email} callbackUrl={callbackUrl} />

        <p className="mt-6 text-sm text-zinc-500 text-center">
          Don&apos;t have an account?{" "}
          {callbackUrl.startsWith("/desktop/") ? (
            <Link href={`/auth/signup?redirect=${encodeURIComponent(callbackUrl)}`} className="font-medium text-zinc-200 hover:text-white">
              Create one
            </Link>
          ) : (
            <Link href="/download" className="font-medium text-zinc-200 hover:text-white">
              Set up through Axiom Agent
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
  if (!value || value.startsWith("//") || /[\\\x00-\x20]/.test(value)) return fallback;
  try {
    const origin = typeof window === "undefined" ? "https://visionxixlabs.com" : window.location.origin;
    const parsed = new URL(value, origin);
    return parsed.origin === origin && !parsed.username && !parsed.password ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
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

/** Generic lock mark — enterprise SSO (Cognito today) isn't one fixed brand. */
function SsoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="9.5" rx="1.5" />
      <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" />
    </svg>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="axiom-canvas min-h-screen flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-transparent" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
