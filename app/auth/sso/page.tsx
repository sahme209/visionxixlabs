import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Company sign-in · V19", robots: { index: false } };
export const dynamic = "force-dynamic";

const MESSAGES: Record<string, string> = {
  "sso.email_invalid": "Enter your work email address.",
  "sso.no_provider_for_domain": "Company sign-in is not set up for this email domain. Use another sign-in method, or ask your administrator.",
  "sso.existing_account_not_member": "This account is not part of your company's V19 workspace yet. Ask an administrator to invite you.",
  "sso.no_role_mapping": "Your company account has no V19 role assigned. Ask your administrator.",
  "sso.mfa_required_not_present": "Your company requires multi-factor sign-in. Sign in again with it.",
  "sso.scim_deprovisioned": "Your company has turned off your access to V19.",
  "sso.rate_limited": "Too many attempts. Wait a minute and try again.",
};
const fallback = "Company sign-in did not complete. Try again, or use another sign-in method.";

function safePath(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : "/control";
}

export default async function CompanySignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const p = await searchParams;
  if (p.test === "passed") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111] px-4 text-zinc-100">
        <div className="w-[260px] text-center">
          <h1 className="text-[20px] leading-6 font-medium">Test sign-in passed</h1>
          <p role="status" className="mt-2 text-xs leading-4 text-zinc-400">Your identity provider and V19 completed the round trip. Nobody was signed in. Return to V19 Settings → Identity to activate the connection within 24 hours.</p>
        </div>
      </main>
    );
  }
  const error = p.error ? MESSAGES[p.error] ?? fallback : null;
  const callbackUrl = safePath(p.callbackUrl);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111] px-4 text-zinc-100">
      <div className="w-[230px]">
        <h1 className="text-center text-[20px] leading-6 font-medium">Company sign-in</h1>
        <p className="mt-2 text-center text-xs leading-4 text-zinc-400">Sign in with your work account through your company&apos;s identity provider.</p>
        <form method="post" action="/api/sso/oidc/start" className="mt-6 grid gap-3">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <label htmlFor="sso-email" className="sr-only">Work email</label>
          <input id="sso-email" name="email" type="email" required autoComplete="email" placeholder="you@company.com"
            className="min-h-[30px] rounded-lg border border-white/10 bg-[#1a1a1a] px-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40" />
          {error && <div role="alert" className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-zinc-200">{error}</div>}
          <button type="submit" className="inline-flex min-h-[30px] items-center justify-center rounded-lg bg-white px-3 text-xs font-medium text-black hover:bg-zinc-200">Continue</button>
        </form>
        <p className="mt-4 text-center text-xs text-zinc-500"><Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`} className="underline underline-offset-2 hover:text-zinc-300">Other sign-in methods</Link></p>
      </div>
    </main>
  );
}
