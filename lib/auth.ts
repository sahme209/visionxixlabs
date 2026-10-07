import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CognitoProvider from "next-auth/providers/cognito";
import { compare } from "bcryptjs";
import { prisma } from "./db";
import { ensurePersonalWorkspaceMembership } from "./auth/ensurePersonalWorkspaceMembership";
import { checkRateLimit } from "./rateLimit";
import { record as recordAudit } from "./audit/secureAudit";
import { id as idFactory, newCorrelationId } from "./domain/ids";
import { deriveWorkspaceIdFromEmail } from "./auth/workspaceId";
import { createLogger } from "./observability/logger";
import { decodeIdTokenClaims } from "./identity/decodeIdTokenClaims";
import { evaluateSsoSignIn, type SsoSignInRepo } from "./identity/ssoSignInGate";
import { ALL_ORG_ROLES } from "./identity/identityProviderResponder";

const log = createLogger("auth.membershipBootstrap");

// Helper: only register an OAuth provider when its env credentials are
// present. Missing OAuth env shouldn't crash the app — the UI just shows
// the relevant button as disabled.
function buildProviders(): NextAuthOptions["providers"] {
  const providers: NextAuthOptions["providers"] = [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const normalizedEmail = credentials.email.trim().toLowerCase();
        // Login attempts were previously unrate-limited at this layer (the
        // signup route has its own limiter; this credentials callback did
        // not). Keyed by the attempted email, not IP — NextAuth v4's
        // authorize(credentials, req) second parameter has an internal
        // shape this codebase has never relied on elsewhere, and guessing
        // at it here risks a runtime error on every login attempt. Per-email
        // keying still blocks the primary threat (brute-forcing one
        // account's password) without that risk.
        if (!checkRateLimit(`login:${normalizedEmail}`)) return null;
        let user;
        try {
          user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
          if (!user?.passwordHash) return null;
          const valid = await compare(credentials.password, user.passwordHash);
          if (!valid) return null;
        } catch (err) {
          console.error("[NextAuth authorize]", err);
          return null;
        }
        // Workspace membership bootstrap is best-effort, same as the OAuth
        // path above — a transient failure here must not deny a verified
        // password login.
        try {
          await ensurePersonalWorkspaceMembership({ userId: user.id, email: user.email });
        } catch (err) {
          log.error("workspace bootstrap failed (best-effort)", {
            path: "authorize",
            userId: user.id,
            errorMessage: err instanceof Error ? err.message : String(err),
            errorCode: err instanceof Error && "code" in err ? (err as { code?: unknown }).code : undefined,
          });
        }
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ];

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    providers.push(
      GoogleProvider({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    );
  }
  if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
    providers.push(
      GitHubProvider({
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
      })
    );
  }
  // Enterprise identity, phase 2's first real IdP — see
  // docs/ENTERPRISE_IDENTITY_DESIGN.md. This is a single, fixed Cognito
  // user pool today (one "Sign in with Cognito" button), not yet the
  // design doc's per-tenant domain-routed TenantIdentityProvider lookup
  // or fail-closed role mapping — those still require building the
  // TenantIdentityProvider-driven routing on top of this real, working
  // OIDC round-trip. Issuer is the pool's own discovery URL
  // (https://cognito-idp.<region>.amazonaws.com/<poolId>); NextAuth
  // fetches /.well-known/openid-configuration from it automatically.
  if (process.env.COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_SECRET && process.env.COGNITO_ISSUER) {
    providers.push(
      CognitoProvider({
        clientId: process.env.COGNITO_CLIENT_ID,
        clientSecret: process.env.COGNITO_CLIENT_SECRET,
        issuer: process.env.COGNITO_ISSUER,
      })
    );
  }
  return providers;
}

/** Which OAuth providers are configured in this deployment. Exposed so the
 *  sign-in page can disable buttons cleanly rather than fail mid-redirect. */
export const enabledOAuthProviders = {
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  cognito: Boolean(process.env.COGNITO_CLIENT_ID && process.env.COGNITO_CLIENT_SECRET && process.env.COGNITO_ISSUER),
};

