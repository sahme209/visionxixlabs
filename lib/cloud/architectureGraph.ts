/**
 * Architecture Graph — converts infrastructure discovery results into nodes and edges.
 * Used for visualizing cloud infrastructure topology.
 */

export type ArchitectureNodeType = "VPC" | "EC2" | "S3" | "RDS" | "Region";

export type ArchitectureNode = {
  id: string;
  type: ArchitectureNodeType;
  label?: string;
};

export type ArchitectureEdge = {
  from: string;
  to: string;
};

export type ArchitectureGraph = {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  region?: string;
};

export type DiscoveryInput = {
  ec2Count?: number;
  s3Count?: number;
  rdsCount?: number;
  vpcCount?: number;
  region?: string;
};

/**
 * Convert discovery results into a graph of nodes and edges.
 * VPCs contain EC2 and RDS; S3 is standalone (global/regional).
 * Uses synthetic IDs when discovery only provides counts.
 */
export function buildArchitectureGraph(discovery: DiscoveryInput): ArchitectureGraph {
  const ec2Count = Math.max(0, discovery.ec2Count ?? 0);
  const s3Count = Math.max(0, discovery.s3Count ?? 0);
  const rdsCount = Math.max(0, discovery.rdsCount ?? 0);
  const vpcCount = Math.max(1, discovery.vpcCount ?? 1);

  const nodes: ArchitectureNode[] = [];
  const edges: ArchitectureEdge[] = [];

  // VPC nodes
  for (let i = 1; i <= vpcCount; i++) {
    nodes.push({
      id: `vpc-${i}`,
      type: "VPC",
      label: vpcCount === 1 ? "VPC" : `VPC ${i}`,
    });
  }

  // EC2 nodes — attached to VPCs (round-robin)
  for (let i = 1; i <= ec2Count; i++) {
    const vpcIdx = ((i - 1) % vpcCount) + 1;
    nodes.push({
      id: `ec2-${i}`,
      type: "EC2",
      label: ec2Count === 1 ? "EC2" : `EC2 ${i}`,
    });
    edges.push({ from: `vpc-${vpcIdx}`, to: `ec2-${i}` });
  }

  // RDS nodes — attached to VPCs (round-robin)
  for (let i = 1; i <= rdsCount; i++) {
    const vpcIdx = ((i - 1) % vpcCount) + 1;
    nodes.push({
      id: `rds-${i}`,
      type: "RDS",
      label: rdsCount === 1 ? "RDS" : `RDS ${i}`,
    });
    edges.push({ from: `vpc-${vpcIdx}`, to: `rds-${i}` });
  }

  // S3 nodes — standalone (no VPC containment)
  for (let i = 1; i <= s3Count; i++) {
    nodes.push({
      id: `s3-${i}`,
      type: "S3",
      label: s3Count === 1 ? "S3" : `S3 ${i}`,
    });
  }

  return {
    nodes,
    edges,
    region: discovery.region,
  };
}
