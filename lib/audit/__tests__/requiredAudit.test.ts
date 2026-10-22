import { afterEach, expect, it, vi } from "vitest";
const io = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ prisma: { secureAuditRecord: { create: io.create } } }));
import { configureAuditStore, record } from "../secureAudit";
import { recordRequiredAudit } from "../requiredAudit";
import { id } from "@/lib/domain/ids";
afterEach(() => { vi.resetAllMocks(); vi.restoreAllMocks(); configureAuditStore(null); });
const input = { organizationId: id.organization("local-org"), actorUserId: id.user("local-user"), action: "policy.update" as const, correlationId: id.correlation("local-correlation"), detail: { token: "test-secret-value", enabled: false, nested: { safe: "retained" } } };
it("persists a redacted tenant-and-actor-bound event without an instrumentation-configured store", async () => {
  configureAuditStore(null); io.create.mockResolvedValue({});
  await recordRequiredAudit(input);
  expect(io.create).toHaveBeenCalledWith({ data: expect.objectContaining({ organizationId: "local-org", actorUserId: "local-user", actorKind: "user", action: "policy.update", correlationId: "local-correlation", detail: expect.objectContaining({ enabled: false }) }) });
  expect(JSON.stringify(io.create.mock.calls)).not.toContain("test-secret-value");
  expect(JSON.stringify(io.create.mock.calls)).toContain("retained");
});
it("propagates persistence failure instead of claiming an audit was recorded", async () => {
  const failure = Error("private storage diagnostic"); io.create.mockRejectedValue(failure);
  await expect(recordRequiredAudit(input)).rejects.toBe(failure);
  expect(io.create).toHaveBeenCalledOnce();
});
it("uses distinct event identifiers for concurrent required records", async () => {
  io.create.mockResolvedValue({}); await Promise.all([recordRequiredAudit(input), recordRequiredAudit(input)]);
  const ids = io.create.mock.calls.map(([args]) => args.data.id);
  expect(new Set(ids).size).toBe(2);
});

it("preserves the unrelated best-effort writer's existing failure semantics", async () => {
  const append = vi.fn().mockRejectedValue(Error("legacy append outage"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  configureAuditStore({ append, query: vi.fn() });
  await expect(record(input)).resolves.toBeUndefined();
  expect(append).toHaveBeenCalledOnce();
  expect(log).toHaveBeenCalledOnce();
});
