/**
 * Cross-cloud Network Topology — typed contract.
 *
 * Normalized node-and-edge graph across AWS / Azure / GCP. Three
 * node families:
 *
 *   • vpc      — AWS VPC, Azure VNet, GCP VPC Network (all CIDR-bounded
 *                isolated networks).
 *   • subnet   — AWS subnet, Azure subnet, GCP subnetwork.
 *   • peering  — A peering relationship between two vpc nodes; rendered
 *                as a node so the same shape works whether the peer is
 *                same-cloud or cross-cloud (VPN attachment).
 *
 * Edges are typed:
 *
 *   • contains      — vpc → subnet
 *   • peers         — vpc → peering → vpc
 *   • internet_edge — vpc → "internet" virtual node when an IGW / NAT /
 *                     public-IP subnet is detected.
 *
 * Why one shape: the dashboard renders any cloud's network as the same
 * node-link diagram; the autonomy reasoner answers "is this subnet
 * reachable from the internet?" with one traversal.
 */

export type CloudId = "aws" | "azure" | "gcp";
export type NodeKind = "vpc" | "subnet" | "peering" | "internet";
export type EdgeKind = "contains" | "peers" | "internet_edge";
export type TopologyMode = "live" | "preview" | "blocked" | "disabled" | "partial";

export interface TopologyNode {
  id: string;
  kind: NodeKind;
  cloud: CloudId | "synthetic";
  /** Display label. */
  label: string;
  /** Optional region / location string. */
  region?: string;
  /** CIDR block(s) for vpc + subnet nodes. */
  cidrs?: string[];
  /** True when the node touches the internet (igw / public ip / public-network-access=Enabled). */
  internetFacing?: boolean;
}

export interface TopologyEdge {
  id: string;
  kind: EdgeKind;
  fromNodeId: string;
  toNodeId: string;
}

export interface CloudSectionStats {
  cloud: CloudId;
  mode: TopologyMode;
  vpcCount: number;
  subnetCount: number;
  peeringCount: number;
  internetFacingVpcCount: number;
  limitations: string[];
}

export interface NetworkTopologyReport {
  generatedAt: string;
  durationMs: number;
  nodes: TopologyNode[];
  edges: TopologyEdge[];
  sections: CloudSectionStats[];
  totals: {
    vpcs: number;
    subnets: number;
    peerings: number;
    internetFacingVpcs: number;
  };
  limitations: string[];
}
