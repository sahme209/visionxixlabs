import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { compare } from "bcryptjs";
import { prisma } from "./db";
import { ensurePersonalWorkspaceMembership } from "./auth/ensurePersonalWorkspaceMembership";
import { checkRateLimit } from "./rateLimit";
import { record as recordAudit } from "./audit/secureAudit";
import { id as idFactory, newCorrelationId } from "./domain/ids";
import { deriveWorkspaceIdFromEmail } from "./auth/workspaceId";

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
        try {
          const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
          if (!user?.passwordHash) return null;
          const valid = await compare(credentials.password, user.passwordHash);
          if (!valid) return null;
          await ensurePersonalWorkspaceMembership({ userId: user.id, email: user.email });
          return { id: user.id, email: user.email, name: user.name, image: user.image };
        } catch (err) {
          console.error("[NextAuth authorize]", err);
          return null;
        }
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
  return providers;
}

/** Which OAuth providers are configured in this deployment. Exposed so the
 *  sign-in page can disable buttons cleanly rather than fail mid-redirect. */
export const enabledOAuthProviders = {
  google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  github: Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
};

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
      // For OAuth sign-ins (Google/GitHub), ensure a User row exists.
      // Credentials provider handled inside its own authorize().
      if (account?.provider === "google" || account?.provider === "github") {
        if (!user.email) return false;
        try {
          const dbUser = await prisma.user.upsert({
            where: { email: user.email.trim().toLowerCase() },
            create: {
              email: user.email.trim().toLowerCase(),
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
          await ensurePersonalWorkspaceMembership({ userId: dbUser.id, email: dbUser.email });
        } catch (err) {
          console.error("[NextAuth signIn] upsert failed:", err);
          return false;
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
