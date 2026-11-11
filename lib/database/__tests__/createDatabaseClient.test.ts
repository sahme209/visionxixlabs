import { afterEach, expect, it, vi } from "vitest";
import { Socket } from "node:net";
import { createDatabaseClient } from "../createDatabaseClient";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it("missing application configuration stays lazy and refuses without a PG fallback", async () => {
  vi.stubEnv("PGHOST", "ambient.invalid"); vi.stubEnv("PGDATABASE", "ambient");
  const network = vi.spyOn(Socket.prototype, "connect").mockImplementation(() => { throw new Error("unexpected_network_access"); });
  const client = createDatabaseClient(undefined);
  try {
    expect(network).not.toHaveBeenCalled();
    await expect(client.$queryRawUnsafe("SELECT 1")).rejects.toThrow("database_configuration_unavailable");
    expect(network).not.toHaveBeenCalled();
  } finally { await client.$disconnect(); }
});
it("an explicitly configured client does not connect during construction", async () => {
  const network=vi.spyOn(Socket.prototype,"connect").mockImplementation(()=>{throw new Error("unexpected_network_access")});
  const client=createDatabaseClient("postgresql://fixture@127.0.0.1:1/owned_fixture");
  try { expect(network).not.toHaveBeenCalled(); } finally { await client.$disconnect(); }
});
it("rejects an invalid target with a fixed error before constructing a usable client",()=>{
  expect(()=>createDatabaseClient("https://fixture:DO_NOT_LOG@other.invalid/database")).toThrow("postgres_connection_configuration_unavailable");
});
