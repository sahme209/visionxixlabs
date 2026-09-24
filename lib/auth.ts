import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { compare } from "bcryptjs";
import { prisma } from "./db";

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
        try {
          const user = await prisma.user.findUnique({ where: { email: credentials.email.trim().toLowerCase() } });
          if (!user?.passwordHash) return null;
          const valid = await compare(credentials.password, user.passwordHash);
          if (!valid) return null;
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
  pages: { signIn: "/auth/signin", newUser: "/auth/success" },
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth sign-ins (Google/GitHub), ensure a User row exists.
      // Credentials provider handled inside its own authorize().
      if (account?.provider === "google" || account?.provider === "github") {
        if (!user.email) return false;
        try {
          await prisma.user.upsert({
            where: { email: user.email.trim().toLowerCase() },
            create: {
              email: user.email.trim().toLowerCase(),
              name: user.name ?? null,
              image: user.image ?? null,
            },
            update: {
              name: user.name ?? undefined,
              image: user.image ?? undefined,
            },
          });
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
};
