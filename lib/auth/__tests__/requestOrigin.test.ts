import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { isSameOriginRequest } from "../requestOrigin";

function request(origin: string | null) {
  return new NextRequest("https://visionxixlabs.com/api/account/profile", {
    method: "PUT",
    headers: origin ? { origin } : {},
  });
}

describe("same-origin companion mutations", () => {
  it("accepts a browser request from the current Axiom origin", () => {
    expect(isSameOriginRequest(request("https://visionxixlabs.com"))).toBe(true);
  });

  it("rejects a cross-site request even when it targets an Axiom endpoint", () => {
    expect(isSameOriginRequest(request("https://attacker.example"))).toBe(false);
  });

  it("rejects a request that does not establish a browser origin", () => {
    expect(isSameOriginRequest(request(null))).toBe(false);
  });
});


afterEach(() => vi.unstubAllEnvs());

it("accepts an exact configured loopback origin when Next normalizes the request host", () => {
  vi.stubEnv("NEXTAUTH_URL", "http://127.0.0.1:49000");
  const local = new NextRequest("http://127.0.0.1:49000/api/dashboard/gitlab-connection", {
    method: "POST", headers: {origin: "http://127.0.0.1:49000", host: "127.0.0.1:49000"},
  });
  expect(local.nextUrl.hostname).toBe("localhost");
  expect(isSameOriginRequest(local)).toBe(true);
});

it.each([
  ["http://127.0.0.1:49001", "127.0.0.1:49000"],
  ["http://127.0.0.1:49000", "foreign.test:49000"],
  ["https://127.0.0.1:49000", "127.0.0.1:49000"],
])("refuses an origin or host mismatch for a configured loopback request", (origin, host) => {
  vi.stubEnv("NEXTAUTH_URL", "http://127.0.0.1:49000");
  const local = new NextRequest("http://localhost:49000/api/dashboard/gitlab-connection", {method: "POST", headers: {origin, host}});
  expect(isSameOriginRequest(local)).toBe(false);
});
