import { describe, expect, it } from "vitest";
import {
  authorizationCredentialContext,
  connectionCredentialContext,
  createAuthorizationState,
  digestAuthorizationState,
  isTenantIntegrationProvider,
} from "../tenantAuthorization";

describe("tenant integration authorization state", () => {
  it("creates a digest instead of persisting the bearer state", () => {
    const created = createAuthorizationState({
      now: new Date("2026-10-01T12:00:00.000Z"),
      random: () => Buffer.alloc(32, 7),
    });
    expect(created.state).not.toContain(created.stateDigest);
    expect(digestAuthorizationState(created.state)).toBe(created.stateDigest);
    expect(created.expiresAt.toISOString()).toBe("2026-10-01T12:10:00.000Z");
  });

  it("uses different authenticated-encryption contexts for each tenant and provider", () => {
    const digest = "a".repeat(64);
    expect(authorizationCredentialContext({ organizationId: "org-a", provider: "slack", stateDigest: digest }))
      .not.toBe(authorizationCredentialContext({ organizationId: "org-b", provider: "slack", stateDigest: digest }));
    expect(connectionCredentialContext({ organizationId: "org-a", provider: "slack", connectionId: "connection-a" }))
      .not.toBe(connectionCredentialContext({ organizationId: "org-a", provider: "teams", connectionId: "connection-a" }));
  });

  it("keeps the provider vocabulary closed", () => {
    expect(isTenantIntegrationProvider("slack")).toBe(true);
    expect(isTenantIntegrationProvider("teams")).toBe(true);
    expect(isTenantIntegrationProvider("github")).toBe(true);
    expect(isTenantIntegrationProvider("linear")).toBe(true);
  });
});
