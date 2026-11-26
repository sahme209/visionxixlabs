import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const m = vi.hoisted(() => ({ load: vi.fn(), argo: vi.fn(), flux: vi.fn() }));
vi.mock("@/lib/integrations/signals/signalConnection", () => ({ loadSignalConnection: m.load }));
vi.mock("@/lib/integrations/argocd/argoCdClient", () => ({ ArgoCdClient: class { listApplications = m.argo; } }));
vi.mock("@/lib/integrations/flux/fluxClient", () => ({ FluxClient: class { listKustomizations = m.flux; } }));
import { executeGitopsStateTool } from "../gitopsObservation";
const principal = { organizationId: "org1", userId: "u1", sessionId: "s1" };
const ctx = () => ({ principal, repo: {
  desktopSessionRecord: { findUnique: vi.fn(async () => ({ id: "s1", userId: "u1", organizationId: "org1", revokedAt: null, expiresAt: new Date(Date.now() + 60_000) })) },
  orgMembership: { findUnique: vi.fn(async () => ({ acceptedAt: new Date(), role: "operator" })) },
} }) as never;
beforeEach(() => { vi.clearAllMocks(); });
describe("read_gitops_state agent tool", () => {
  it("reads connected controllers and tolerates one missing", async () => {
    m.load.mockImplementation(async (_o: string, p: string) => { if (p === "argo_cd") return { settings: { baseUrl: "https://argocd.example.com", project: "team-a" }, secret: { token: "t" } }; throw new Error("flux_not_connected"); });
    m.argo.mockResolvedValue([{ name: "web", sync: "Synced", health: "Healthy" }]);
    const r = await executeGitopsStateTool("org1", {}, ctx());
    expect(r).toMatchObject({ ok: true, result: { kind: "gitops_observation", authority: "observation_only", argoCd: [{ name: "web" }], flux: null } });
  });
  it("says when nothing is connected and refuses arguments or missing pairing", async () => {
    m.load.mockRejectedValue(new Error("not_connected"));
    expect(await executeGitopsStateTool("org1", {}, ctx())).toEqual({ ok: false, error: "gitops_not_connected" });
    expect(await executeGitopsStateTool("org1", { x: 1 }, ctx())).toEqual({ ok: false, error: "invalid_gitops_args" });
    expect(await executeGitopsStateTool("org1", {})).toEqual({ ok: false, error: "paired_gitops_observation_required" });
  });
});
