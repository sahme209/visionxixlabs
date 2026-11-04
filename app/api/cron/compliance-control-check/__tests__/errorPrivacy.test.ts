import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const m = vi.hoisted(() => ({ env: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/config/env", () => ({ loadAppEnv: m.env }));
vi.mock("@/lib/db", () => ({ prisma: { complianceControlCheckRun: { createMany: m.create } } }));
import { GET, POST } from "../route";
const marker = "SYNTHETIC_PRIVATE_CONTROL_DB_DIAGNOSTIC";
const safe = "The control-check results could not be confirmed. Inspect current results before requesting another check.";
beforeEach(() => { vi.resetAllMocks(); m.env.mockReturnValue({ cronSecret: "synthetic-cron" }); m.create.mockResolvedValue({ count: 1 }); });
for (const [method, handler] of [["GET", GET], ["POST", POST]] as const) {
 const request = (auth = "Bearer synthetic-cron") => new NextRequest("http://localhost/synthetic", { method, headers: { authorization: auth } });
 it(method + " redacts persistence Error and attempts persistence only once", async () => {
   m.create.mockRejectedValue(new Error(marker)); const response = await handler(request()); const body = await response.json();
   expect(response.status).toBe(500); expect(JSON.stringify(body)).not.toContain(marker);
   expect(body).toEqual({ ok: false, reason: "persist_failed", detail: safe }); expect(m.create).toHaveBeenCalledTimes(1);
   expect(m.create).toHaveBeenCalledWith({ data: [expect.objectContaining({ controlId: "cs.vault.encryption", status: "fail", detail: expect.any(String) })] });
 });
 it(method + " retains non-Error fallback", async () => { m.create.mockRejectedValue(marker); const response = await handler(request()); expect(response.status).toBe(500); expect(await response.json()).toEqual({ ok: false, reason: "persist_failed", detail: "unknown" }); expect(m.create).toHaveBeenCalledTimes(1); });
 it(method + " retains success shape and persisted results", async () => { const response = await handler(request()); const body = await response.json(); expect(response.status).toBe(200); expect(body).toEqual({ ok: true, data: { checked: 1, results: [{ controlId: "cs.vault.encryption", status: "fail", detail: "Neither CREDENTIAL_ENCRYPTION_KEY nor STARTER_TOKEN_SECRET is set." }] } }); expect(m.create).toHaveBeenCalledWith({ data: body.data.results }); });
 it(method + " retains fail-closed cron guards before persistence", async () => { m.env.mockReturnValue({ cronSecret: undefined }); const unset = await handler(request()); expect(unset.status).toBe(503); expect(await unset.json()).toEqual({ ok: false, reason: "cron_not_configured", detail: "CRON_SECRET is not set." }); m.env.mockReturnValue({ cronSecret: "synthetic-cron" }); const denied = await handler(request("Bearer wrong")); expect(denied.status).toBe(401); expect(await denied.json()).toEqual({ ok: false, reason: "cron_unauthorized" }); expect(m.create).not.toHaveBeenCalled(); });
}
