import { afterEach, expect, it, vi } from "vitest";
import { Socket } from "node:net";
import { PrismaClient } from "@/lib/prismaClient";

afterEach(() => vi.restoreAllMocks());

it("keeps generated-client construction lazy and refuses an unconfigured adapter before network access", async () => {
  const network = vi.spyOn(Socket.prototype, "connect").mockImplementation(() => { throw new Error("unexpected_network_access"); });
  const connect = vi.fn(async () => { throw new Error("unconfigured_database"); });
  const client = new PrismaClient({ adapter: { provider: "postgres", adapterName: "axiom-unconfigured-test", connect } });
  try {
    expect(connect).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    await expect(client.$queryRawUnsafe("SELECT 1")).rejects.toThrow("unconfigured_database");
    expect(connect).toHaveBeenCalledTimes(1);
    expect(network).not.toHaveBeenCalled();
  } finally { await client.$disconnect(); }
});
