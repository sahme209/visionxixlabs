/** Test harness only. No import starts a build/child/socket. Separate runtime
 * permission + reviewed exact closure are required before calling start(). */
import { fork } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, symlinkSync, rmSync, lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { newTestPrismaEnvironment } from "./newTestChildEnvironment";
import { ownedCheckoutLaunchPolicy } from "./ownedCheckoutLaunchPolicy";
import { ownedCheckoutChild, ownedCheckoutControl } from "./ownedCheckoutProcess";
import { assertSyntheticSupervisor, buildOwnedWorker, verifyOwnedBytes, verifyOwnedOutputTree } from "./ownedCheckoutWorkerBundle";
export type OwnedWorkerReview = Parameters<typeof buildOwnedWorker>[1];
export async function startOwnedCheckoutWorker(input: { db: PrismaClient; databaseUrl: string; runtimeId: string; organizationId: string; origin: string; reviewed: OwnedWorkerReview; control?: ReturnType<typeof ownedCheckoutControl> }) {
  assertSyntheticSupervisor(process.env); const policy = ownedCheckoutLaunchPolicy(process.env, process.execArgv); newTestPrismaEnvironment(process.env, process.execArgv, input.databaseUrl);
  const control = input.control ?? ownedCheckoutControl();
  let rows: Array<{ id: string }>;
  try { rows = await control.run(() => input.db.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "IsolatedTestRuntime" WHERE id=$1 AND account=$2', input.runtimeId, "acct-test")); }
  catch { if (!input.control) control.dispose(); throw new Error("owned_checkout_supervisor_scope_required"); }
  if (rows.length !== 1) { if (!input.control) control.dispose(); throw new Error("owned_checkout_supervisor_scope_required"); }
  const directory = "/tmp/axiom-owned-checkout-" + randomBytes(16).toString("hex"), session = randomBytes(16).toString("hex"), capability = randomBytes(32).toString("hex");
  try { mkdirSync(directory, { mode: 0o700 }); } catch { if (!input.control) control.dispose(); throw new Error("owned_checkout_supervisor_scope_required"); }
  const bridgeEnv = { NODE_ENV: "development" as const, AXIOM_OWNED_CHECKOUT_BRIDGE: "v1", AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "true", DATABASE_URL: input.databaseUrl, DIRECT_URL: input.databaseUrl, NEXTAUTH_URL: input.origin, AXIOM_ISOLATED_TEST_RUNTIME_ID: input.runtimeId, AXIOM_ISOLATED_TEST_ACCOUNT_ID: "acct-test", AXIOM_ISOLATED_TEST_ORGANIZATIONS: input.organizationId, AXIOM_OWNED_CHECKOUT_DIRECTORY: directory, AXIOM_OWNED_CHECKOUT_SESSION: session, AXIOM_OWNED_CHECKOUT_CAPABILITY: capability };
  let processOwner: ReturnType<typeof ownedCheckoutChild> | undefined, stopPromise: Promise<void> | undefined;
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const stop = () => {
    if (stopPromise) return stopPromise;
    stopPromise = (async () => {
      for (const timer of timers.values()) clearTimeout(timer); timers.clear();
      await processOwner?.stop(); // Failure/unknown retains the directory and ledger.
      const dir = lstatSync(directory); if (!dir.isDirectory() || dir.isSymbolicLink() || realpathSync(directory) !== directory || dir.uid !== process.getuid?.() || (dir.mode & 0o777) !== 0o700) throw new Error("owned_checkout_cleanup_refused");
      rmSync(directory, { recursive: true, force: true });
    })().finally(() => { control.signal.removeEventListener("abort", abort); if (!input.control) control.dispose(); });
    return stopPromise;
  };
  const abort = () => { queueMicrotask(() => { void stop().catch(() => {}); }); }; control.signal.addEventListener("abort", abort, { once: true });
  try {
    const build = await control.run(() => buildOwnedWorker(directory, input.reviewed));
    const root = resolve(new URL("../../../../", import.meta.url).pathname);
    verifyOwnedBytes(build.receipt, Object.fromEntries(build.receipt.sources.map(r => [r.path, readFileSync(resolve(root, r.path), "utf8")])), Object.fromEntries(build.receipt.outputs.map(r => [r.path, readFileSync(resolve(build.output, r.path), "utf8")])));
    verifyOwnedOutputTree(build.output, build.receipt.outputs); control.check();
    mkdirSync(resolve(directory, "node_modules"), { mode: 0o700 });
    for (const graph of input.reviewed.externalGraphs) { const parts = graph.name.split("/"); if (parts.length === 2) mkdirSync(resolve(directory, "node_modules", parts[0]), { mode: 0o700, recursive: true }); symlinkSync(graph.directory, resolve(directory, "node_modules", graph.name)); }
    policy.revalidate(process.env); policy.revalidate(policy.env); control.check();
    const env = { ...policy.env, AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null", AWS_EC2_METADATA_DISABLED: "true" };
    processOwner = ownedCheckoutChild("worker", directory, () => fork(build.entry, [], { env, detached: true, execArgv: ["--conditions=react-server"], stdio: ["ignore", "pipe", "pipe", "ipc"] }), control);
    const child = processOwner.child; await control.run(() => processOwner!.ready); if (!child) throw new Error("unavailable");
    let outputBytes = 0; const discard = (chunk: Buffer) => { outputBytes += chunk.byteLength; if (outputBytes > 8192) control.cancel(new Error("owned_checkout_worker_output_limit")); };
    child.stdout?.on("data", discard); child.stderr?.on("data", discard);
    child.on("disconnect", () => { if (!stopPromise) control.cancel(new Error("owned_checkout_worker_disconnected")); });
    await control.run(() => new Promise<void>((ready) => {
      const deadline = setTimeout(() => control.cancel(new Error("owned_checkout_worker_start_unavailable")), 12000);
      control.signal.addEventListener("abort", () => clearTimeout(deadline), { once: true });
      let isReady = false;
      child.on("message", value => {
        const m = value as { kind?: unknown; token?: unknown; duration?: unknown; session?: unknown; pid?: unknown };
        if (!isReady && m.kind === "owned_worker_ready" && m.session === session && m.pid === child.pid) { clearTimeout(deadline); isReady = true; ready(); }
        else if (isReady && m.kind === "owned_operation_started" && typeof m.token === "string" && /^[a-f0-9]{32}$/.test(m.token) && [10000, 45000, 90000].includes(Number(m.duration)) && !timers.has(m.token) && timers.size < 2) timers.set(m.token, setTimeout(() => control.cancel(new Error("owned_checkout_worker_operation_deadline")), Number(m.duration) + 100));
        else if (isReady && m.kind === "owned_operation_finished" && typeof m.token === "string" && timers.has(m.token)) { clearTimeout(timers.get(m.token)); timers.delete(m.token); }
        else control.cancel(new Error("owned_checkout_worker_protocol_failed"));
      });
      child.send({ kind: "owned_checkout_bootstrap_v1", parentPid: process.pid, mode: "synthetic_only", env: bridgeEnv }, error => { if (error) control.cancel(new Error("owned_checkout_worker_send_failed")); });
    }));
    return { bridgeEnv, buildReceipt: build.receipt, outputDigest: build.outputDigest, stop };
  } catch { await stop(); throw new Error("owned_checkout_worker_start_unavailable"); }
}
