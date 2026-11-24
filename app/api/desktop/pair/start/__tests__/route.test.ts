import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ prisma: { desktopPairingChallengeRecord: { create } } }));

import { POST } from "../route";

beforeEach(() => create.mockReset().mockResolvedValue({}));
afterEach(() => vi.unstubAllEnvs());

function request() {
  return new NextRequest("http://localhost:3000/api/desktop/pair/start", {
    method: "POST",
    headers: { "Content-Type": "application/json", host: "127.0.0.1:3000" },
    body: JSON.stringify({
      deviceFingerprint: "synthetic-fixture-device",
      deviceLabel: "V19 fixture",
      platform: "macos-arm",
      intent: "sign_in",
    }),
  });
}

it.each(["http://127.0.0.1:3000", "https://visionxixlabs.com/api/auth"])(
  "binds the browser link to the configured auth origin for %s",
  async configuredOrigin => {
    vi.stubEnv("NEXTAUTH_URL", configuredOrigin);
    const response = await POST(request());
    expect(response.status).toBe(201);
    const result = await response.json();
    const verification = new URL(result.verificationUrl);
    expect(verification.origin).toBe(new URL(configuredOrigin).origin);
    expect(verification.pathname).toBe("/desktop/connect");
    expect(verification.searchParams.get("challenge")).toBe(result.challenge);
    expect(verification.searchParams.get("intent")).toBe("sign_in");
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: result.challenge, deviceFingerprint: "synthetic-fixture-device" }),
    }));
  },
);

it("refuses a malformed auth origin before creating pairing state", async () => {
  vi.stubEnv("NEXTAUTH_URL", "http://outside.example.invalid");
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(create).not.toHaveBeenCalled();
});
