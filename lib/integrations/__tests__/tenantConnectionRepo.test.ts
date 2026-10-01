import { describe, expect, it } from "vitest";
import {
  consumeTenantIntegrationAuthorization,
  startTenantIntegrationAuthorization,
  type AuthorizationAttemptRow,
  type TenantConnectionRepo,
} from "../tenantConnectionRepo";

function memoryRepo(): TenantConnectionRepo {
  const rows: AuthorizationAttemptRow[] = [];
  return {
    tenantIntegrationAuthorizationAttempt: {
      create: async ({ data }) => {
        const row: AuthorizationAttemptRow = { ...data, id: `attempt-${rows.length + 1}`, consumedAt: null };
        rows.push(row);
        return row;
      },
      findUnique: async ({ where }) => rows.find((row) => row.stateDigest === where.stateDigest) ?? null,
      updateMany: async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id && item.consumedAt === where.consumedAt && item.expiresAt > where.expiresAt.gt);
        if (!row) return { count: 0 };
        row.consumedAt = data.consumedAt;
        return { count: 1 };
      },
    },
  };
}

describe("tenant integration authorization attempts", () => {
  it("consumes a provider return only once", async () => {
    const repo = memoryRepo();
    const start = await startTenantIntegrationAuthorization(repo, {
      organizationId: "org-a", provider: "slack", redirectUri: "https://app.test/callback", initiatedByUserId: "user-a",
      now: new Date("2026-10-01T12:00:00.000Z"),
    });
    const now = new Date("2026-10-01T12:01:00.000Z");
    expect((await consumeTenantIntegrationAuthorization(repo, { state: start.state, provider: "slack", now })).ok).toBe(true);
    await expect(consumeTenantIntegrationAuthorization(repo, { state: start.state, provider: "slack", now }))
      .resolves.toEqual({ ok: false, reason: "consumed" });
  });

  it("does not consume a state under a different provider", async () => {
    const repo = memoryRepo();
    const start = await startTenantIntegrationAuthorization(repo, {
      organizationId: "org-a", provider: "slack", redirectUri: "https://app.test/callback", initiatedByUserId: "user-a",
    });
    await expect(consumeTenantIntegrationAuthorization(repo, { state: start.state, provider: "teams" }))
      .resolves.toEqual({ ok: false, reason: "missing" });
  });
});
