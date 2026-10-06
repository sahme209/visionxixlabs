/**
 * Locks in: real tenant identifiers (Azure subscriptionId, GCP projectId,
 * and related account/tenant/org id fields) in a cloud-discovery payload
 * must never reach the AI prompt built for the architecture-analysis
 * feature. redactTenantIdentifiers() strips by key name, not by value
 * pattern, since these are plain strings/GUIDs with no distinguishing
 * shape a regex could safely redact against.
 */

import { describe, expect, it } from "vitest";
import { redactTenantIdentifiers } from "../architectureAnalyzer";

describe("redactTenantIdentifiers", () => {
  it("redacts known tenant-identifier keys regardless of casing, at any depth", () => {
    const input = {
      provider: "azure",
      subscriptionId: "11111111-2222-3333-4444-555555555555",
      resources: [
        { type: "vm", ProjectId: "my-gcp-project-123", name: "web-1" },
        { type: "bucket", accountId: "123456789012", tenantID: "abc-tenant" },
      ],
      nested: { organizationId: "org_real_id", safeField: "keep-me" },
    };

    const redacted = redactTenantIdentifiers(input) as typeof input & { nested: Record<string, unknown> };

    expect(redacted.subscriptionId).toBe("[REDACTED]");
    expect((redacted.resources[0] as Record<string, unknown>).ProjectId).toBe("[REDACTED]");
    expect((redacted.resources[1] as Record<string, unknown>).accountId).toBe("[REDACTED]");
    expect((redacted.resources[1] as Record<string, unknown>).tenantID).toBe("[REDACTED]");
    expect(redacted.nested.organizationId).toBe("[REDACTED]");
    // Unrelated fields pass through untouched.
    expect(redacted.resources[0].name).toBe("web-1");
    expect(redacted.nested.safeField).toBe("keep-me");
    expect(redacted.provider).toBe("azure");
  });

  it("passes through non-object values and handles null/undefined safely", () => {
    expect(redactTenantIdentifiers("no data")).toBe("no data");
    expect(redactTenantIdentifiers(null)).toBeNull();
    expect(redactTenantIdentifiers(undefined)).toBeUndefined();
    expect(redactTenantIdentifiers(42)).toBe(42);
  });
});
