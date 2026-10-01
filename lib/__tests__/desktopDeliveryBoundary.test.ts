import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "../../proxy";

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

function request(path: string, init?: NextRequestInit): NextRequest {
  return new NextRequest(new URL(path, "https://example.test"), init);
}

describe("desktop-only website boundary", () => {
  it.each(["/dashboard", "/dashboard/command-center", "/operator", "/operator/onboarding"])(
    "redirects browser operations route %s to the download page",
    (path) => {
      const response = proxy(request(path));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        `https://example.test/download?from=${encodeURIComponent(path)}`,
      );
    },
  );

  it("allows direct browser sign-in without exposing the web workspace", () => {
    const response = proxy(request("/auth/signin"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("keeps direct browser signup bound to the installed-app pairing flow", () => {
    const response = proxy(request("/auth/signup"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.test/download?from=%2Fauth%2Fsignup",
    );
  });

  it("allows a sign-in page only for an installed-app return path", () => {
    const response = proxy(request("/auth/signin?callbackUrl=/desktop/pair"));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not treat an external callback URL as an installed-app flow", () => {
    const response = proxy(
      request("/auth/signin?callbackUrl=https://attacker.example/desktop/pair"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.test/download?from=%2Fauth%2Fsignin",
    );
  });
});
