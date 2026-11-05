import "server-only";
import type { NextRequest } from "next/server";
import { readIssuerIdentity } from "@axiom/verified-issuer-runtime";
import { createPrivateReleaseMergeDataDispatcher } from "./privateReleaseMergeRequestData";
import { createPrivateAuthorityDatabase } from "@/lib/security/privateAuthorityDatabase";
import { createPrivateCredentialVault } from "@/lib/security/privateCredentialVault";
import { createPrivateReleaseMergeComposition } from "./privateReleaseMergeComposition";

// Fixed private profile. Native currentness never substitutes for action authority.
const billing = Object.freeze({ kind: "legacy" as const });
const current = () => readIssuerIdentity().status === "current";
const clock = Date.now.bind(Date);
const transport: typeof fetch = fetch.bind(globalThis);

/** Canonical lexical startup only. No graph, resource or readiness setter is exposed.
 * Native resource custody and executing-consumer qualification remain separate.
 */
export async function initializePrivateReleaseMergeBootstrap(material: unknown) {
  let client: ReturnType<typeof createPrivateAuthorityDatabase> | undefined;
  let graph: ReturnType<typeof createPrivateReleaseMergeComposition> | undefined;
  let keys: { vaultKey: Uint8Array; sessionSigningKey: Uint8Array } | undefined;
  try {
    if (!material || typeof material !== "object" || !Object.isFrozen(material) || Object.getPrototypeOf(material) !== Object.prototype) throw Error("private_bootstrap_record_invalid");
    const fields = Object.getOwnPropertyDescriptors(material);
    if (Reflect.ownKeys(fields).length !== 3 || !["datasource", "vaultKey", "sessionSigningKey"].every(name => fields[name] && "value" in fields[name])) throw Error("private_bootstrap_record_invalid");
    const { datasource, vaultKey, sessionSigningKey } = material as { datasource: unknown; vaultKey: unknown; sessionSigningKey: unknown };
    if (!(vaultKey instanceof Uint8Array) || !(sessionSigningKey instanceof Uint8Array)) throw Error("private_bootstrap_keys_invalid");
    keys = { vaultKey, sessionSigningKey };
    if (vaultKey.byteLength !== 32 || sessionSigningKey.byteLength < 32 || sessionSigningKey.byteLength > 4096 || typeof datasource !== "string" || Buffer.byteLength(datasource, "utf8") > 8192 || datasource.includes("\0")) throw Error("private_bootstrap_material_invalid");
    // Reject lone UTF-16 surrogates rather than silently encoding replacement bytes.
    if (Buffer.from(datasource, "utf8").toString("utf8") !== datasource) throw Error("private_bootstrap_datasource_invalid");
    if (!current()) throw Error("private_bootstrap_origin_unavailable");
    client = createPrivateAuthorityDatabase(datasource); // Actual lazy Prisma; no SQL.
    const vault = createPrivateCredentialVault(vaultKey);
    graph = createPrivateReleaseMergeComposition({ client, vault, sessionSigningKey, billing, fetch: transport, now: clock, enabled: current, governanceEnabled: current });
    let closing: Promise<void> | undefined;
    let closed = false;
    const pendingHandlers = new Set<Promise<unknown>>();
    type Handler = (request: NextRequest, requestId: string, planId: string) => Promise<Response>;
    const track = (handler: Handler): Handler => (...args) => {
      const pending = Promise.resolve().then(() => handler(...args));
      pendingHandlers.add(pending);
      void pending.then(() => pendingHandlers.delete(pending), () => pendingHandlers.delete(pending));
      return pending;
    };
    let dispatchData: ReturnType<typeof createPrivateReleaseMergeDataDispatcher> | undefined = createPrivateReleaseMergeDataDispatcher({execution: track(graph.handleExecution), operation: track(graph.handleOperation)});
    const drain = async (limit: AbortSignal) => {
      if (!pendingHandlers.size) return;
      try {
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => reject(Error("private_bootstrap_drain_unknown"));
          if (limit.aborted) { onAbort(); return; }
          limit.addEventListener("abort", onAbort, {once: true});
          void Promise.allSettled([...pendingHandlers]).then(() => {
            limit.removeEventListener("abort", onAbort);
            resolve();
          });
        });
      } catch {
        closed = true;
        dispatchData = undefined;
        graph = undefined;
        throw Error("private_bootstrap_drain_unknown");
      }
    };
    let active: {controller: AbortController; promise: Promise<Readonly<{status: number; body: Uint8Array}>>} | undefined;
    const ownedClient = client;
    return Object.freeze({
      close(): Promise<void> {
        if (!closing) {
          closed = true;
          const pending = active;
          pending?.controller.abort();
          dispatchData = undefined;
          graph = undefined;
          closing = (async () => {
            await pending?.promise.catch(() => {});
            await ownedClient.$disconnect();
          })();
        }
        return closing;
      },
      async dispatch(bytes: Uint8Array, signal: AbortSignal) {
        if (closed || active || !current() || !dispatchData) throw Error("private_bootstrap_dispatch_unavailable");
        const controller = new AbortController();
        const combined = AbortSignal.any([signal, controller.signal]);
        combined.throwIfAborted();
        const ownedDispatch = dispatchData;
        // Disposal ceiling starts with the request, never extends its action deadline.
        const drainLimit = AbortSignal.timeout(25000);
        const work = {controller, promise: Promise.resolve().then(async () => {
          combined.throwIfAborted();
          if (closed || !current()) throw Error("private_bootstrap_dispatch_unavailable");
          try {
            const response = await ownedDispatch(bytes, combined);
            combined.throwIfAborted();
            if (closed || !current()) throw Error("private_bootstrap_dispatch_unavailable");
            return response;
          } finally {
            // Adapter cancellation races its handler; only actual settlement
            // permits reuse of the canonical/native request context.
            await drain(drainLimit);
          }
        })};
        active = work;
        try { return await work.promise; }
        finally { if (active === work) active = undefined; }
      },
    });
  } catch {
    graph = undefined;
    if (client) await client.$disconnect().catch(() => {});
    throw Error("private_bootstrap_initialization_unavailable");
  } finally {
    keys?.vaultKey.fill(0);
    keys?.sessionSigningKey.fill(0);
    // Factories retain needed private copies. JS strings, V8 and framework-owned
    // storage have no zeroization guarantee; this wipes only mutable staging.
  }
}
