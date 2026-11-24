import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const ports = vi.hoisted(() => ({
  context: vi.fn(), member: vi.fn(), audit: vi.fn(), notify: vi.fn(), rateLimit: vi.fn(),
}));
vi.mock("@/lib/auth/currentContext", () => ({ currentContext: ports.context }));
vi.mock("@/lib/db", () => ({ prisma: { orgMembership: { findUnique: ports.member }, auditEvent: { create: ports.audit } } }));
vi.mock("@/lib/webhooks/dispatchWebhookEvent", () => ({ dispatchWebhookEvent: ports.notify }));
vi.mock("@/lib/rateLimit", () => ({ checkRateLimit: ports.rateLimit }));
import { POST } from "../route";

const input = { requestedRole: "operator", reason: "Review staging runs" };
const request = (body = input, origin = "https://fixture.test") => new NextRequest("https://fixture.test/api/support/access-request", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.resetAllMocks();
  ports.context.mockResolvedValue({ isAuthenticated: true, organizationId: "workspace-1", sessionUserId: "user-1" });
  ports.member.mockResolvedValue({ role: "read_only", acceptedAt: new Date() });
  ports.audit.mockResolvedValue({ id: "audit-1" });
  ports.rateLimit.mockReturnValue(true);
});

it("returns a reference to the recorded request even if the optional notification fails", async () => {
  ports.notify.mockRejectedValueOnce(new Error("provider_unavailable"));
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  const receipt = await response.json();
  expect(receipt).toEqual({
    ok: true, requested: "operator", referenceId: expect.stringMatching(/^access_[a-f\d-]{36}$/),
    message: "Request recorded. A workspace admin can review it in Members.",
  });
  expect(ports.audit).toHaveBeenCalledExactlyOnceWith({data: expect.objectContaining({
    organizationId: "workspace-1", actorUserId: "user-1", subjectId: "user-1", kind: "access.requested",
    correlationId: receipt.referenceId,
  })});
});

it("withholds confirmation and skips notification when storage cannot confirm the audit record", async () => {
  ports.audit.mockRejectedValueOnce(new Error("database internals"));
  const response = await POST(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ok: false, error: "request_not_recorded"});
  expect(ports.notify).not.toHaveBeenCalled();
});

it("refuses foreign origins and oversized requests before audit or notification", async () => {
  expect((await POST(request(input, "https://outside.test"))).status).toBe(403);
  expect((await POST(request({...input, reason: "x".repeat(4100)}))).status).toBe(400);
  expect(ports.member).not.toHaveBeenCalled();
  expect(ports.audit).not.toHaveBeenCalled();
  expect(ports.notify).not.toHaveBeenCalled();
});
