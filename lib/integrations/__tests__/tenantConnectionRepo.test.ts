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

  it("consumes a GitHub installation return only once", async () => {
    const repo = memoryRepo();
    const start = await startTenantIntegrationAuthorization(repo, {
      organizationId: "org-a", provider: "github", redirectUri: "https://app.test/callback", initiatedByUserId: "user-a",
    });
    expect((await consumeTenantIntegrationAuthorization(repo, { state: start.state, provider: "github" })).ok).toBe(true);
    await expect(consumeTenantIntegrationAuthorization(repo, { state: start.state, provider: "github" }))
      .resolves.toEqual({ ok: false, reason: "consumed" });
  });
});
it.each(['organizationId','initiatedByUserId','redirectUri'] as const)('checks expected %s before claiming a setup challenge',async(field)=>{
 const repo=memoryRepo();const expected={organizationId:'org-a',initiatedByUserId:'user-a',redirectUri:'https://app.test/manifest-callback'};
 const start=await startTenantIntegrationAuthorization(repo,{...expected,provider:'github'});
 expect((await consumeTenantIntegrationAuthorization(repo,{state:start.state,provider:'github',expected:{...expected,[field]:'wrong'}})).ok).toBe(false);
 expect((await consumeTenantIntegrationAuthorization(repo,{state:start.state,provider:'github',expected})).ok).toBe(true);
 expect((await consumeTenantIntegrationAuthorization(repo,{state:start.state,provider:'github',expected})).ok).toBe(false);
});
it('allows only one concurrent claim of a bound setup challenge',async()=>{
 const repo=memoryRepo();const expected={organizationId:'org-a',initiatedByUserId:'user-a',redirectUri:'https://app.test/manifest-callback'};
 const start=await startTenantIntegrationAuthorization(repo,{...expected,provider:'github'});
 const results=await Promise.all([1,2].map(()=>consumeTenantIntegrationAuthorization(repo,{state:start.state,provider:'github',expected})));
 expect(results.filter(r=>r.ok)).toHaveLength(1);
});
it('rejects an expired setup challenge',async()=>{
 const repo=memoryRepo();const expected={organizationId:'org-a',initiatedByUserId:'user-a',redirectUri:'https://app.test/manifest-callback'};
 const start=await startTenantIntegrationAuthorization(repo,{...expected,provider:'github',now:new Date('2026-10-22T10:00:00Z')});
 expect(await consumeTenantIntegrationAuthorization(repo,{state:start.state,provider:'github',expected,now:new Date('2026-10-22T12:00:00Z')})).toEqual({ok:false,reason:'expired'});
});
