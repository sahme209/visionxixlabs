import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAccessToken } = vi.hoisted(() => ({ getAccessToken: vi.fn() }));
vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    authClient = { getAccessToken };
  },
}));

import { getGcpAccessToken } from "../snapshot-generator";

const credentials = { client_email: "fixture@example.invalid", private_key: "fixture-not-a-key" };
beforeEach(() => {
  getAccessToken.mockReset();
});

describe("GCP snapshot access-token contract", () => {
  it("accepts the GoogleAuth string result without expecting a token object", async () => {
    getAccessToken.mockResolvedValue("fixture-access-token");
    await expect(getGcpAccessToken(credentials)).resolves.toBe("fixture-access-token");
    expect(getAccessToken).toHaveBeenCalledOnce();
  });

  it.each([null, undefined, "", "  ", { token: "fixture-object" }])("rejects a missing or malformed token %#", async (result) => {
    getAccessToken.mockResolvedValue(result);
    await expect(getGcpAccessToken(credentials)).rejects.toThrow("Failed to get access token");
  });

  it("propagates credential failure without attempting a provider fallback", async () => {
    getAccessToken.mockRejectedValue(new Error("fixture credential unavailable"));
    await expect(getGcpAccessToken(credentials)).rejects.toThrow("fixture credential unavailable");
    expect(getAccessToken).toHaveBeenCalledOnce();
  });
});
