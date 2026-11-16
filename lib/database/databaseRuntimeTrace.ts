/** Private server factory diagnostics. Records only fixed tags and capped counts;
 * no target, configuration, client contents, error or credential is retained. */
export type DatabaseRuntimeEvent = "unconfigured" | "direct-neon" | "pooled-or-other"
  | "startup-configuration" | "startup-options-removed" | "session-init-start" | "session-init-ack";
export type DatabaseRuntimeObserver = (event: DatabaseRuntimeEvent) => void;
type Route = "unknown-client" | "unconfigured" | "direct-neon" | "pooled-or-other";
interface State { tlsVerificationConfigured: boolean | null; channelBindingRequired: boolean | null; route: Route; startup: number; removed: number; init: number; ack: number }
const clients = new WeakMap<object, State>();
const increment = (value: number) => Math.min(value + 1, 1000);

export function newDatabaseRuntimeTrace(config?: { tlsVerificationConfigured: boolean; channelBindingRequired: boolean }) {
  const state: State = { tlsVerificationConfigured: config?.tlsVerificationConfigured ?? null, channelBindingRequired: config?.channelBindingRequired ?? null, route: "unknown-client", startup: 0, removed: 0, init: 0, ack: 0 };
  const observe: DatabaseRuntimeObserver = event => {
    switch (event) {
      case "unconfigured": case "direct-neon": case "pooled-or-other": state.route = event; break;
      case "startup-configuration": state.startup = increment(state.startup); break;
      case "startup-options-removed": state.removed = increment(state.removed); break;
      case "session-init-start": state.init = increment(state.init); break;
      case "session-init-ack": state.ack = increment(state.ack); break;
    }
  };
  return { observe, register(client: object) { clients.set(client, state); } };
}

export function databaseRuntimeSnapshot(client: object) {
  const state = clients.get(client);
  return {
    databaseTraceRevision: "database-route-trace-v1",
    databaseClientRoute: state?.route ?? "unknown-client",
    // These calls observe preparation, not network transmission. Other routes
    // have no startup/session instrumentation; zero does not mean no packets.
    databaseObservationScope: "direct-client-only",
    tlsVerificationConfigured: state?.tlsVerificationConfigured ?? null,
    channelBindingRequired: state?.channelBindingRequired ?? null,
    databaseStartupConfigurationCalls: state?.startup ?? 0,
    databaseStartupOptionsRemoved: state?.removed ?? 0,
    databaseSessionInitStarted: state?.init ?? 0,
    databaseSessionInitAcknowledged: state?.ack ?? 0,
  };
}

/** Fixed server error categories only. Inspect bounded own data descriptors;
 * never invoke getters, stringify an error, or retain its text/stack/target. */
export function databaseRuntimeErrorClassification(error: unknown): string {
  const codes = new Map([
    ["08P01", "postgres_protocol_08P01"], ["P2039", "prisma_P2039"], ["P2010", "prisma_P2010"],
    ["P1001", "prisma_P1001"], ["ECONNREFUSED", "connection_refused"], ["ECONNRESET", "connection_reset"],
    ["ETIMEDOUT", "connection_timeout"], ["ENOTFOUND", "name_not_found"], ["EAI_AGAIN", "name_retry"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "tls_hostname_rejected"], ["CERT_HAS_EXPIRED", "tls_certificate_expired"],
    ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "tls_certificate_rejected"], ["SELF_SIGNED_CERT_IN_CHAIN", "tls_certificate_rejected"],
  ]);
  const queue: Array<{ value: unknown; depth: number }> = [{ value: error, depth: 0 }];
  const seen = new WeakSet<object>();
  let category = "unknown", visited = 0;
  try {
    while (queue.length && visited++ < 16) {
      const item = queue.shift()!;
      if (!item.value || typeof item.value !== "object" || seen.has(item.value)) continue;
      seen.add(item.value);
      for (const key of ["code", "message", "originalMessage", "cause", "meta", "driverAdapterError"]) {
        const descriptor = Object.getOwnPropertyDescriptor(item.value, key);
        if (!descriptor || !("value" in descriptor)) continue;
        const value: unknown = descriptor.value;
        if (key === "code" && typeof value === "string" && value.length <= 64) {
          const known = codes.get(value);
          if (known && (category === "unknown" || value === "08P01")) category = known;
        } else if ((key === "message" || key === "originalMessage") && typeof value === "string") {
          const text = value.slice(0, 4096);
          if (text.includes("unsupported startup parameter in options: search_path")) return "startup_search_path_rejected";
          if (text === "postgres_channel_binding_required_unavailable") category = "channel_binding_required_unavailable";
          if (text === "postgres_session_initialization_unavailable") category = "session_initialization_unavailable";
        } else if (item.depth < 4 && queue.length < 16 && ["cause", "meta", "driverAdapterError"].includes(key)) {
          queue.push({ value, depth: item.depth + 1 });
        }
      }
    }
    return category;
  } catch { return "unknown"; }
}
