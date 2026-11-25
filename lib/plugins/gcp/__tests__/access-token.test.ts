import { beforeEach, describe, expect, it, vi } from "vitest";

const { getAccessToken, sdk } = vi.hoisted(() => ({ getAccessToken: vi.fn(), sdk: { shape: "v8" as "v8" | "v9" | "none" } }));
vi.mock("@google-cloud/storage", () => ({
  Storage: class {
    constructor() {
      if (sdk.shape === "v8") Object.assign(this, { authClient: { getAccessToken } });
      if (sdk.shape === "v9") Object.assign(this, { storageTransport: { authClient: { getAccessToken } } });
    }
  },
}));

import { getGcpAccessToken } from "../snapshot-generator";

const credentials = { client_email: "fixture@example.invalid", private_key: "fixture-not-a-key" };
beforeEach(() => {
  getAccessToken.mockReset();
  sdk.shape = "v8";
});

describe("GCP snapshot access-token contract", () => {
  it("accepts the GoogleAuth string result without expecting a token object", async () => {
    getAccessToken.mockResolvedValue("fixture-access-token");
    await expect(getGcpAccessToken(credentials)).resolves.toBe("fixture-access-token");
    expect(getAccessToken).toHaveBeenCalledOnce();
  });

  it("reads the storage 9 transport auth client", async () => {
    sdk.shape = "v9";
    getAccessToken.mockResolvedValue("fixture-access-token");
    await expect(getGcpAccessToken(credentials)).resolves.toBe("fixture-access-token");
  });

  it("refuses when the SDK exposes no auth client", async () => {
    sdk.shape = "none";
    await expect(getGcpAccessToken(credentials)).rejects.toThrow("Failed to get access token");
    expect(getAccessToken).not.toHaveBeenCalled();
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
