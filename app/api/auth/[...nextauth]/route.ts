import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

async function withEnvCheck(
  req: Request,
  ctx: { params: Promise<{ nextauth: string[] }> }
) {
  const secret = process.env.NEXTAUTH_SECRET;
  const url = process.env.NEXTAUTH_URL;

  if (!secret || String(secret).trim() === "") {
    return Response.json(
      { error: "NEXTAUTH_SECRET is not set. Add it in Vercel → Settings → Environment Variables. Generate with: openssl rand -base64 32" },
      { status: 503 }
    );
  }
  if (!url || String(url).trim() === "") {
    return Response.json(
      { error: "NEXTAUTH_URL is not set. Add it in Vercel (e.g. https://visionxixlabs.com)" },
      { status: 503 }
    );
  }
  try {
    return await handler(req, ctx as Parameters<typeof handler>[1]);
  } catch (err) {
    console.error("[NextAuth]", err);
    return Response.json(
      { error: "Auth error. Check Vercel logs and ensure NEXTAUTH_SECRET, NEXTAUTH_URL are correct." },
      { status: 503 }
    );
  }
}

export const GET = withEnvCheck;
export const POST = withEnvCheck;
