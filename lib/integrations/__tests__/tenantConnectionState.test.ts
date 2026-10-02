import { describe, expect, it } from "vitest";
import { visibleTenantConnectionStatus } from "../tenantConnectionState";

describe("visibleTenantConnectionStatus", () => {
  it("does not present an unvalidated active record as connected", () => {
    expect(visibleTenantConnectionStatus({ status: "active", lastValidatedAt: null })).toBe("awaiting_validation");
  });

  it("presents active only after a server-side validation timestamp exists", () => {
    expect(visibleTenantConnectionStatus(
      { status: "active", lastValidatedAt: new Date("2026-10-01T00:00:00Z") },
      new Date("2026-10-01T12:00:00Z"),
    )).toBe("active");
  });

  it("requires another live validation after the freshness window expires", () => {
    expect(visibleTenantConnectionStatus(
      { status: "active", lastValidatedAt: new Date("2026-10-01T00:00:00Z") },
      new Date("2026-10-02T00:00:01Z"),
    )).toBe("needs_attention");
  });

  it("fails safely for a missing or unknown record", () => {
    expect(visibleTenantConnectionStatus({ status: undefined, lastValidatedAt: null })).toBe("not_connected");
    expect(visibleTenantConnectionStatus({ status: "anything_else", lastValidatedAt: null })).toBe("not_connected");
  });
});
