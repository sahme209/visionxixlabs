import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ results: vi.fn(async () => [] as unknown[]), read: vi.fn(), load: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { deploymentCheckResult: { findMany: m.results } } }));
vi.mock("@/lib/integrations/signals/signalConnection", () => ({ loadSignalConnection: m.load }));
vi.mock("@/lib/integrations/signals/releaseSignals", () => ({ readReleaseSignals: m.read }));
import { executeReleaseHealthTool } from "../releaseHealthObservation";

const principal = { organizationId: "org1", userId: "u1", sessionId: "s1" };
const ctx = (over: { revoked?: boolean } = {}) => ({ principal, repo: {
  desktopSessionRecord: { findUnique: vi.fn(async () => ({ id: "s1", userId: "u1", organizationId: "org1", revokedAt: over.revoked ? new Date() : null, expiresAt: new Date(Date.now() + 60_000) })) },
  orgMembership: { findUnique: vi.fn(async () => ({ acceptedAt: new Date(), role: "read_only" })) },
} }) as never;
beforeEach(() => { vi.clearAllMocks(); m.read.mockResolvedValue({ release: "web@1", incidents: { pagerduty: null, opsgenie: null }, newIssues: null, monitors: null, staleFlags: null, unavailable: [], verification: { verdict: "no_signals", reasons: [], missing: [] } }); });

describe("read_release_health agent tool", () => {
  it("reads release signals for a paired, current member, read-only", async () => {
    const r = await executeReleaseHealthTool("org1", { release: "web@1", commit: "A".repeat(40) }, ctx());
    expect(r).toMatchObject({ ok: true, result: { kind: "release_health", authority: "observation_only", release: "web@1" } });
    expect(m.results.mock.calls[0][0].where).toEqual({ organizationId: "org1", releaseRef: "a".repeat(40), stage: "verify" });
  });
  it("refuses without pairing, with bad arguments, or when authority lapses", async () => {
    expect(await executeReleaseHealthTool("org1", { release: "x" })).toEqual({ ok: false, error: "paired_release_health_required" });
    expect(await executeReleaseHealthTool("org1", { release: 'x" OR' }, ctx())).toEqual({ ok: false, error: "invalid_release_health_args" });
    expect(await executeReleaseHealthTool("org1", { release: "x", extra: 1 }, ctx())).toEqual({ ok: false, error: "invalid_release_health_args" });
    expect(await executeReleaseHealthTool("org1", { release: "x" }, ctx({ revoked: true }))).toEqual({ ok: false, error: "release_health_unavailable" });
    expect(m.read).not.toHaveBeenCalled();
  });
});
