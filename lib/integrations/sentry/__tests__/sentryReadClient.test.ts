import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { SentryReadClient } from "../sentryReadClient";
afterEach(() => vi.unstubAllGlobals());
describe("Sentry read-only client", () => {
  it("lists unresolved issues first seen in a release with one GET", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
      const u = new URL(url);
      expect(u.origin + u.pathname).toBe("https://sentry.io/api/0/projects/acme/web/issues/");
      expect(u.searchParams.get("query")).toBe('is:unresolved firstRelease:"web@1.4.0"');
      expect(init.method).toBe("GET"); expect(init.redirect).toBe("error"); expect(init.headers.authorization).toBe("Bearer t");
      return Response.json([{ id: "123", shortId: "WEB-1", title: "TypeError: x is undefined", level: "error", count: "42", userCount: 7, firstSeen: "2026-11-26T10:00:00Z", permalink: "https://acme.sentry.io/issues/123/" }, { id: "x", title: "bad" }]);
    }));
    expect(await new SentryReadClient("acme", "web", "t").newIssuesInRelease("web@1.4.0")).toEqual([{ id: "123", shortId: "WEB-1", title: "TypeError: x is undefined", level: "error", count: 42, userCount: 7, firstSeen: "2026-11-26T10:00:00.000Z", url: "https://acme.sentry.io/issues/123/" }]);
    expect(Object.getOwnPropertyNames(SentryReadClient.prototype).filter((m) => m !== "constructor")).toEqual(["newIssuesInRelease"]);
  });
  it("refuses bad scope, release names that could change the query, and failures", async () => {
    expect(() => new SentryReadClient("Acme Org", "web", "t")).toThrow("sentry_scope_invalid");
    await expect(new SentryReadClient("acme", "web", "t").newIssuesInRelease('x" OR is:resolved')).rejects.toThrow("sentry_release_invalid");
    vi.stubGlobal("fetch", vi.fn(async (url: string) => { expect(url.startsWith("https://de.sentry.io/")).toBe(true); return new Response("no", { status: 401 }); }));
    await expect(new SentryReadClient("acme", "web", "t", "de").newIssuesInRelease("1.0")).rejects.toThrow("sentry_api_failed:401");
  });
});
