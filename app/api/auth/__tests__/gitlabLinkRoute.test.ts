import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GITLAB_ISSUER } from "@/lib/auth/googleIdentityClaims";
import { googleLinkCookie, googleLinkCsrf, hashGoogleLinkProof } from "@/lib/auth/googleLinkContext";
import { GET, POST } from "../gitlab-link/route";
import { GET as getGoogleLink } from "../google-link/route";

const m = vi.hoisted(() => ({ enabled: { gitlab: false }, find: vi.fn(), limit: vi.fn() }));
vi.mock("@/lib/auth", () => ({ enabledOAuthProviders: m.enabled }));
vi.mock("@/lib/db", () => ({ prisma: { pendingGoogleIdentityLink: { findUnique: m.find } } }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: m.limit }));

const origin = "https://canonical.invalid";
const nonce = "a".repeat(43);
const csrf = googleLinkCsrf(nonce, "gitlab-intent");
function request({ method = "GET", requestOrigin = origin, proof = csrf } = {}) {
  return new Request(`${origin}/api/auth/gitlab-link`, {
    method,
    headers: {
      host: "canonical.invalid",
      origin: requestOrigin,
      cookie: googleLinkCookie(nonce, true).split(";")[0],
      "content-type": "application/json",
    },
    body: method === "POST" ? JSON.stringify({ action: "confirm", csrf: proof }) : undefined,
  });
}
beforeEach(() => {
  vi.stubEnv("NEXTAUTH_URL", origin);
  m.enabled.gitlab = true;
  m.limit.mockReturnValue(true);
  m.find.mockReset().mockResolvedValue({
    id: "gitlab-intent", issuer: GITLAB_ISSUER, email: "fixture@example.test",
    csrfHash: hashGoogleLinkProof(csrf), consumedAt: null, attempts: 0,
    expiresAt: new Date(Date.now() + 60_000),
  });
});
afterEach(() => vi.unstubAllEnvs());

it("exposes only the GitLab confirmation and refuses that same browser proof on the Google route", async () => {
  const response = await GET(request());
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ csrf, email: "fixture@example.test" });
  expect((await getGoogleLink(request())).status).toBe(409);
});

it("refuses cross-origin and mismatched browser proofs before linking", async () => {
  expect((await POST(request({ method: "POST", requestOrigin: "https://other.invalid" }))).status).toBe(403);
  expect(m.find).not.toHaveBeenCalled();
  expect((await POST(request({ method: "POST", proof: googleLinkCsrf(nonce, "other-intent") }))).status).toBe(409);
});

it("does not look up an intent when GitLab sign-in is unavailable", async () => {
  m.enabled.gitlab = false;
  expect((await GET(request())).status).toBe(503);
  expect((await POST(request({ method: "POST" }))).status).toBe(503);
  expect(m.find).not.toHaveBeenCalled();
});
