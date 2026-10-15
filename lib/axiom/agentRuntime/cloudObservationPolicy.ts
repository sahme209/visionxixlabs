/** Bounded observations are evidence, never full snapshots or execution authority. */
export interface BoundedAwsObservation {
  kind: "aws_bounded_observation";
  connection: { id: string; version: number; revokedAt: null };
  provider: "aws";
  accountId: string;
  observedAt: string;
  source: "live";
  coverage: { complete: false; regions: string[]; resourceTypes: ["ec2_instance"]; maximumResources: 5; pagination: "single_page"; truncated: boolean };
  unknown: { costs: true; utilizationMetrics: true; backups: true; otherRegions: true; otherResourceTypes: true };
  authority: "observation_only";
  instances: Array<{ instanceId: string; state: string; instanceType: string; availabilityZone: string }>;
}
export function isBoundedAwsObservation(value: unknown): value is BoundedAwsObservation {
  if (!value || typeof value !== "object") return false;
  const item = value as BoundedAwsObservation;
  return item.kind === "aws_bounded_observation" && item.authority === "observation_only"
    && item.provider === "aws" && item.source === "live" && typeof item.accountId === "string" && /^\d{12}$/.test(item.accountId)
    && typeof item.observedAt === "string" && Number.isFinite(Date.parse(item.observedAt))
    && typeof item.connection?.id === "string" && item.connection.id.length > 0 && item.connection.id.length <= 128 && Number.isSafeInteger(item.connection.version) && item.connection.version >= 1 && item.connection.revokedAt === null
    && item.coverage?.complete === false && item.coverage.maximumResources === 5 && item.coverage.pagination === "single_page"
    && Array.isArray(item.coverage.regions) && item.coverage.regions.length === 1 && typeof item.coverage.regions[0] === "string"
    && item.coverage.resourceTypes?.length === 1 && item.coverage.resourceTypes[0] === "ec2_instance" && typeof item.coverage.truncated === "boolean"
    && item.unknown?.costs === true && item.unknown.utilizationMetrics === true && item.unknown.backups === true && item.unknown.otherRegions === true && item.unknown.otherResourceTypes === true
    && Array.isArray(item.instances) && item.instances.length <= 5
    && item.instances.every(instance => instance && typeof instance.instanceId === "string" && typeof instance.state === "string" && typeof instance.instanceType === "string" && typeof instance.availabilityZone === "string");
}
