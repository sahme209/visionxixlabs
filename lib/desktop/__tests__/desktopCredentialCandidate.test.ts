import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopClient } from "../../../desktop/src/lib/desktopClient";
afterEach(() => vi.unstubAllGlobals());
describe("non-mutating recovery credential verification", () => {
  it("sends only the candidate bearer and preserves the active configuration", async () => {
    const client = new DesktopClient({ apiBase: "https://service.example.test", sessionToken: "axm.desk.previous" });
    const config = client.config;
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: false, error: "revoked" }), { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await client.verifyCredentialCandidate("vxlk_candidate")).toMatchObject({ ok: false });
    expect(fetchMock).toHaveBeenCalledWith("https://service.example.test/api/desktop/access", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer vxlk_candidate" }) }));
    expect(client.config).toBe(config);
    expect(client.config.sessionToken).toBe("axm.desk.previous");
  });
  it("does not send the existing credential when the candidate is missing or unsupported", async () => {
    const client = new DesktopClient({ sessionToken: "axm.desk.previous" });
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    expect(await client.verifyCredentialCandidate(undefined)).toMatchObject({ ok: false });
    expect(await client.verifyCredentialCandidate("unsupported")).toMatchObject({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(client.config.sessionToken).toBe("axm.desk.previous");
  });
});
