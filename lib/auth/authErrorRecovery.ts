import { canonicalAuthOrigin } from './canonicalAuthOrigin';

/** Matches this installation's NextAuth default; never mix secure/plain cookies. */
export function authErrorCallbackCookie(origin: string): string | null {
  const configured = canonicalAuthOrigin(origin);
  if (!configured) return null;
  return `${new URL(configured).protocol === 'https:' ? '__Secure-' : ''}next-auth.callback-url`;
}

/** Untrusted navigation hint only. Never identity, permission or pairing evidence. */
export function authErrorRecoveryCallback(value: string | undefined, origin: string): string | null {
  const configured = canonicalAuthOrigin(origin);
  if (!configured || !value || value.length > 4096 || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return null;
  if (!value.startsWith('/') && !value.startsWith('https://') && !value.startsWith('http://')) return null;
  try {
    const url = new URL(value, configured);
    if (url.origin !== configured || url.username || url.password) return null;
    const path = decodeURIComponent(url.pathname);
    if (/[\\\u0000-\u0020]/.test(path) || path.startsWith('//') || /^\/(?:auth(?:\/|$)|api\/auth(?:\/|$))/i.test(path)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
