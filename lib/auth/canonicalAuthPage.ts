import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { canonicalAuthOrigin, canonicalAuthPageUrl, isCanonicalAuthHost } from "./canonicalAuthOrigin";

export async function ensureCanonicalAuthPage(page: "signin" | "signup", params: Record<string, string | string[] | undefined>) {
  const origin = canonicalAuthOrigin(process.env.NEXTAUTH_URL);
  const host = (await headers()).get("host");
  if (!origin || !host) throw new Error("Authentication configuration unavailable");
  // Host is used only for comparison. The destination comes exclusively from
  // server configuration; forwarded headers never choose a redirect target.
  if (!isCanonicalAuthHost(host, origin)) {
    redirect(canonicalAuthPageUrl(origin, page, params));
  }
}
