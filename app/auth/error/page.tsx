import Image from 'next/image';
import Link from 'next/link';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { canonicalAuthOrigin, isCanonicalAuthHost } from '@/lib/auth/canonicalAuthOrigin';
import { authErrorCallbackCookie, authErrorRecoveryCallback } from '@/lib/auth/authErrorRecovery';

// Recovery depends on current host/config/cookies, including after an offline build.
export const dynamic = 'force-dynamic';

/** Public denial recovery: no session, identity lookup, provider call or admission. */
export default async function AuthErrorPage() {
  const origin = canonicalAuthOrigin(process.env.NEXTAUTH_URL);
  if (!origin) return <main className="axiom-canvas flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-zinc-100">
    <Link href="/" aria-label="vxix home"><Image src="/brand/vxix-wordmark.svg" alt="vxix" width={160} height={40} /></Link>
    <h1 className="text-3xl font-normal tracking-tight">Sign-in is temporarily unavailable.</h1>
    <p className="max-w-sm text-sm leading-6 text-zinc-400">Try again later, or contact support if it continues.</p>
    <Link href="/contact" className="inline-flex min-h-11 items-center rounded-lg border border-white/20 px-4 text-sm focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-zinc-200">Contact support</Link>
  </main>;
  // Only server configuration chooses the host. An alias must not read a cookie
  // as though it were the canonical site's original callback.
  if (!isCanonicalAuthHost((await headers()).get('host'), origin)) redirect(`${origin}/auth/error`);
  const cookieName = authErrorCallbackCookie(origin);
  const callback = authErrorRecoveryCallback(cookieName ? (await cookies()).get(cookieName)?.value : undefined, origin);
  // NextAuth's custom error handoff omits callbackUrl. Recover its existing
  // HTTP-only hint, validate it, and pass it through the normal sign-in guard.
  // Never forward provider codes, state, caller error text or unknown parameters.
  const query = new URLSearchParams({ error: 'SignInFailed' });
  if (callback) query.set('callbackUrl', callback);
  redirect(`/auth/signin?${query.toString()}`);
}
