import { describe, expect, it } from "vitest";
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
