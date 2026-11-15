import { prisma } from "@/lib/db";
import { canonicalAuthOrigin, isCanonicalAuthHost } from "@/lib/auth/canonicalAuthOrigin";
import { activeGoogleLink, confirmGoogleLink, sendGoogleLinkCode, validGoogleLinkCsrf } from "@/lib/auth/googleIdentity";
import { googleLinkCookie, googleLinkCookieValue, googleLinkCsrf, hashGoogleLinkProof } from "@/lib/auth/googleLinkContext";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
function reply(body: object, status = 200, cookie?: string) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...(cookie ? { "Set-Cookie": cookie } : {}) } });
}
function canonicalRequest(req: Request) {
  const origin = canonicalAuthOrigin(process.env.NEXTAUTH_URL);
  return origin && isCanonicalAuthHost(req.headers.get("host"), origin) ? origin : null;
}
async function bodyOf(req: Request): Promise<Record<string, unknown> | null> {
  if (!req.headers.get("content-type")?.startsWith("application/json")) return null;
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.length;
      if (size > 4096) { await reader.cancel(); return null; }
      chunks.push(item.value);
    }
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch { return null; }
}
export async function GET(req: Request) {
  const origin = canonicalRequest(req);
  if (!origin) return reply({ error: "restart_google_signin" }, 409);
  const nonce = googleLinkCookieValue(req.headers.get("cookie"), new URL(origin).protocol === "https:");
  if (!nonce) return reply({ error: "restart_google_signin" }, 409);
  try {
    const intent = await activeGoogleLink(prisma, nonce);
    if (!intent) return reply({ error: "restart_google_signin" }, 409);
    return reply({ csrf: googleLinkCsrf(nonce, intent.id), email: intent.email });
  } catch { return reply({ error: "google_link_unavailable" }, 503); }
}
export async function POST(req: Request) {
  const origin = canonicalRequest(req);
  if (!origin || req.headers.get("origin") !== origin) return reply({ error: "restart_google_signin" }, 403);
  const nonce = googleLinkCookieValue(req.headers.get("cookie"), new URL(origin).protocol === "https:");
  const body = await bodyOf(req);
  if (!nonce || !body || (body.action !== "send_code" && body.action !== "confirm")) return reply({ error: "restart_google_signin" }, 400);
  const ip = (req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "unknown").slice(0, 128);
  if (!checkRateLimit(`google-link:browser:${hashGoogleLinkProof(nonce)}`) || !checkRateLimit(`google-link:ip:${ip}`)) return reply({ error: "wait_and_retry" }, 429);
  try {
    const intent = await activeGoogleLink(prisma, nonce);
    if (!intent || !validGoogleLinkCsrf(intent, nonce, body.csrf)) return reply({ error: "restart_google_signin" }, 409);
    if (!checkRateLimit(`google-link:email:${intent.email}`)) return reply({ error: "wait_and_retry" }, 429);
    if (body.action === "send_code") {
      const result = await sendGoogleLinkCode(prisma, intent);
      return reply({ result }, result === "delivery_unavailable" ? 503 : 200);
    }
    const result = await confirmGoogleLink(prisma, intent, { password: body.password, code: body.code });
    if (result !== "linked") return reply({ result }, result === "restart" ? 409 : 400);
    return reply({ result, callbackUrl: intent.callbackPath }, 200, googleLinkCookie("", new URL(origin).protocol === "https:", 0));
  } catch { return reply({ error: "google_link_unavailable" }, 503); }
}
