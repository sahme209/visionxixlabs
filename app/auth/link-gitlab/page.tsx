import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canonicalAuthOrigin, isCanonicalAuthHost } from "@/lib/auth/canonicalAuthOrigin";
import GoogleLinkClient from "../link-google/GoogleLinkClient";
export const dynamic = "force-dynamic";
export default async function GitLabLinkPage() {
  const origin = canonicalAuthOrigin(process.env.NEXTAUTH_URL);
  if (!origin) return <main className="min-h-screen bg-[#111] p-8 text-zinc-100">Sign-in is temporarily unavailable. Please try again later.</main>;
  if (!isCanonicalAuthHost((await headers()).get("host"), origin)) redirect(`${origin}/auth/link-gitlab`);
  return <GoogleLinkClient provider="gitlab" />;
}
