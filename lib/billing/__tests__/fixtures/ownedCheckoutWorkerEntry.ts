/** Dedicated synthetic worker entry. Built/launched ONLY by the reviewed owned
 * supervisor after a separate runtime grant; never imported by Next routes. */
import { createServer, type Socket } from "node:net";
import { chmodSync, lstatSync, realpathSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ownedCheckoutConfiguration } from "../../ownedCheckoutBridge/configuration";
import { createOwnedCheckoutOperations } from "../../ownedCheckoutBridge/operations";
import { serveConversation } from "../../ownedCheckoutBridge/conversation";
import { createNewTestSubscriptionService } from "../../newTestSubscription/service";
import { postgresFixtureStore } from "../../newTestSubscription/postgresFixtureStore";
import { ownedSyntheticPriceMap, ownedSyntheticProvider } from "./ownedCheckoutSyntheticProvider";
let initialized = false;
process.on("uncaughtException", () => process.exit(70)); process.on("unhandledRejection", () => process.exit(70));
const bootstrapTimer = setTimeout(() => process.exit(70), 10000);
process.once("message", async input => {
  let phase = "bootstrap";
  try {
    if (initialized || !process.send || process.env.AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME !== undefined || ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"].some(k => Object.prototype.hasOwnProperty.call(process.env, k))) throw new Error("refuse"); initialized = true;
    const message = input as { kind?: unknown; parentPid?: unknown; mode?: unknown; env?: unknown };
    if (message.kind !== "owned_checkout_bootstrap_v1" || message.parentPid !== process.ppid || message.mode !== "synthetic_only" || !message.env || typeof message.env !== "object" || Array.isArray(message.env) || Object.keys(message).sort().join("|") !== ["kind", "parentPid", "mode", "env"].sort().join("|")) throw new Error("refuse");
    const config = ownedCheckoutConfiguration(message.env as Record<string, string | undefined>); if (!config || config.accountId !== "acct-test") throw new Error("refuse");
    const dir = lstatSync(config.directory); if (!dir.isDirectory() || dir.isSymbolicLink() || realpathSync(config.directory) !== config.directory || (dir.mode & 0o777) !== 0o700 || dir.uid !== process.getuid?.()) throw new Error("refuse");
    phase = "store";
    const db = new PrismaClient({ datasources: { db: { url: config.databaseUrl } } }), store = postgresFixtureStore(config.databaseUrl, config.runtimeId, config.accountId);
    const service = createNewTestSubscriptionService({ store, provider: ownedSyntheticProvider(store, config), configuredPrices: ownedSyntheticPriceMap(config), now: () => Date.now(), id: () => randomBytes(16).toString("hex"), digest: text => createHash("sha256").update(text).digest("hex") });
    const execute = createOwnedCheckoutOperations({ manifest: config, store, service, actor: async userId => {
      const actor = await db.user.findUnique({ where: { id: userId }, select: { email: true, emailVerifiedAt: true } });
      if (!actor?.email || !actor.emailVerifiedAt) return null;
      return { email: actor.email, seatQuantity: await store.transaction(tx => tx.acceptedSeats(config.organizationId)) };
    } });
    if ((await execute({ kind: "hello" })).kind !== "ready") throw new Error("refuse");
    phase = "listener";
    const sockets = new Set<Socket>();
    const server = createServer(socket => {
      sockets.add(socket); socket.once("close", () => sockets.delete(socket));
      void serveConversation(config, socket, execute, command => {
        const token = randomBytes(16).toString("hex"), duration = command.kind === "checkout" ? 90000 : command.kind === "reconcile" ? 45000 : 10000;
        process.send?.({ kind: "owned_operation_started", token, duration });
        const timer = setTimeout(() => process.kill(process.pid, "SIGKILL"), duration);
        return () => { clearTimeout(timer); process.send?.({ kind: "owned_operation_finished", token }); };
      });
    });
    server.maxConnections = 2; server.on("error", () => process.exit(70));
    server.listen(config.directory + "/worker.sock", () => { chmodSync(config.directory + "/worker.sock", 0o600); clearTimeout(bootstrapTimer); process.send?.({ kind: "owned_worker_ready", session: config.session, pid: process.pid }); });
    let stopping = false;
    const shutdown = async () => { if (stopping) return; stopping = true; server.close(); for (const socket of sockets) socket.destroy(); await Promise.allSettled([db.$disconnect(), store.disconnect()]); process.exit(0); };
    process.once("SIGTERM", () => { void shutdown(); }); process.once("disconnect", () => { void shutdown(); });
  } catch { process.send?.({ kind: "owned_worker_refused", phase }); process.exit(70); }
});
