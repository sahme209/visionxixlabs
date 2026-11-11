import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prismaClient";
import { postgresConnectionOptions } from "./postgresConnectionPolicy";

/** Construction is lazy configuration, never authorization or resource custody.
 * Callers own disconnection and must retain their existing scope/marker checks. */
export function createDatabaseClient(target: string | undefined): PrismaClient {
  if (target === undefined || target === "") {
    return new PrismaClient({ adapter: {
      provider: "postgres", adapterName: "axiom-unconfigured-database",
      async connect() { throw new Error("database_configuration_unavailable"); },
    } });
  }
  const driver = new PrismaPg(postgresConnectionOptions(target), { schema: "public" });
  // Expose only the query adapter contract, never migration/shadow-DB methods.
  return new PrismaClient({ adapter: {
    provider: "postgres", adapterName: driver.adapterName,
    connect: () => driver.connect(),
  } });
}
