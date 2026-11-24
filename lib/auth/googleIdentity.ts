import { compare } from "bcryptjs";
import type { PrismaClient, Prisma } from "@/lib/prismaClient";
import { qualifiedGoogleIdentity, identityIssuer, type LinkIdentityProvider } from "./googleIdentityClaims";
import { googleLinkContext, googleLinkCsrf, hashGoogleLinkProof, newGoogleLinkNonce, sameGoogleLinkHash } from "./googleLinkContext";
import { sendGoogleLinkConfirmation } from "./emailVerification";

const identitySelect = { id: true, email: true, name: true, image: true } as const;
const subjectKey = (provider: LinkIdentityProvider, subject: string) => ({ provider, issuer: identityIssuer[provider], subject });
export class GoogleIdentityUnavailable extends Error { constructor() { super("google_identity_unavailable"); } }
export type GoogleResolution = { kind: "resolved"; user: { id: string; email: string; name: string | null; image: string | null }; subject: string } | { kind: "recover" };

/** Only call from NextAuth's verified OIDC callback, never a public claims endpoint. */
export async function resolveGoogleIdentity(db: PrismaClient, input: { profile: unknown; providerAccountId: unknown; email: unknown }, now = new Date(), provider: LinkIdentityProvider = "google"): Promise<GoogleResolution> {
  const identity = qualifiedGoogleIdentity(input.profile, input.providerAccountId, input.email, now, provider);
  if (!identity) throw new GoogleIdentityUnavailable();
  const bound = await db.oAuthIdentity.findUnique({ where: { provider_issuer_subject: subjectKey(provider, identity.subject) }, select: { user: { select: identitySelect } } });
  if (bound) return { kind: "resolved", user: bound.user, subject: identity.subject };
  const existing = await db.user.findUnique({ where: { email: identity.email }, select: { id: true, updatedAt: true } });
  if (!existing && identity.authoritativeEmail) {
    // No email upsert: an intervening signup or subject-link race refuses/restarts.
    const user = await db.$transaction(async tx => {
      const user = await tx.user.create({ data: { email: identity.email, emailVerifiedAt: now }, select: identitySelect });
      await tx.oAuthIdentity.create({ data: { ...subjectKey(provider, identity.subject), userId: user.id } });
      return user;
    }, { isolationLevel: "Serializable" });
    return { kind: "resolved", user, subject: identity.subject };
  }
  const context = googleLinkContext.getStore();
  if (!context) throw new GoogleIdentityUnavailable();
  // Never offer mailbox recovery as a replacement for an established binding.
  if (existing && await db.oAuthIdentity.findUnique({ where: { userId_provider_issuer: { userId: existing.id, provider, issuer: identityIssuer[provider] } }, select: { id: true } })) throw new GoogleIdentityUnavailable();
  const nonce = newGoogleLinkNonce();
  const id = newGoogleLinkNonce();
  // The legacy table already distinguishes the two providers by immutable issuer.
  await db.pendingGoogleIdentityLink.create({ data: {
    id, issuer: identityIssuer[provider], subject: identity.subject, email: identity.email,
    candidateUserId: existing?.id ?? null, candidateUpdatedAt: existing?.updatedAt ?? null,
    browserNonceHash: hashGoogleLinkProof(nonce), csrfHash: hashGoogleLinkProof(googleLinkCsrf(nonce, id)),
    callbackPath: context.callbackPath, createdAt: now, expiresAt: identity.expiresAt,
  } });
  context.pendingCookie = nonce;
  return { kind: "recover" };
}

type LinkIntent = Prisma.PendingGoogleIdentityLinkGetPayload<Record<string, never>>;
export async function activeGoogleLink(db: PrismaClient, nonce: string, now = new Date(), provider: LinkIdentityProvider = "google"): Promise<LinkIntent | null> {
  const intent = await db.pendingGoogleIdentityLink.findUnique({ where: { browserNonceHash: hashGoogleLinkProof(nonce) } });
  return intent && intent.issuer === identityIssuer[provider] && !intent.consumedAt && intent.attempts < 5 && intent.expiresAt > now ? intent : null;
}
export function validGoogleLinkCsrf(intent: LinkIntent, nonce: string, csrf: unknown): boolean {
  return typeof csrf === "string" && csrf.length <= 128 && sameGoogleLinkHash(csrf, intent.csrfHash) && csrf === googleLinkCsrf(nonce, intent.id);
}
export type GoogleLinkResult = "linked" | "code_sent" | "delivery_unavailable" | "restart" | "proof_refused" | "wait";
export async function sendGoogleLinkCode(db: PrismaClient, intent: LinkIntent, now = new Date(), provider: LinkIdentityProvider = "google"): Promise<GoogleLinkResult> {
  if (intent.issuer !== identityIssuer[provider]) return "restart";
  const code = newGoogleLinkNonce();
  const expiresAt = new Date(Math.min(now.getTime() + 10 * 60_000, intent.expiresAt.getTime()));
  const written = await db.pendingGoogleIdentityLink.updateMany({ where: {
    id: intent.id, consumedAt: null, expiresAt: { gt: now }, attempts: { lt: 5 },
    OR: [{ emailSentAt: null }, { emailSentAt: { lte: new Date(now.getTime() - 60_000) } }],
  }, data: { emailProofHash: hashGoogleLinkProof(code), emailProofExpiresAt: expiresAt, emailSentAt: now } });
  if (written.count !== 1) return "wait";
  try { return await sendGoogleLinkConfirmation({ to: intent.email, code, ...(provider === "gitlab" ? { provider } : {}) }) ? "code_sent" : "delivery_unavailable"; }
  catch { return "delivery_unavailable"; }
}

