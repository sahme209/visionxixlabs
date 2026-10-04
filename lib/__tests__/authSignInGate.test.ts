/**
 * Locks in the identity/workspace-bootstrap split in lib/auth.ts.
 *
 * Root cause this guards against: ensurePersonalWorkspaceMembership used
 * to run INSIDE the same try/catch that gated sign-in, so a transient
 * failure there (DB blip, unique-constraint race) denied a verified
 * identity outright, surfacing NextAuth's generic "Access Denied — you do
 * not have permission to sign in" page to a real user. Identity
 * verification (provider returned an email; the User row upsert
 * succeeded) must be the only thing that gates sign-in; workspace
 * bootstrap is best-effort and must never deny a verified identity.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureAuditStore, type AuditRecord, type SecureAuditStore } from "@/lib/audit/secureAudit";

const mocks = vi.hoisted(() => ({
  upsertUser: vi.fn(),
  ensureMembership: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { user: { upsert: mocks.upsertUser, findUnique: vi.fn() } } }));
vi.mock("@/lib/auth/ensurePersonalWorkspaceMembership", () => ({
  ensurePersonalWorkspaceMembership: mocks.ensureMembership,
}));

class MemoryAuditStore implements SecureAuditStore {
  records: AuditRecord[] = [];
  async append(record: AuditRecord): Promise<void> {
    this.records.push(record);
  }
  async query(): Promise<AuditRecord[]> {
    return this.records;
  }
}

describe("OAuth signIn callback — identity vs. workspace-bootstrap split", () => {
  let store: MemoryAuditStore;

  beforeEach(() => {
    vi.clearAllMocks();
    store = new MemoryAuditStore();
    configureAuditStore(store);
    mocks.upsertUser.mockResolvedValue({ id: "user-1", email: "pilot@example.test" });
  });

  it("allows sign-in when identity resolves but workspace bootstrap fails", async () => {
    mocks.ensureMembership.mockRejectedValue(new Error("unique constraint race"));
    const { authOptions } = await import("@/lib/auth");
    const result = await authOptions.callbacks!.signIn!({
      user: { email: "pilot@example.test" },
      account: { provider: "google" },
    } as never);
    expect(result).toBe(true);
    expect(mocks.upsertUser).toHaveBeenCalled();
    expect(mocks.ensureMembership).toHaveBeenCalled();
    // Not a denial — no auth.failed record should exist for this attempt.
    expect(store.records.some((r) => r.action === "auth.failed")).toBe(false);
  });

  it("denies sign-in when the identity store itself fails, with a safe reason code and correlation id", async () => {
    mocks.upsertUser.mockRejectedValue(new Error("connection refused"));
    const { authOptions } = await import("@/lib/auth");
    const result = await authOptions.callbacks!.signIn!({
      user: { email: "pilot@example.test" },
      account: { provider: "google" },
    } as never);
    expect(result).toBe(false);
    expect(mocks.ensureMembership).not.toHaveBeenCalled();
    const denial = store.records.find((r) => r.action === "auth.failed");
    expect(denial).toBeDefined();
    expect(denial?.outcome).toBe("blocked");
    expect(denial?.errorCode).toBe("identity_store_unavailable");
    expect(denial?.correlationId).toBeTruthy();
    // Safe: identifies why, not whether the account/tenant already existed.
    expect(JSON.stringify(denial)).not.toMatch(/exists|found|unknown user/i);
  });

  it("denies sign-in safely when the OAuth provider returns no email, without writing an unscoped audit record", async () => {
    const { authOptions } = await import("@/lib/auth");
    const result = await authOptions.callbacks!.signIn!({
      user: { email: undefined },
      account: { provider: "github" },
    } as never);
    expect(result).toBe(false);
    expect(mocks.upsertUser).not.toHaveBeenCalled();
    expect(mocks.ensureMembership).not.toHaveBeenCalled();
    // No derivable tenant — nothing to scope an audit record to.
    expect(store.records).toHaveLength(0);
  });
});
