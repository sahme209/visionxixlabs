import { z } from "zod";

// Unsigned navigation hints only. No issuer, login, membership or execution grant.
const opaque = z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/);
const instant = z.string().max(32).refine(value => { try { return new Date(value).toISOString() === value; } catch { return false; } });
const schema = z.object({ destination: z.literal("members"), expectedUserId: opaque, organizationId: opaque,
 membershipAcceptedAt: instant, membershipUpdatedAt: instant, issuedAt: instant, expiresAt: instant }).strict();
export type BrowserNavigationIntent = Readonly<z.infer<typeof schema>>;
export const BROWSER_NAVIGATION_FIELDS = ["destination", "expectedUserId", "organizationId", "membershipAcceptedAt", "membershipUpdatedAt", "issuedAt", "expiresAt"] as const;
export function parseBrowserNavigationIntent(input: unknown, now: number): BrowserNavigationIntent | null {
 const parsed = schema.safeParse(input);
 if (!parsed.success || !Number.isSafeInteger(now) || now < 0) return null;
 const hint = parsed.data, issued = Date.parse(hint.issuedAt), expiry = Date.parse(hint.expiresAt);
 if (issued > now || expiry <= now || expiry <= issued || expiry - issued > 300_000) return null;
 return Object.freeze(hint);
}
export function browserNavigationIntentPath(hint: BrowserNavigationIntent): string {
 // Reparse even typed input; callers may receive untrusted runtime values.
 const parsed = schema.parse(hint);
 return `/workspace-handoff?${new URLSearchParams(parsed).toString()}`;
}
export function matchesBrowserNavigationMembership(hint: BrowserNavigationIntent, membership: { acceptedAt: Date | null; updatedAt?: Date } | null): boolean {
 try { return membership?.acceptedAt?.toISOString() === hint.membershipAcceptedAt && membership.updatedAt?.toISOString() === hint.membershipUpdatedAt; } catch { return false; }
}

export function browserNavigationMembersPath(hint: BrowserNavigationIntent): string {
 const parsed = schema.parse(hint);
 return `/control/members?${new URLSearchParams({ desktopNavigation: "1", ...parsed }).toString()}`;
}
export function parseBrowserNavigationArrival(input: Record<string, unknown>, now: number): BrowserNavigationIntent | null {
 const { desktopNavigation, ...rest } = input;
 return desktopNavigation === "1" ? parseBrowserNavigationIntent(rest, now) : null;
}