/**
 * Record a denied sign-in attempt. Best-effort and tenant-scoped like the
 * success path in events.signIn below — the only difference is outcome and
 * the safe reasonCode, which identifies WHY without exposing whether the
 * underlying account or workspace exists to the (still unauthenticated)
 * caller; this writes to the server-side audit log only, never into the
 * response NextAuth sends back to the browser.
 */
async function recordSignInDenied(input: { email: string; provider: string; reasonCode: string }): Promise<void> {
  try {
    await recordAudit({
      organizationId: deriveWorkspaceIdFromEmail(input.email),
      actorKind: "user",
      action: "auth.failed",
      outcome: "blocked",
      entityRef: `user:${input.email}`,
      correlationId: newCorrelationId(),
      source: "live",
      errorCode: input.reasonCode,
      detail: { provider: input.provider },
    });
  } catch (err) {
    console.error("[NextAuth signIn] denial audit record failed (best-effort):", err);
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: buildProviders(),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  // OAuth must honor the original callback so a newly created identity returns
  // to its short-lived desktop pairing request just like an existing one.
  // A static new-user page would strand the browser outside Axiom Agent.
  pages: { signIn: "/auth/signin" },
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth/OIDC sign-ins (Google/GitHub/Cognito), ensure a User row
      // exists. Credentials provider handled inside its own authorize().
      if (account?.provider === "google" || account?.provider === "github" || account?.provider === "cognito") {
        if (!user.email) {
          // No email, no derivable tenant — nothing to scope an audit
          // record to, and nothing about an account/tenant to leak either
          // way. Console-only.
          console.error(`[NextAuth signIn] ${account.provider} returned no email — denying sign-in.`);
          return false;
        }
        const normalizedEmail = user.email.trim().toLowerCase();

        // Identity is the only thing this callback is allowed to gate on.
        // A failure here means we genuinely cannot establish who this is,
        // so denial is correct.
        let dbUser;
        try {
          dbUser = await prisma.user.upsert({
            where: { email: normalizedEmail },
            create: {
              email: normalizedEmail,
              name: user.name ?? null,
              image: user.image ?? null,
            },
            update: {
              // Axiom account settings own the display name after account
              // creation. Do not silently replace a user-selected name with
              // the OAuth provider's profile value on every sign-in.
              image: user.image ?? undefined,
            },
          });
        } catch (err) {
          console.error("[NextAuth signIn] identity upsert failed:", err);
          await recordSignInDenied({ email: normalizedEmail, provider: account.provider, reasonCode: "identity_store_unavailable" });
          return false;
        }

        // Enterprise identity, phase 2's domain-routing + role-mapping +
        // MFA-claim steps (docs/ENTERPRISE_IDENTITY_DESIGN.md) — only
        // reachable today via the one real IdP connection (Cognito), since
        // Google/GitHub are personal-login providers, not an enterprise
        // tenant's own IdP. A matching TenantIdentityProvider is a hard
        // gate (fail closed on no role mapping / missing required MFA) —
        // everything else below is the existing, unmodified fallback.
        if (account.provider === "cognito" && account.id_token) {
          const claims = decodeIdTokenClaims(account.id_token);
          if (claims) {
            let gate;
            try {
              gate = await evaluateSsoSignIn(prisma as unknown as SsoSignInRepo, { email: normalizedEmail, claims });
            } catch (err) {
              console.error("[NextAuth signIn] SSO provider lookup failed:", err);
              await recordSignInDenied({ email: normalizedEmail, provider: account.provider, reasonCode: "sso.provider_lookup_unavailable" });
              return false;
            }
            if (gate.kind === "denied") {
              await recordSignInDenied({ email: normalizedEmail, provider: account.provider, reasonCode: gate.reason });
              return false;
            }
            if (gate.kind === "matched") {
              // Defense in depth: buildIdentityProviderCreateResponse already
              // validates every rule's role at config time, but this guards
              // against the config table being edited some other way —
              // fail closed rather than hand Prisma a value its OrgRole
              // enum would reject.
              if (!(ALL_ORG_ROLES as readonly string[]).includes(gate.role)) {
                console.error(`[NextAuth signIn] matched SSO role "${gate.role}" is not a valid OrgRole — denying.`);
                await recordSignInDenied({ email: normalizedEmail, provider: account.provider, reasonCode: "sso.role_mapping_invalid" });
                return false;
              }
              const mappedRole = gate.role as (typeof ALL_ORG_ROLES)[number];
              try {
                await prisma.orgMembership.upsert({
                  where: { userId_organizationId: { userId: dbUser.id, organizationId: gate.organizationId } },
                  create: { userId: dbUser.id, organizationId: gate.organizationId, role: mappedRole, acceptedAt: new Date() },
                  update: { role: mappedRole },
                });
              } catch (err) {
                log.error("SSO membership upsert failed", {
                  path: "signIn", userId: dbUser.id, organizationId: gate.organizationId,
                  errorMessage: err instanceof Error ? err.message : String(err),
                });
                await recordSignInDenied({ email: normalizedEmail, provider: account.provider, reasonCode: "sso.membership_store_unavailable" });
                return false;
              }
              return true;
            }
            // gate.kind === "no_match" — this email's domain isn't bound to
            // any tenant's IdP. Falls through to the personal-workspace
            // bootstrap below, same as any other sign-in.
          }
        }

        // Workspace membership bootstrap is a best-effort side effect, NOT
        // a sign-in gate. A transient failure here (e.g. a unique-constraint
        // race between two near-simultaneous sign-in attempts) must never
        // turn a verified identity into an opaque "Access Denied" — that
        // previously denied real users whose identity was fine but whose
        // workspace-bootstrap upsert hit a benign race or blip.
        // currentContext()'s resolveWorkspaceRoles() already handles a
        // missing membership gracefully (fails closed to zero roles, never
        // throws), and /desktop/connect's entitlement banner is the
        // correct place to show "no workspace yet" to an already
        // signed-in user — not a hard sign-in denial.
        try {
          await ensurePersonalWorkspaceMembership({ userId: dbUser.id, email: dbUser.email });
        } catch (err) {
          log.error("workspace bootstrap failed (best-effort)", {
            path: "signIn",
            userId: dbUser.id,
            errorMessage: err instanceof Error ? err.message : String(err),
            errorCode: err instanceof Error && "code" in err ? (err as { code?: unknown }).code : undefined,
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      // OAuth's `user.id` is provider-owned and must never become the
      // platform user id. Resolve the canonical database id by email for
      // every newly authenticated user and for legacy JWTs missing it.
      const email = user?.email ?? token.email;
      if (email && (user || !token.id)) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email: email.trim().toLowerCase() },
            select: { id: true },
          });
          if (dbUser) token.id = dbUser.id;
        } catch (error) {
          console.error("[NextAuth jwt] user id lookup failed:", error);
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) (session.user as { id?: string }).id = token.id as string;
      return session;
    },
  },
  events: {
    // Sign-in is a security-sensitive action with no audit record today —
    // "auth.signin" has existed in the AuditAction taxonomy
    // (lib/audit/secureAudit.ts) and in the audit-intelligence label map
    // for a while, but nothing ever called record() for it. Wired here
    // rather than inside authorize() or the signIn callback: this fires
    // once, only after NextAuth has fully committed to the session, for
    // every provider (credentials, Google, GitHub) in one place, instead
    // of duplicating the call per-provider. Best-effort: audit storage
    // being unavailable must never block an otherwise-successful sign-in.
    async signIn({ user, account }) {
      if (!user.email) return;
      try {
        await recordAudit({
          organizationId: deriveWorkspaceIdFromEmail(user.email),
          actorUserId: user.id ? idFactory.user(user.id) : undefined,
          actorKind: "user",
          action: "auth.signin",
          outcome: "success",
          entityRef: `user:${user.email.trim().toLowerCase()}`,
          correlationId: newCorrelationId(),
          source: "live",
          detail: { provider: account?.provider ?? "unknown" },
        });
      } catch (err) {
        console.error("[NextAuth events.signIn] audit record failed (best-effort):", err);
      }
    },
  },
};
