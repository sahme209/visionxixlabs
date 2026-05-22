/**
 * Native Service Catalog — typed model only (no Prisma yet).
 *
 * Defines the shape every other native module (alerting, incidents,
 * dashboards, security findings, SLOs) hangs off of. A Service is the
 * unit of operational ownership inside a client workspace: an API,
 * worker, frontend, database, scheduled job, etc.
 *
 * Persistence model lands in a follow-up Prisma migration. Until then,
 * extractors that discover services from connector data populate
 * in-memory caches against these types so the UI can render the catalog
 * end-to-end without waiting on schema work.
 */

import type { OrganizationId, UserId } from "@/lib/domain/ids";

export type ServiceKind =
  | "api"
  | "worker"
  | "frontend"
  | "database"
  | "queue"
  | "scheduled_job"
  | "cli"
  | "static_asset"
  | "external_dependency";

export type ServiceTier = "tier_1_critical" | "tier_2_important" | "tier_3_internal" | "tier_4_experiment";

export type EnvironmentKind = "production" | "staging" | "preview" | "development" | "qa";

export interface ServiceRef {
  organizationId: OrganizationId;
  /** Stable opaque id — generated when the service first appears. */
  id: string;
  /** Short name shown to operators. */
  name: string;
  /** Free-text description. */
  description?: string;
  kind: ServiceKind;
  tier: ServiceTier;
  /** Owning user / team handle. Workspaces without RBAC put a single owner. */
  ownerUserId?: UserId;
  ownerTeam?: string;
  /** Source connectors that discovered or describe this service. */
  discoveredFrom: Array<"aws" | "azure" | "gcp" | "github" | "kubernetes" | "manual">;
  /** Tags applied by operators or auto-discovered. */
  tags: string[];
  /** ISO timestamp of first discovery. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
}

export interface ServiceEnvironment {
  organizationId: OrganizationId;
  id: string;
  serviceId: string;
  kind: EnvironmentKind;
  /** External URL / endpoint when applicable. */
  endpoint?: string;
  /** Region / cluster identifier — provider-specific. */
  region?: string;
  /** External identifier (e.g. ECS service arn, Cloud Run name). */
  externalRef?: string;
}

export interface ServiceDependency {
  organizationId: OrganizationId;
  /** Caller side. */
  fromServiceId: string;
  /** Callee side. */
  toServiceId: string;
  /** "synchronous" RPC vs "asynchronous" queue/event. */
  callPattern: "synchronous" | "asynchronous" | "scheduled";
  /** How the dependency was discovered — affects confidence. */
  source: "trace_inference" | "config_declared" | "manual";
  /** 0..1 confidence in this dependency edge. */
  confidence: number;
}

export interface ServiceHealthSnapshot {
  organizationId: OrganizationId;
  serviceId: string;
  /** Closed-union health verdict. */
  status: "healthy" | "degraded" | "down" | "unknown";
  /** ISO timestamp of when this snapshot was computed. */
  computedAt: string;
  /** Aggregate error rate for the window (0..1). */
  errorRate?: number;
  /** P50 / P95 / P99 latency in ms. */
  latencyMs?: { p50: number; p95: number; p99: number };
  /** Number of open alerts attached to this service. */
  openAlertCount: number;
  /** Number of open incidents this service participates in. */
  openIncidentCount: number;
  /** Source mode for the data — preview/live/etc. */
  source: "native" | "connector" | "manual" | "preview";
}

/** Helper: a service-catalog index that downstream queries operate on. */
export interface ServiceCatalogView {
  services: readonly ServiceRef[];
  environments: readonly ServiceEnvironment[];
  dependencies: readonly ServiceDependency[];
  health: Readonly<Record<string, ServiceHealthSnapshot | undefined>>;
}

export function emptyServiceCatalog(orgId: OrganizationId): ServiceCatalogView {
  void orgId;
  return { services: [], environments: [], dependencies: [], health: {} };
}
