import "server-only";
import { lstatSync, realpathSync } from "node:fs";
import { createConnection } from "node:net";
import { prisma } from "@/lib/db";
import { validatedIsolatedRuntime } from "../isolatedApplication/databaseTarget";
import { ownedCheckoutConfiguration } from "./configuration";
import { clientConversation } from "./conversation";
import { bridgeCommand, type Command, type Result } from "./protocol";
/** Actual Next client: no injectable wire, SDK, credential or provider permit.
 * This channel is accepted only inside the reviewed owned server binding. */
export async function requestOwnedCheckout(command: Command): Promise<Result> {
  try {
    const config = ownedCheckoutConfiguration(), runtime = validatedIsolatedRuntime();
    if (!config || config.databaseUrl !== runtime.target || config.runtimeId !== runtime.runtimeId || config.accountId !== runtime.accountId || runtime.organizations.length !== 1 || runtime.organizations[0] !== config.organizationId) return { kind: "unavailable" };
    bridgeCommand(command, config);
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "IsolatedTestRuntime" WHERE id=$1 AND account=$2', config.runtimeId, config.accountId);
    if (rows.length !== 1) return { kind: "unavailable" };
    const directory = lstatSync(config.directory), path = config.directory + "/worker.sock", socket = lstatSync(path), uid = process.getuid?.();
    if (uid === undefined || !directory.isDirectory() || directory.isSymbolicLink() || realpathSync(config.directory) !== config.directory || (directory.mode & 0o777) !== 0o700 || directory.uid !== uid || !socket.isSocket() || socket.isSymbolicLink() || (socket.mode & 0o777) !== 0o600 || socket.uid !== uid) return { kind: "unavailable" };
    return await clientConversation(config, createConnection({ path }), command);
  } catch { return { kind: "unavailable" }; }
}
