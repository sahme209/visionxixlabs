import "server-only";
import { createPrivateAuthorityDatabase } from "@/lib/security/privateAuthorityDatabase";
import { createPrivateCredentialVault } from "@/lib/security/privateCredentialVault";
import { createPrivateReleaseMergeComposition } from "./privateReleaseMergeComposition";

// Fixed, nonsecret reviewed preparation profile. Neither flag authorizes execution.
const billing = Object.freeze({ kind: "legacy" as const });
const disabled = () => false;
const clock = Date.now.bind(Date);
const transport: typeof fetch = fetch.bind(globalThis);

/** Canonical lexical startup only. No business handler or readiness is exposed.
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
    client = createPrivateAuthorityDatabase(datasource); // Actual lazy Prisma; no SQL.
    const vault = createPrivateCredentialVault(vaultKey);
    graph = createPrivateReleaseMergeComposition({ client, vault, sessionSigningKey, billing, fetch: transport, now: clock, enabled: disabled, governanceEnabled: disabled });
    let closing: Promise<void> | undefined;
    const ownedClient = client;
    return Object.freeze({
      close(): Promise<void> {
        if (!closing) {
          graph = undefined; // Drop private ports; never return forRequest/repo/keys.
          closing = Promise.resolve().then(() => ownedClient.$disconnect());
        }
        return closing;
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
