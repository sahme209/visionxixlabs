import { describe, expect, it } from "vitest";
import { hasRequiredScopes, splitGrantedScopes } from "../grantedScopes";

describe("granted OAuth scopes", () => {
  it("normalizes Slack's comma-delimited scope response", () => {
    expect(splitGrantedScopes("channels:read,chat:write")).toEqual(["channels:read", "chat:write"]);
  });

  it("normalizes Microsoft space-delimited scopes", () => {
    expect(splitGrantedScopes("openid offline_access User.Read")).toEqual(["openid", "offline_access", "User.Read"]);
  });

  it("rejects a partial grant", () => {
    expect(hasRequiredScopes(["channels:read"], ["channels:read", "chat:write"])).toBe(false);
  });
});
