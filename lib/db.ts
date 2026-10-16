import { isolatedRuntimeRequested } from "./billing/isolatedApplication/runtime";
import { validatedIsolatedRuntime } from "./billing/isolatedApplication/databaseTarget";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
const isolated = isolatedRuntimeRequested() ? validatedIsolatedRuntime() : null;
function isolatedClient(config: NonNullable<typeof isolated>): PrismaClient {
  const base = new PrismaClient({ datasources: { db: { url: config.target } } });
  // Verify actual storage identity before even authentication/bootstrap queries.
  // Query the unextended fixed-target client to avoid recursive interception.
  return base.$extends({ name: "owned-isolated-runtime", query: {
    async $allOperations({ args, query }) {
      const marker = await base.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "IsolatedTestRuntime" WHERE id=$1 AND account=$2', config.runtimeId, config.accountId);
      if (marker.length !== 1) throw new Error("isolated_runtime_binding_unavailable");
      return query(args);
    },
  } }) as unknown as PrismaClient;
}
export const prisma = isolated ? isolatedClient(isolated) : globalForPrisma.prisma ?? new PrismaClient();
if (!isolated && process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
