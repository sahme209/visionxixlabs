import { describe, expect, it } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

import { proxy as routeProxy } from "../../proxy";

// Only GET/HEAD / is asynchronous (it reads the session token); these paths return synchronously.
const proxy = (input: NextRequest) => routeProxy(input) as NextResponse;

type NextRequestInit = ConstructorParameters<typeof NextRequest>[1];

function request(path: string, init?: NextRequestInit): NextRequest {
  return new NextRequest(new URL(path, "https://example.test"), init);
}

describe("desktop-only website boundary", () => {
  it("migrates the legacy dashboard landing into the authenticated cockpit", () => {
    expect(proxy(request("/dashboard")).headers.get("location")).toBe("https://example.test/control");
  });
  it.each(["/dashboard/command-center", "/dashboard/releases/release-1", "/operator", "/operator/onboarding"])(
    "redirects browser operations route %s to the download page",
    (path) => {
      const response = proxy(request(path));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        `https://example.test/download?from=${encodeURIComponent(path)}`,
      );
    },
  );

  it("allows the read-only release companion", () => {
    const response = proxy(request("/control/releases/release-1"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-request-x-axiom-cockpit-path")).toBe("/control/releases/release-1");
  });

  it("allows direct browser sign-in without exposing the web workspace", () => {
    const response = proxy(request("/auth/signin"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows the browser-only GitHub consent companion without exposing dashboard operations", () => {
    const response = proxy(request("/connect/github"));

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
