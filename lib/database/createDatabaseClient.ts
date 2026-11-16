import { newDatabaseRuntimeTrace } from "./databaseRuntimeTrace.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../prismaClient.ts";
import { connectRemotePublicScope } from "./remotePublicScope.ts";
import { directNeonSessionOptions, needsRemotePublicScope } from "./directNeonSession.ts";
import { postgresConnectionOptions } from "./postgresConnectionPolicy.ts";

/** Construction is lazy configuration, never authorization or resource custody.
 * Callers own disconnection and must retain their existing scope/marker checks. */
export function createDatabaseClient(target: string | undefined): PrismaClient {
  if (target === undefined || target === "") {
    const trace = newDatabaseRuntimeTrace();
    trace.observe("unconfigured");
    const client = new PrismaClient({ adapter: {
      provider: "postgres", adapterName: "axiom-unconfigured-database",
      async connect() { throw new Error("database_configuration_unavailable"); },
    } });
    trace.register(client);
    return client;
  }
  const options = postgresConnectionOptions(target);
  const trace = newDatabaseRuntimeTrace({
    tlsVerificationConfigured: options.ssl !== false && options.ssl.rejectUnauthorized === true,
    channelBindingRequired: options.requireChannelBinding === true,
  });
  const config = directNeonSessionOptions(options, trace.observe);
  const driver = needsRemotePublicScope(options) ? null : new PrismaPg(config, { schema: "public" });
  // Expose only the query adapter contract, never migration/shadow-DB methods.
  const client = new PrismaClient({ adapter: {
    provider: "postgres", adapterName: driver?.adapterName ?? "@prisma/adapter-pg",
    connect: () => driver ? driver.connect() : connectRemotePublicScope(config),
  } });
  trace.register(client);
  return client;
}
