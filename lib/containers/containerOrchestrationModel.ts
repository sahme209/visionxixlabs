/**
 * Container Orchestration Surface — typed contract.
 *
 * One canonical model for every container surface Axiom touches:
 *
 *   - AWS ECS  (Fargate + EC2 launch types)
 *   - AWS EKS  (managed Kubernetes)
 *   - GCP GKE  (Autopilot + Standard)
 *   - Azure AKS (managed Kubernetes)
 *   - GitHub Container Registry (image source)
 *
 * The surface is **declared, read-only**. Live inventory traversal
 * sits behind provider mode === "live" gates; until each SDK is
 * wired, the entry reports `sourceMode: "preview"` honestly and
 * never invents node counts.
 *
 * Cluster posture carries:
 *   - control plane version (with EOL warning literal)
 *   - node pool count + autoscaling state
 *   - workload count + pod-level risk indicators
 *   - networking exposure (LoadBalancer / public ingress)
 *   - secrets posture (KMS / mount / env literal)
 *
 * Hard literal `safetyContract: "container_orchestration_read_only"`
 * — TS prevents drift to anything mutation-capable.
 */

export type ContainerProvider = "aws_ecs" | "aws_eks" | "gcp_gke" | "azure_aks" | "github_ghcr";

export type ContainerSourceMode =
  | "live"
  | "partial_live"
  | "preview"
  | "expanding"
  | "blocked"
  | "disabled"
  | "unknown";

export type ClusterStatus =
  | "healthy"
  | "degraded"
  | "upgrading"
  | "version_eol"
  | "config_drift"
  | "unreachable"
  | "preview"
  | "unknown";

export type WorkloadKind =
  | "deployment"
  | "statefulset"
  | "daemonset"
  | "service"
  | "ecs_service"
  | "ecs_task_definition"
  | "cronjob";

export type WorkloadRiskFlag =
  | "no_resource_limits"
  | "privileged_container"
  | "root_user"
  | "host_network"
  | "secret_in_env"
  | "no_readiness_probe"
  | "no_liveness_probe"
  | "imagepullbackoff"
  | "outdated_image_tag"
  | "unpatched_cve";

export type NetworkExposure = "private" | "internal" | "internet_routable" | "unknown";

export type SecretsPosture =
  | "managed_kms"
  | "external_secrets_operator"
  | "csi_driver"
  | "mounted_volume"
  | "env_var"           // risky
  | "unknown";

export interface ContainerWorkload {
  id: string;
  name: string;
  kind: WorkloadKind;
  namespace?: string;
  replicas?: number;
  readyReplicas?: number;
  image?: string;
  imageDigestPinned?: boolean;
  cpuRequest?: string;
  memoryRequest?: string;
  riskFlags: WorkloadRiskFlag[];
  /** Operator-readable summary the UI renders inline. */
  summary: string;
  /** Evidence ref (cluster:namespace:name path or ECS task arn). */
  evidenceRef: string;
}

export interface ContainerCluster {
  id: string;
  provider: ContainerProvider;
  name: string;
  region: string;
  controlPlaneVersion?: string;
  versionEol: boolean;
  status: ClusterStatus;
  sourceMode: ContainerSourceMode;
  nodePoolCount: number;
  nodeCount: number;
  autoscalerEnabled: boolean;
  podCount: number;
  workloadCount: number;
  publicEndpointsCount: number;
  networkExposure: NetworkExposure;
  secretsPosture: SecretsPosture;
  workloads: ContainerWorkload[];
  /** Honest list of capability gaps for this provider mode. */
  limitations: string[];
  /** Operator-actionable next-step route. */
  safeNextAction: { label: string; href: string };
  /** Provider-specific console / inventory link. */
  externalConsoleHref?: string;
}

export interface ContainerOrchestrationReport {
  generatedAt: string;
  tenantId?: string;
  clusters: ContainerCluster[];
  summary: {
    total: number;
    byProvider: Record<ContainerProvider, number>;
    healthy: number;
    degraded: number;
    upgrading: number;
    eolVersionsCount: number;
    publicEndpointsTotal: number;
    workloadsTotal: number;
    podsTotal: number;
    riskyWorkloadsCount: number;
    /** Distinct WorkloadRiskFlag values seen across all workloads. */
    riskFlagBreakdown: Record<WorkloadRiskFlag, number>;
  };
  overallSourceMode: ContainerSourceMode;
  /** Hard-literal safety contract. */
  safetyContract: "container_orchestration_read_only";
  limitations: string[];
  safeNextAction: { label: string; href: string };
}

// ---------------------------------------------------------------------------
// Visual helpers — labels never drift from the model
// ---------------------------------------------------------------------------

export const PROVIDER_LABEL: Record<ContainerProvider, string> = {
  aws_ecs:    "AWS ECS",
  aws_eks:    "AWS EKS",
  gcp_gke:    "GCP GKE",
  azure_aks:  "Azure AKS",
  github_ghcr: "GitHub Container Registry",
};

export const CLUSTER_STATUS_LABEL: Record<ClusterStatus, string> = {
  healthy:        "Healthy",
  degraded:       "Degraded",
  upgrading:      "Upgrading",
  version_eol:    "Version EOL",
  config_drift:   "Config drift",
  unreachable:    "Unreachable",
  preview:        "Preview",
  unknown:        "Unknown",
};

export const CLUSTER_STATUS_TONE: Record<ClusterStatus, "emerald" | "cyan" | "amber" | "rose" | "violet" | "zinc"> = {
  healthy:        "emerald",
  degraded:       "amber",
  upgrading:      "cyan",
  version_eol:    "rose",
  config_drift:   "amber",
  unreachable:    "rose",
  preview:        "violet",
  unknown:        "zinc",
};

export const RISK_FLAG_LABEL: Record<WorkloadRiskFlag, string> = {
  no_resource_limits:   "No resource limits",
  privileged_container: "Privileged container",
  root_user:            "Runs as root",
  host_network:         "Host network",
  secret_in_env:        "Secret in env var",
  no_readiness_probe:   "No readiness probe",
  no_liveness_probe:    "No liveness probe",
  imagepullbackoff:     "Image pull back-off",
  outdated_image_tag:   "Outdated image tag",
  unpatched_cve:        "Unpatched CVE",
};

export const RISK_FLAG_TONE: Record<WorkloadRiskFlag, "rose" | "amber" | "cyan"> = {
  no_resource_limits:   "amber",
  privileged_container: "rose",
  root_user:            "amber",
  host_network:         "rose",
  secret_in_env:        "rose",
  no_readiness_probe:   "amber",
  no_liveness_probe:    "amber",
  imagepullbackoff:     "rose",
  outdated_image_tag:   "amber",
  unpatched_cve:        "rose",
};

export const NETWORK_EXPOSURE_LABEL: Record<NetworkExposure, string> = {
  private:           "Private",
  internal:          "Internal",
  internet_routable: "Internet-routable",
  unknown:           "Unknown",
};

export const SECRETS_POSTURE_LABEL: Record<SecretsPosture, string> = {
  managed_kms:                "Managed KMS",
  external_secrets_operator:  "External Secrets Operator",
  csi_driver:                 "CSI driver",
  mounted_volume:             "Mounted volume",
  env_var:                    "Env var (risky)",
  unknown:                    "Unknown",
};
