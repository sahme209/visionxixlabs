/** Test harness only. No import starts a build/child/socket. Separate runtime
 * permission + reviewed exact closure are required before calling start(). */
import { fork, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, symlinkSync, rmSync, lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { checkedChildEnvironment, newTestPrismaEnvironment } from "./newTestChildEnvironment";
import { assertSyntheticSupervisor, buildOwnedWorker, verifyOwnedBytes, verifyOwnedOutputTree } from "./ownedCheckoutWorkerBundle";
export type OwnedWorkerReview = Parameters<typeof buildOwnedWorker>[1];
export async function startOwnedCheckoutWorker(input: { db: PrismaClient; databaseUrl: string; runtimeId: string; organizationId: string; origin: string; reviewed: OwnedWorkerReview }) {
  assertSyntheticSupervisor(process.env); newTestPrismaEnvironment(process.env, process.execArgv, input.databaseUrl);
  const rows = await input.db.$queryRawUnsafe<Array<{ id: string }>>('SELECT id FROM "IsolatedTestRuntime" WHERE id=$1 AND account=$2', input.runtimeId, "acct-test");
  if (rows.length !== 1) throw new Error("owned_checkout_supervisor_scope_required");
  const directory = "/tmp/axiom-owned-checkout-" + randomBytes(16).toString("hex"), session = randomBytes(16).toString("hex"), capability = randomBytes(32).toString("hex");
  mkdirSync(directory, { mode: 0o700 });
  const bridgeEnv = { NODE_ENV: "development" as const, AXIOM_OWNED_CHECKOUT_BRIDGE: "v1", AXIOM_ISOLATED_PUBLIC_TEST_RUNTIME: "true", DATABASE_URL: input.databaseUrl, DIRECT_URL: input.databaseUrl, NEXTAUTH_URL: input.origin, AXIOM_ISOLATED_TEST_RUNTIME_ID: input.runtimeId, AXIOM_ISOLATED_TEST_ACCOUNT_ID: "acct-test", AXIOM_ISOLATED_TEST_ORGANIZATIONS: input.organizationId, AXIOM_OWNED_CHECKOUT_DIRECTORY: directory, AXIOM_OWNED_CHECKOUT_SESSION: session, AXIOM_OWNED_CHECKOUT_CAPABILITY: capability };
  let child: ChildProcess | undefined, stopped = false; const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const stop = async () => {
    if (stopped) return; stopped = true;
    for (const timer of timers.values()) clearTimeout(timer); timers.clear();
    if (child && child.exitCode === null && child.signalCode === null) {
      const done = new Promise<void>(resolve => child!.once("exit", () => resolve())); child.kill("SIGTERM");
      const kill = setTimeout(() => child!.kill("SIGKILL"), 2000); await done; clearTimeout(kill);
    }
    const dir = lstatSync(directory); if (!dir.isDirectory() || dir.isSymbolicLink() || realpathSync(directory) !== directory || dir.uid !== process.getuid?.() || (dir.mode & 0o777) !== 0o700) throw new Error("owned_checkout_cleanup_refused");
    rmSync(directory, { recursive: true, force: true });
  };
  try {
    const build = await buildOwnedWorker(directory, input.reviewed);
    // Re-read exact source/output bytes before any worker/provider construction.
    const root = resolve(new URL("../../../../", import.meta.url).pathname);
    verifyOwnedBytes(build.receipt, Object.fromEntries(build.receipt.sources.map(r => [r.path, readFileSync(resolve(root, r.path), "utf8")])), Object.fromEntries(build.receipt.outputs.map(r => [r.path, readFileSync(resolve(build.output, r.path), "utf8")])));
    verifyOwnedOutputTree(build.output, build.receipt.outputs);
    mkdirSync(resolve(directory, "node_modules"), { mode: 0o700 });
    for (const graph of input.reviewed.externalGraphs) {
      const parts = graph.name.split("/"); if (parts.length === 2) mkdirSync(resolve(directory, "node_modules", parts[0]), { mode: 0o700, recursive: true });
      symlinkSync(graph.directory, resolve(directory, "node_modules", graph.name));
    }
    const env = { ...checkedChildEnvironment(process.env, process.execArgv), AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null", AWS_EC2_METADATA_DISABLED: "true" };
    child = fork(build.entry, [], { env, execArgv: ["--conditions=react-server"], stdio: ["ignore", "pipe", "pipe", "ipc"] });
    let outputBytes = 0; const discard = (chunk: Buffer) => { outputBytes += chunk.byteLength; if (outputBytes > 8192) child?.kill("SIGKILL"); };
    child.stdout?.on("data", discard); child.stderr?.on("data", discard);
    await new Promise<void>((ready, reject) => {
      const deadline = setTimeout(() => { child?.kill("SIGKILL"); reject(new Error("owned_checkout_worker_start_unavailable")); }, 12000);
      const fail = () => { clearTimeout(deadline); reject(new Error("owned_checkout_worker_start_unavailable")); };
      child!.once("error", fail); child!.once("exit", fail);
      child!.on("message", value => {
        const m = value as { kind?: unknown; token?: unknown; duration?: unknown; session?: unknown; pid?: unknown };
        if (m.kind === "owned_worker_ready" && m.session === session && m.pid === child!.pid) { clearTimeout(deadline); ready(); }
        else if (m.kind === "owned_operation_started" && typeof m.token === "string" && /^[a-f0-9]{32}$/.test(m.token) && [10000, 45000, 90000].includes(Number(m.duration)) && !timers.has(m.token) && timers.size < 2) timers.set(m.token, setTimeout(() => child?.kill("SIGKILL"), Number(m.duration) + 100));
        else if (m.kind === "owned_operation_finished" && typeof m.token === "string" && timers.has(m.token)) { clearTimeout(timers.get(m.token)); timers.delete(m.token); }
        else { child?.kill("SIGKILL"); fail(); }
      });
      child!.send({ kind: "owned_checkout_bootstrap_v1", parentPid: process.pid, mode: "synthetic_only", env: bridgeEnv });
    });
    return { bridgeEnv, buildReceipt: build.receipt, outputDigest: build.outputDigest, stop };
  } catch { await stop(); throw new Error("owned_checkout_worker_start_unavailable"); }
}
