import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ session: vi.fn(), results: vi.fn(), load: vi.fn(), read: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { deploymentCheckResult: { findMany: m.results } } }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: m.session }));
vi.mock("@/lib/integrations/signals/signalConnection", () => ({ loadSignalConnection: m.load }));
vi.mock("@/lib/integrations/signals/releaseSignals", () => ({ readReleaseSignals: m.read }));
import { GET } from "../route";
const call = (q: string) => GET(new NextRequest(`https://x.test/api/desktop/releases/signals?${q}`));
beforeEach(() => { vi.clearAllMocks(); m.session.mockResolvedValue({ organizationId: "org1" }); m.read.mockImplementation(async (load: (p: string) => unknown, input: unknown) => { await load("sentry"); return { input }; }); });
describe("GET /api/desktop/releases/signals", () => {
  it("reads signals for the release with the latest Verify results for the commit, scoped to the workspace", async () => {
    const sha = "A".repeat(40);
    m.results.mockResolvedValue([{ checkKey: "smoke", status: "failed" }, { checkKey: "smoke", status: "passed" }, { checkKey: "health", status: "passed" }]);
    const body = await (await call(`release=web@1.4.0&commit=${sha}`)).json();
    expect(m.results.mock.calls[0][0].where).toEqual({ organizationId: "org1", releaseRef: sha.toLowerCase(), stage: "verify" });
    expect(body.data.input).toMatchObject({ release: "web@1.4.0", verifyChecks: [{ key: "smoke", status: "failed" }, { key: "health", status: "passed" }] });
    expect(m.load).toHaveBeenCalledWith("org1", "sentry");
  });
  it("requires a session and a safe release name", async () => {
    expect((await call('release=x" OR 1')).status).toBe(400);
    expect((await call("release=1.0&commit=abc")).status).toBe(400);
    m.session.mockResolvedValueOnce(null);
    expect((await call("release=1.0")).status).toBe(401);
  });
});
