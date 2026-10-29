import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mock = vi.hoisted(() => ({ session: vi.fn(), load: vi.fn(), tasks: vi.fn() }));
vi.mock("@/lib/desktop/resolveRequestDesktopSession", () => ({ resolveRequestDesktopSession: mock.session }));
vi.mock("@/lib/integrations/airflow/connection", () => ({ loadAirflowClient: mock.load }));
import { GET } from "../route";
const context = { params: Promise.resolve({ dagId: "daily", runId: "run" }) };
beforeEach(() => { vi.resetAllMocks(); mock.session.mockResolvedValue({ organizationId: "org-A" }); mock.load.mockResolvedValue({ client: { listTaskInstances: mock.tasks } }); mock.tasks.mockResolvedValue({ tasks: [], totalEntries: 0, offset: 0 }); });
it("requires paired read authority before loading any credentials", async () => {
 mock.session.mockResolvedValue(null);
 expect((await GET(new NextRequest("https://fixture.test/tasks"), context)).status).toBe(401);
 expect(mock.load).not.toHaveBeenCalled();
 expect(mock.session).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requiredScope: "pipeline:read", requiredCapability: "workspace:read", allowApiKey: false }));
});
it("loads only the authenticated organization's connection", async () => {
 const result = await GET(new NextRequest("https://fixture.test/tasks?offset=100&organizationId=org-B"), context);
 expect(result.status).toBe(200); expect(mock.load).toHaveBeenCalledWith("org-A"); expect(mock.tasks).toHaveBeenCalledWith("daily", "run", 100);
});
it.each(["-1", "NaN", "1.5", "9007199254740992"])("rejects invalid pagination %s before loading credentials", async (offset) => {
 expect((await GET(new NextRequest(`https://fixture.test/tasks?offset=${offset}`), context)).status).toBe(400); expect(mock.load).not.toHaveBeenCalled();
});
it("does not echo provider or credential errors", async () => {
 mock.load.mockRejectedValue(new Error("sensitive-provider-payload"));
 const response = await GET(new NextRequest("https://fixture.test/tasks"), context);
 expect(response.status).toBe(502); expect(await response.text()).not.toContain("sensitive");
});
