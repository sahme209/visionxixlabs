import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ context: vi.fn(), extract: vi.fn() }));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: mocks.context }));
vi.mock("@/lib/cloud/gcp/gcpLiveInventory", () => ({ extractGcpLiveInventory: mocks.extract }));
import { GET, POST } from "../route";
beforeEach(() => {
    vi.resetAllMocks();
    mocks.context.mockResolvedValue({ isAuthenticated: true, organizationId: "other-tenant", userId: "reader" });
    mocks.extract.mockResolvedValue({ mode: "live", projectId: "host-private-project", counts: { instanceCount: 91, bucketCount: 82, firewallRuleCount: 73 }, publicBucketCount: 64, allOpenFirewallCount: 55, durationMs: 1, limitations: [] });
});
it.each([GET, POST])("withholds host inventory for authenticated tenant requests", async handler => {
    const response = await handler(new NextRequest("https://axiom.test/api/cloud/gcp-inventory"));
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, data: { mode: "blocked", counts: { instanceCount: 0, bucketCount: 0, firewallRuleCount: 0 }, publicBucketCount: 0, allOpenFirewallCount: 0 } });
    expect(body.data.projectId).toBeUndefined();
    expect(body.data.limitations.join(" ")).toContain("tenant_connection_required");
    expect(JSON.stringify(body)).not.toContain("host-private-project");
    expect(mocks.extract).not.toHaveBeenCalled();
});
it("preserves unauthenticated refusal without host extraction", async () => {
    mocks.context.mockResolvedValue({ isAuthenticated: false });
    const response = await GET(new NextRequest("https://axiom.test/api/cloud/gcp-inventory"));
    expect((await response.json()).ok).toBe(false);
    expect(mocks.extract).not.toHaveBeenCalled();
});