/** Proof, single-use consumption and identity creation share one serializable commit. */
export async function confirmGoogleLink(db: PrismaClient, intent: LinkIntent, proof: { password?: unknown; code?: unknown }, clock: () => Date = () => new Date(), provider: LinkIdentityProvider = "google"): Promise<GoogleLinkResult> {
  if (intent.issuer !== identityIssuer[provider]) return "restart";
  const now = clock();
  const candidate = intent.candidateUserId ? await db.user.findUnique({ where: { id: intent.candidateUserId }, select: { id: true, email: true, updatedAt: true, passwordHash: true, emailVerifiedAt: true } }) : null;
  let passwordVerified = false;
  if (typeof proof.password === "string" && proof.password.length <= 1024 && candidate?.passwordHash && candidate.emailVerifiedAt) passwordVerified = await compare(proof.password, candidate.passwordHash);
  const codeVerified = typeof proof.code === "string" && proof.code.length <= 128 && !!intent.emailProofHash && !!intent.emailProofExpiresAt && intent.emailProofExpiresAt > now && sameGoogleLinkHash(proof.code, intent.emailProofHash);
  if (!passwordVerified && !codeVerified) {
    await db.pendingGoogleIdentityLink.updateMany({ where: { id: intent.id, consumedAt: null, expiresAt: { gt: clock() }, attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
    return "proof_refused";
  }
  try {
    return await db.$transaction(async tx => {
      // Lock before capturing acceptance time: expiry cannot be checked before
      // asynchronous password work or waiting behind a concurrent intent writer.
      const locked = await tx.pendingGoogleIdentityLink.updateMany({ where: { id: intent.id, consumedAt: null, attempts: { lt: 5 } }, data: { attempts: { increment: 0 } } });
      if (locked.count !== 1) return "restart";
      if (intent.candidateUserId) {
        // Lock the canonical account before evaluating its version/password premise.
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${intent.candidateUserId} FOR UPDATE`;
        const current = await tx.user.findUnique({ where: { id: intent.candidateUserId }, select: { id: true, email: true, updatedAt: true, passwordHash: true, emailVerifiedAt: true } });
        if (!current || current.email !== intent.email || !intent.candidateUpdatedAt || current.updatedAt.getTime() !== intent.candidateUpdatedAt.getTime()) return "restart";
        if (passwordVerified && (current.passwordHash !== candidate?.passwordHash || !current.emailVerifiedAt)) return "restart";
        if (await tx.oAuthIdentity.findUnique({ where: { userId_provider_issuer: { userId: current.id, provider, issuer: identityIssuer[provider] } }, select: { id: true } })) return "restart";
      } else if (await tx.user.findUnique({ where: { email: intent.email }, select: { id: true } })) return "restart";
      const acceptedAt = clock();
      if (intent.expiresAt <= acceptedAt || (!passwordVerified && (!intent.emailProofExpiresAt || intent.emailProofExpiresAt <= acceptedAt))) return "restart";
      const consumed = await tx.pendingGoogleIdentityLink.updateMany({ where: {
        id: intent.id, consumedAt: null, attempts: { lt: 5 }, expiresAt: { gt: acceptedAt, equals: intent.expiresAt },
        candidateUserId: intent.candidateUserId, candidateUpdatedAt: intent.candidateUpdatedAt,
        ...(passwordVerified ? {} : { emailProofHash: intent.emailProofHash, emailProofExpiresAt: { gt: acceptedAt, equals: intent.emailProofExpiresAt! } }),
      }, data: { consumedAt: acceptedAt, emailProofHash: null, emailProofExpiresAt: null } });
      if (consumed.count !== 1) return "restart";
      const userId = intent.candidateUserId ?? (await tx.user.create({ data: { email: intent.email, emailVerifiedAt: acceptedAt }, select: { id: true } })).id;
      await tx.oAuthIdentity.create({ data: { ...subjectKey(provider, intent.subject), userId } });
      return "linked";
    }, { isolationLevel: "Serializable" });
  } catch { return "restart"; }
}
