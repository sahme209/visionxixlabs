"use client";

import { useState, Suspense, useEffect, useRef } from "react";
import { signIn, getProviders } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { VerificationRecovery } from "@/components/auth/VerificationRecovery";
import { EyeIcon, EyeSlashIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

type SignInProvider = "google" | "github" | "cognito" | "gitlab";
const secondaryProviderClass = "inline-flex size-[30px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#202020] text-zinc-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-300 [@media(pointer:coarse)]:size-11";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const authInFlight = useRef(false);
  const [oauthLoading, setOauthLoading] = useState<null | SignInProvider>(null);
  const [enabledProviders, setEnabledProviders] = useState<Record<SignInProvider, boolean> | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeInternalPath(searchParams.get("callbackUrl"), "/control");
  const switchingAccount = searchParams.get("switchAccount") === "1";

  const signInError = searchParams.get("error");
  const verificationLinkInvalid = signInError === "VerificationLinkInvalid";

  // Offer OAuth only after the server reports the registered providers.
  useEffect(() => {
    let cancelled = false;
    getProviders().then((p) => {
      if (cancelled) return;
      setEnabledProviders({
        google: Boolean(p && "google" in p),
        github: Boolean(p && "github" in p),
        cognito: Boolean(p && "cognito" in p),
        gitlab: Boolean(p && "gitlab" in p),
      });
    }).catch(() => {
      if (!cancelled) setEnabledProviders({ google: false, github: false, cognito: false, gitlab: false });
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (authInFlight.current) return;
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }
    if (!emailExpanded) {
      setEmailExpanded(true);
      return;
    }
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
      if (!res?.ok) {
        setError("Something went wrong");
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

  const providerLabel = (provider: SignInProvider) =>
    provider === "google" ? "Google" : provider === "github" ? "GitHub" : provider === "gitlab" ? "GitLab" : "Cognito";

  const handleOAuth = async (provider: SignInProvider) => {
    if (authInFlight.current) return;
    // Hard-stop when the provider isn't actually registered on the server.
    if (!enabledProviders?.[provider]) {
      setError(
        `${providerLabel(provider)} sign-in is not available for this workspace yet. ` +
        "Use email sign-in or contact the V19 team for access."
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
    <div className="isolate flex min-h-screen items-center justify-center bg-[#111111] before:fixed before:inset-0 before:-z-10 before:bg-[#111111] px-6 py-16 text-zinc-100">
      <div className="relative w-full max-w-[230px]">
        <Link href="/" aria-label="vxix home" className="mx-auto mb-[30px] flex w-fit rounded-sm focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-zinc-300">
          <Image src="/brand/vxix-mark.svg" alt="vxix" width={24} height={24} priority />
        </Link>
        <div className="mb-[30px] text-center text-[20px] font-medium leading-6 tracking-[-0.02em]">
          <h1 className="leading-6">Welcome to V19</h1>
          <p className="leading-6 text-zinc-400">Your engineering agent</p>
        </div>

        {switchingAccount && <p role="status" className="mb-5 rounded-lg border border-white/10 p-3 text-sm text-zinc-300">Choose the account you want to pair. Google will ask you to select an account. Signing out here does not sign you out of GitHub: switch to the intended account on GitHub before continuing if needed. You must still review and approve the desktop after signing in.</p>}

        {searchParams.get("verified") === "1" && <p role="status" className="mb-5 rounded-lg border border-white/10 p-3 text-sm text-zinc-300">Email verification completed. Sign in to continue. This confirmation does not sign you in or approve desktop pairing.</p>}

        {signInError && <div role="alert" className="mb-6 flex items-start gap-2 rounded-lg border border-white/15 bg-white/5 p-3 text-sm leading-6 text-zinc-300">
          <ExclamationTriangleIcon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0" />
          <p>{verificationLinkInvalid
            ? "This verification link is invalid, expired, or has already been used."
            : "We couldn't complete sign-in. Try again or choose another sign-in method."}</p>
        </div>}
        {verificationLinkInvalid && (
          <div className="mb-6">
            <VerificationRecovery callbackUrl={callbackUrl} initiallyOpen />
          </div>
        )}
        {enabledProviders?.google && (
          <button
            type="button"
            onClick={() => handleOAuth("google")}
                        disabled={oauthLoading !== null || loading}
            className="inline-flex min-h-[30px] w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-1.5 text-xs leading-4 font-medium text-zinc-950 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-300"
          >
            <GoogleMark className="h-[11px] w-[11px] grayscale" />
            {oauthLoading === "google" ? "Opening…" : "Continue with Google"}
          </button>
        )}

        {enabledProviders?.google && <div className="my-3 flex items-center gap-2.5" aria-hidden="true"><span className="h-px flex-1 bg-white/10" /><span className="text-[10px] leading-[14px] text-zinc-500">OR</span><span className="h-px flex-1 bg-white/10" /></div>}
        <form onSubmit={handleSubmit} className="grid gap-2.5" noValidate>
          <div>
            <label htmlFor="email" className="sr-only">
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
              placeholder="Enter your work email…"
              className="block min-h-[30px] w-full rounded-lg border border-white/10 bg-[#202020] px-2.5 py-1.5 text-xs leading-4 [@media(pointer:coarse)]:text-base text-white placeholder:text-zinc-400 outline-hidden transition focus:border-white/30 focus:bg-white/6 focus:ring-2 focus:ring-white/15"
            />
          </div>
          {emailExpanded && <div>
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
                autoFocus
                placeholder="••••••••"
                className="block w-full rounded-lg border border-white/8 bg-white/4 px-3.5 py-2.5 pr-12 text-sm [@media(pointer:coarse)]:text-base text-white placeholder:text-zinc-400 outline-hidden transition focus:border-white/30 focus:bg-white/6 focus:ring-2 focus:ring-white/15"
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
          </div>}
          {error && (
            <div role="alert" aria-live="assertive" className="rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-zinc-200">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={loading || oauthLoading !== null}
            className="inline-flex min-h-[30px] w-full items-center justify-center rounded-lg border border-white/10 bg-[#202020] px-3 py-1.5 text-xs leading-4 font-medium text-zinc-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Signing in…" : emailExpanded ? "Sign in" : "Continue"}
          </button>
        </form>

        {enabledProviders && (
          <div role="group" aria-label="Other sign-in methods" className="absolute left-0 right-0 top-full mt-3 flex justify-center gap-3">
            <a href={`/auth/sso?callbackUrl=${encodeURIComponent(callbackUrl)}`} aria-label="Sign in with your company (SSO)" title="Company SSO" className={secondaryProviderClass}>
              <SsoMark className="h-4 w-4" />
            </a>
            {enabledProviders.github && (
              <button
                type="button"
                onClick={() => handleOAuth("github")}
                aria-label={oauthLoading === "github" ? "Opening GitHub…" : "Sign in with GitHub"}
                disabled={oauthLoading !== null || loading}
                title="GitHub"
                className={secondaryProviderClass}
              >
                <GitHubMark className="h-4 w-4" />
              </button>
            )}
            {enabledProviders.cognito && (
              <button
                type="button"
                onClick={() => handleOAuth("cognito")}
                aria-label={oauthLoading === "cognito" ? "Opening Cognito…" : "Sign in with Cognito"}
                disabled={oauthLoading !== null || loading}
                title="Cognito SSO"
                className={secondaryProviderClass}
              >
                <SsoMark className="h-4 w-4" />
              </button>
            )}
            {enabledProviders.gitlab && (
              <button type="button" onClick={() => handleOAuth("gitlab")}
                aria-label={oauthLoading === "gitlab" ? "Opening GitLab…" : "Sign in with GitLab"}
                title="GitLab" disabled={oauthLoading !== null || loading} className={secondaryProviderClass}>
                <Image src="/logos/integrations/gitlab.svg" alt="" aria-hidden width={16} height={16} className="h-4 w-4 invert" />
              </button>
            )}
          </div>
        )}
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
