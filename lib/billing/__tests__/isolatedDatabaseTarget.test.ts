import { afterEach, describe, expect, it, vi } from "vitest";
const spy = vi.hoisted(() => ({ construct: vi.fn(), marker: vi.fn(), hook: undefined as undefined | ((input: { args: unknown; query: (args: unknown) => Promise<unknown> }) => Promise<unknown>) }));
vi.mock("@prisma/client", () => ({ PrismaClient: class { constructor(options?: unknown) { spy.construct(options); } $extends(extension: any) { spy.hook = extension.query.$allOperations; return this; } $queryRawUnsafe(...args: unknown[]) { return spy.marker(...args); } } }));
function config(target: string) { vi.stubEnv("AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME", "true"); vi.stubEnv("DATABASE_URL", target); vi.stubEnv("DIRECT_URL", ""); vi.stubEnv("AXIOM_ISOLATED_TEST_RUNTIME_ID", "runtime"); vi.stubEnv("AXIOM_ISOLATED_TEST_ACCOUNT_ID", "acct"); vi.stubEnv("AXIOM_ISOLATED_TEST_ORGANIZATIONS", "synthetic"); vi.stubEnv("VERCEL", ""); vi.stubEnv("VERCEL_ENV", ""); }
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); spy.construct.mockClear(); spy.marker.mockReset(); spy.hook = undefined; });
describe("actual ambient database constructor is guarded before use", () => {
  it.each(["postgresql://synthetic@remote.invalid/axiom_new_test_contract_rehearsal", "postgresql://synthetic@127.0.0.1/production", "postgresql://synthetic@localhost/axiom_new_test_contract_rehearsal", "postgresql://synthetic@127.0.0.1/axiom_new_test_contract_rehearsal?schema=public"])("rejects disallowed target before constructor %s", async target => {
    config(target); await expect(import("../../db")).rejects.toThrow("isolated_database_required"); expect(spy.construct).not.toHaveBeenCalled();
  });
  it("rejects mismatched direct target rather than inheriting another database", async () => {
    config("postgresql://synthetic@127.0.0.1/axiom_new_test_contract_rehearsal"); vi.stubEnv("DIRECT_URL", "postgresql://synthetic@remote.invalid/production");
    await expect(import("../../db")).rejects.toThrow("isolated_database_binding_mismatch"); expect(spy.construct).not.toHaveBeenCalled();
  });
  it("binds constructor explicitly to the validated isolated URL", async () => {
    const target = "postgresql://synthetic@127.0.0.1/axiom_new_test_contract_rehearsal"; config(target);
    await import("../../db"); expect(spy.construct).toHaveBeenCalledWith({ datasources: { db: { url: target } } });
  });
  it("checks actual runtime marker before allowing the first model query", async () => {
    config("postgresql://synthetic@127.0.0.1/axiom_new_test_contract_rehearsal"); await import("../../db");
    const query = vi.fn(async () => "private row"); spy.marker.mockResolvedValue([]);
    expect(spy.hook).toBeTypeOf("function");
    await expect(spy.hook!({ args: {}, query })).rejects.toThrow("isolated_runtime_binding_unavailable");
    expect(query).not.toHaveBeenCalled();
  });

});
