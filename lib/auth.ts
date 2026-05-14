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
          const user = await prisma.user.findUnique({ where: { email: credentials.email } });
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
  pages: { signIn: "/auth/signin", newUser: "/dashboard" },
  callbacks: {
    async signIn({ user, account }) {
      // For OAuth sign-ins (Google/GitHub), ensure a User row exists.
      // Credentials provider handled inside its own authorize().
      if (account?.provider === "google" || account?.provider === "github") {
        if (!user.email) return false;
        try {
          await prisma.user.upsert({
            where: { email: user.email },
            create: {
              email: user.email,
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
      if (user) {
        token.id = (user as { id?: string }).id ?? token.id;
        // Persist the database-backed id once we have it.
        if (!token.id && user.email) {
          try {
            const dbUser = await prisma.user.findUnique({ where: { email: user.email }, select: { id: true } });
            if (dbUser) token.id = dbUser.id;
          } catch {
            // Don't break sign-in if the lookup fails — id resolution
            // happens on the first authenticated request anyway.
          }
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
