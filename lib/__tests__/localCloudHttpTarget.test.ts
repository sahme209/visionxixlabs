import { describe, expect, it, vi } from "vitest";
import { rehearseLocalCloudHttp } from "../../scripts/rehearse-local-cloud-http.mjs";
describe("parent-only cloud HTTP fixture boundary", () => {
  it.each(["postgresql://fixture@public.invalid/axiom_auth_http_aaaaaaaaaaaa", "postgresql://fixture@127.0.0.1:5432/production", "postgresql://fixture@127.0.0.1:5432/axiom_auth_http_aaaaaaaaaaaa?schema=public"])("refuses an unowned target before database or HTTP IO", async databaseUrl => {
    const query = vi.fn(); const request = vi.fn();
    await expect(rehearseLocalCloudHttp({ databaseUrl, client: { $queryRawUnsafe: query }, deviceRequest: request, token: "", organizationId: "", userId: "", fixture: {}, encryptionSecret: "" })).rejects.toThrow("isolated_cloud_http_target_required");
    expect(query).not.toHaveBeenCalled(); expect(request).not.toHaveBeenCalled();
  });
});
