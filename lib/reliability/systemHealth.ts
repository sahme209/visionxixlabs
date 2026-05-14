/**
 * System health model.
 *
 * Each subsystem (database, AWS connector, AI provider, …) publishes a
 * `ComponentHealth` snapshot. The reliability center aggregates them into a
 * single `SystemHealth` picture so users get a fast read on whether Axiom is
 * healthy *right now*.
 *
 * Health is intentionally simple — five states, plus latency and error rate
 * if known. Subsystems with no recent observation are reported `unknown`
 * rather than fabricating a green status.
 */

export type HealthStatus = "healthy" | "degraded" | "failing" | "unavailable" | "unknown";

export type ComponentId =
  | "web_app"
  | "database"
  | "auth"
  | "connector.aws"
  | "connector.azure"
  | "connector.gcp"
  | "connector.github"
  | "terraform_generator"
  | "copilot_llm"
  | "event_bus"
  | "audit_log"
  | "workflow_engine"
  | "desktop_runtime"
  | "notification_system";

export interface ComponentHealth {
  id: ComponentId;
  label: string;
  status: HealthStatus;
  /** Last check timestamp (ISO). */
  lastCheckAt?: string;
  /** Round-trip latency in ms, if measured. */
  latencyMs?: number;
  /** Error rate over the rolling window (0..1). */
  errorRate?: number;
  /** Recent failure summary lines — newest first, ≤ 5. */
  recentFailures?: string[];
  /** Safe next action shown to users when not healthy. */
  safeNextAction?: { label: string; href: string };
  /** Short user-facing message. */
  userMessage?: string;
  /** Operator-facing detail for the reliability center. */
  internalDetail?: string;
}

export const COMPONENT_LABEL: Record<ComponentId, string> = {
  web_app:               "Web app",
  database:              "Database",
  auth:                  "Authentication",
  "connector.aws":       "AWS connector",
  "connector.azure":     "Azure connector",
  "connector.gcp":       "GCP connector",
  "connector.github":    "GitHub connector",
  terraform_generator:   "Terraform generator",
  copilot_llm:           "Copilot / LLM",
  event_bus:             "Event bus",
  audit_log:             "Audit log",
  workflow_engine:       "Workflow engine",
  desktop_runtime:       "Desktop runtime",
  notification_system:   "Notifications",
};

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

export interface SystemHealth {
  components: ComponentHealth[];
  /** Overall — worst of the components. */
  overall: HealthStatus;
  /** Count by status. */
  counts: Record<HealthStatus, number>;
  /** Computed at. */
  computedAt: string;
}

const ORDER: HealthStatus[] = ["unavailable", "failing", "degraded", "unknown", "healthy"];

export function aggregateHealth(components: ComponentHealth[]): SystemHealth {
  const counts: Record<HealthStatus, number> = { healthy: 0, degraded: 0, failing: 0, unavailable: 0, unknown: 0 };
  for (const c of components) counts[c.status]++;
  // Overall = the worst status present
  let overall: HealthStatus = "healthy";
  for (const s of ORDER) {
    if (counts[s] > 0) { overall = s; break; }
  }
  return { components, overall, counts, computedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------------------
// Probes — pluggable, async signal collection
// ---------------------------------------------------------------------------

export type HealthProbe = () => Promise<ComponentHealth>;

const _probes = new Map<ComponentId, HealthProbe>();

export function registerProbe(id: ComponentId, probe: HealthProbe): void {
  _probes.set(id, probe);
}

export async function collectHealth(): Promise<SystemHealth> {
  const components: ComponentHealth[] = [];
  for (const [id, probe] of _probes.entries()) {
    try {
      const observed = await probe();
      components.push(observed);
    } catch (err) {
      components.push({
        id,
        label: COMPONENT_LABEL[id],
        status: "unknown",
        internalDetail: `Probe failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  // Components that never registered a probe → unknown, but still appear
  // so the UI doesn't accidentally hide failure of a component we forgot to wire.
  for (const id of Object.keys(COMPONENT_LABEL) as ComponentId[]) {
    if (!_probes.has(id)) {
      components.push({
        id,
        label: COMPONENT_LABEL[id],
        status: "unknown",
        internalDetail: "No probe registered.",
      });
    }
  }
  return aggregateHealth(components);
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

export interface HealthDisplay {
  pill: string;
  label: string;
  semantic: "neutral" | "running" | "success" | "warning" | "error";
}

export function displayFor(status: HealthStatus): HealthDisplay {
  switch (status) {
    case "healthy":     return { pill: "Healthy",     label: "Operating normally.",           semantic: "success" };
    case "degraded":    return { pill: "Degraded",    label: "Some calls failing or slow.",  semantic: "warning" };
    case "failing":     return { pill: "Failing",     label: "Most calls failing.",          semantic: "error"   };
    case "unavailable": return { pill: "Unavailable", label: "No calls succeeding.",         semantic: "error"   };
    case "unknown":     return { pill: "Unknown",     label: "No recent observation.",       semantic: "neutral" };
  }
}
