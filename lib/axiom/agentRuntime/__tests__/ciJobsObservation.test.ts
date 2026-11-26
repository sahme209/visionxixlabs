import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ load: vi.fn(), list: vi.fn() }));
vi.mock("@/lib/integrations/signals/signalConnection", () => ({ loadSignalConnection: m.load }));
vi.mock("@/lib/integrations/jenkins/jenkinsReadClient", () => ({ JenkinsReadClient: class { listJobs = m.list; } }));
import { executeCiJobsTool } from "../ciJobsObservation";
const ctx = () => ({ principal: { organizationId: "org1", userId: "u1", sessionId: "s1" }, repo: {
  desktopSessionRecord: { findUnique: vi.fn(async () => ({ id: "s1", userId: "u1", organizationId: "org1", revokedAt: null, expiresAt: new Date(Date.now() + 60_000) })) },
  orgMembership: { findUnique: vi.fn(async () => ({ acceptedAt: new Date(), role: "read_only" })) },
} }) as never;
beforeEach(() => vi.clearAllMocks());
describe("read_ci_jobs agent tool", () => {
  it("lists failing jobs first from the connected Jenkins", async () => {
    m.load.mockResolvedValue({ settings: { baseUrl: "https://ci.example.com", user: "bot" }, secret: { token: "t" } });
    m.list.mockResolvedValue([{ name: "ok", lastBuild: { number: 1, result: "SUCCESS", at: null } }, { name: "bad", lastBuild: { number: 2, result: "FAILURE", at: null } }]);
    const r = await executeCiJobsTool("org1", {}, ctx());
    expect(r).toMatchObject({ ok: true, result: { kind: "ci_jobs_observation", failingCount: 1, jobs: [{ name: "bad" }, { name: "ok" }] } });
  });
  it("says when Jenkins is not connected and refuses bad calls", async () => {
    m.load.mockRejectedValue(new Error("jenkins_not_connected"));
    expect(await executeCiJobsTool("org1", {}, ctx())).toEqual({ ok: false, error: "jenkins_not_connected" });
    expect(await executeCiJobsTool("org1", { a: 1 }, ctx())).toEqual({ ok: false, error: "invalid_ci_jobs_args" });
    expect(await executeCiJobsTool("org1", {})).toEqual({ ok: false, error: "paired_ci_observation_required" });
  });
});
