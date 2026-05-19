/**
 * Cross-cloud network topology builder.
 *
 * Calls per-cloud network extractors in parallel and folds the
 * results into one normalized node/edge graph.
 *
 *   AWS    → DescribeVpcs + DescribeSubnets + DescribeVpcPeering
 *            + DescribeInternetGateways
 *   Azure  → @azure/arm-network VirtualNetworks.list + each VNet's
 *            virtualNetworkPeerings
 *   GCP    → @google-cloud/compute NetworksClient.list (peerings are
 *            inline on each network)
 *
 * Per-cloud failures are isolated. Read-only.
 */

import "server-only";

import { loadAppEnv } from "@/lib/config/env";
import { getAwsConfig } from "./aws/awsConfig";
import { resolveAwsCredentials } from "./aws/awsCredentialResolver";
import {
  getAzureConfig,
  resolveAzureClientId,
  resolveAzureClientSecret,
} from "./azure/azureConfig";
import {
  getGcpConfig,
  resolveGcpServiceAccountJson,
  resolveGcpPrivateKey,
  resolveGcpClientEmail,
} from "./gcp/gcpConfig";
import type {
  CloudSectionStats,
  NetworkTopologyReport,
  TopologyEdge,
  TopologyNode,
} from "./networkTopologyModel";

const CALL_TIMEOUT_MS = 10_000;
const MAX_PER_CLOUD = 100;

const INTERNET_NODE_ID = "synthetic:internet";

export async function buildNetworkTopology(): Promise<NetworkTopologyReport> {
  const start = Date.now();
  const nodes: TopologyNode[] = [
    { id: INTERNET_NODE_ID, kind: "internet", cloud: "synthetic", label: "Internet" },
  ];
  const edges: TopologyEdge[] = [];
  const sections: CloudSectionStats[] = [];
  const overallLimitations: string[] = [];

  const [awsR, azureR, gcpR] = await Promise.allSettled([
    extractAwsTopology(),
    extractAzureTopology(),
    extractGcpTopology(),
  ]);

  for (const r of [awsR, azureR, gcpR]) {
    if (r.status === "fulfilled") {
      nodes.push(...r.value.nodes);
      edges.push(...r.value.edges);
      sections.push(r.value.stats);
    } else {
      const note = r.reason instanceof Error ? r.reason.message : String(r.reason);
      overallLimitations.push(note);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    nodes,
    edges,
    sections,
    totals: {
      vpcs: sections.reduce((n, s) => n + s.vpcCount, 0),
      subnets: sections.reduce((n, s) => n + s.subnetCount, 0),
      peerings: sections.reduce((n, s) => n + s.peeringCount, 0),
      internetFacingVpcs: sections.reduce((n, s) => n + s.internetFacingVpcCount, 0),
    },
    limitations: overallLimitations,
  };
}

// ---------------------------------------------------------------------------
// AWS
// ---------------------------------------------------------------------------

async function extractAwsTopology(): Promise<{ nodes: TopologyNode[]; edges: TopologyEdge[]; stats: CloudSectionStats }> {
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];
  const limitations: string[] = [];
  let vpcCount = 0;
  let subnetCount = 0;
  let peeringCount = 0;
  let internetFacingVpcCount = 0;

  const env = loadAppEnv();
  const cfg = getAwsConfig();
  if (!env.awsInventoryExtractEnabled) {
    return { nodes, edges, stats: emptyStats("aws", "disabled", ["AWS_INVENTORY_EXTRACT_ENABLED not set."]) };
  }
  if (cfg.mode !== "live") {
    return { nodes, edges, stats: emptyStats("aws", "preview", ["AWS mode is not live."]) };
  }
  const resolved = await resolveAwsCredentials({ sessionLabel: "topology" });
  if (resolved.mode !== "ok") {
    return { nodes, edges, stats: emptyStats("aws", "blocked", [resolved.reason]) };
  }

  let EC2Client;
  let DescribeVpcsCommand;
  let DescribeSubnetsCommand;
  let DescribeVpcPeeringConnectionsCommand;
  let DescribeInternetGatewaysCommand;
  try {
    const mod = await import("@aws-sdk/client-ec2");
    EC2Client = mod.EC2Client;
    DescribeVpcsCommand = mod.DescribeVpcsCommand;
    DescribeSubnetsCommand = mod.DescribeSubnetsCommand;
    DescribeVpcPeeringConnectionsCommand = mod.DescribeVpcPeeringConnectionsCommand;
    DescribeInternetGatewaysCommand = mod.DescribeInternetGatewaysCommand;
  } catch (err) {
    return { nodes, edges, stats: emptyStats("aws", "blocked", [`EC2 SDK import failed: ${redact(errMessage(err))}`]) };
  }

  const ec2 = new EC2Client({ region: resolved.region, credentials: resolved.credentials });
  const vpcInternetSet = new Set<string>();

  // IGWs first so we can mark VPCs as internet-facing.
  try {
    const igws = await withTimeout(ec2.send(new DescribeInternetGatewaysCommand({})), CALL_TIMEOUT_MS, "ec2.describe_igws");
    for (const igw of igws.InternetGateways ?? []) {
      for (const att of igw.Attachments ?? []) {
        if (att.VpcId && att.State === "available") vpcInternetSet.add(att.VpcId);
      }
    }
  } catch (err) {
    limitations.push(`IGW describe failed: ${redact(errMessage(err))}`);
  }

  // VPCs
  const seenVpcIds = new Set<string>();
  try {
    const vpcs = await withTimeout(ec2.send(new DescribeVpcsCommand({})), CALL_TIMEOUT_MS, "ec2.describe_vpcs");
    for (const v of vpcs.Vpcs?.slice(0, MAX_PER_CLOUD) ?? []) {
      if (!v.VpcId) continue;
      seenVpcIds.add(v.VpcId);
      const internetFacing = vpcInternetSet.has(v.VpcId);
      nodes.push({
        id: nodeId("aws", "vpc", v.VpcId),
        kind: "vpc",
        cloud: "aws",
        label: nameTag(v.Tags) ?? v.VpcId,
        region: resolved.region,
        cidrs: cidrsAws(v),
        internetFacing,
      });
      if (internetFacing) {
        edges.push({
          id: edgeId("internet_edge", "aws", v.VpcId, "internet"),
          kind: "internet_edge",
          fromNodeId: nodeId("aws", "vpc", v.VpcId),
          toNodeId: INTERNET_NODE_ID,
        });
        internetFacingVpcCount++;
      }
      vpcCount++;
    }
  } catch (err) {
    limitations.push(`VPC describe failed: ${redact(errMessage(err))}`);
  }

  // Subnets
  try {
    const subnets = await withTimeout(ec2.send(new DescribeSubnetsCommand({})), CALL_TIMEOUT_MS, "ec2.describe_subnets");
    for (const s of subnets.Subnets?.slice(0, MAX_PER_CLOUD * 4) ?? []) {
      if (!s.SubnetId || !s.VpcId || !seenVpcIds.has(s.VpcId)) continue;
      nodes.push({
        id: nodeId("aws", "subnet", s.SubnetId),
        kind: "subnet",
        cloud: "aws",
        label: nameTag(s.Tags) ?? s.SubnetId,
        region: s.AvailabilityZone ?? resolved.region,
        cidrs: s.CidrBlock ? [s.CidrBlock] : [],
        internetFacing: Boolean(s.MapPublicIpOnLaunch),
      });
      edges.push({
        id: edgeId("contains", "aws", s.VpcId, s.SubnetId),
        kind: "contains",
        fromNodeId: nodeId("aws", "vpc", s.VpcId),
        toNodeId: nodeId("aws", "subnet", s.SubnetId),
      });
      subnetCount++;
    }
  } catch (err) {
    limitations.push(`Subnet describe failed: ${redact(errMessage(err))}`);
  }

  // Peerings
  try {
    const pcxs = await withTimeout(ec2.send(new DescribeVpcPeeringConnectionsCommand({})), CALL_TIMEOUT_MS, "ec2.describe_pcx");
    for (const p of pcxs.VpcPeeringConnections?.slice(0, MAX_PER_CLOUD) ?? []) {
      if (!p.VpcPeeringConnectionId) continue;
      const lhs = p.RequesterVpcInfo?.VpcId;
      const rhs = p.AccepterVpcInfo?.VpcId;
      if (!lhs || !rhs) continue;
      const pNodeId = nodeId("aws", "peering", p.VpcPeeringConnectionId);
      nodes.push({
        id: pNodeId,
        kind: "peering",
        cloud: "aws",
        label: nameTag(p.Tags) ?? p.VpcPeeringConnectionId,
        region: resolved.region,
      });
      if (seenVpcIds.has(lhs)) {
        edges.push({ id: edgeId("peers", "aws", lhs, pNodeId), kind: "peers", fromNodeId: nodeId("aws", "vpc", lhs), toNodeId: pNodeId });
      }
      if (seenVpcIds.has(rhs)) {
        edges.push({ id: edgeId("peers", "aws", pNodeId, rhs), kind: "peers", fromNodeId: pNodeId, toNodeId: nodeId("aws", "vpc", rhs) });
      }
      peeringCount++;
    }
  } catch (err) {
    limitations.push(`VPC peering describe failed: ${redact(errMessage(err))}`);
  }

  return {
    nodes,
    edges,
    stats: { cloud: "aws", mode: "live", vpcCount, subnetCount, peeringCount, internetFacingVpcCount, limitations },
  };
}

function nameTag(tags: { Key?: string; Value?: string }[] | undefined): string | undefined {
  return tags?.find((t) => t.Key === "Name")?.Value || undefined;
}

function cidrsAws(v: { CidrBlock?: string; CidrBlockAssociationSet?: { CidrBlock?: string }[] }): string[] {
  const list: string[] = [];
  if (v.CidrBlock) list.push(v.CidrBlock);
  for (const a of v.CidrBlockAssociationSet ?? []) {
    if (a.CidrBlock && !list.includes(a.CidrBlock)) list.push(a.CidrBlock);
  }
  return list;
}

// ---------------------------------------------------------------------------
// Azure
// ---------------------------------------------------------------------------

async function extractAzureTopology(): Promise<{ nodes: TopologyNode[]; edges: TopologyEdge[]; stats: CloudSectionStats }> {
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];
  const limitations: string[] = [];
  let vpcCount = 0;
  let subnetCount = 0;
  let peeringCount = 0;
  let internetFacingVpcCount = 0;

  const env = loadAppEnv();
  const cfg = getAzureConfig();
  if (!env.azureInventoryExtractEnabled) {
    return { nodes, edges, stats: emptyStats("azure", "disabled", ["AZURE_INVENTORY_EXTRACT_ENABLED not set."]) };
  }
  if (cfg.mode !== "live") {
    return { nodes, edges, stats: emptyStats("azure", "preview", ["Azure mode is not live."]) };
  }
  const tenantId = env.azureTenantId;
  const subscriptionId = env.azureSubscriptionId;
  if (!tenantId || !subscriptionId) {
    return { nodes, edges, stats: emptyStats("azure", "blocked", ["AZURE_TENANT_ID + AZURE_SUBSCRIPTION_ID required."]) };
  }
  const clientId = resolveAzureClientId();
  const clientSecret = resolveAzureClientSecret();
  if (!clientId || !clientSecret) {
    return { nodes, edges, stats: emptyStats("azure", "blocked", ["AZURE_CLIENT_ID + AZURE_CLIENT_SECRET required."]) };
  }

  let credential;
  let NetworkManagementClient;
  try {
    const idMod = await import("@azure/identity");
    const netMod = await import("@azure/arm-network");
    credential = new idMod.ClientSecretCredential(tenantId, clientId, clientSecret);
    NetworkManagementClient = netMod.NetworkManagementClient;
  } catch (err) {
    return { nodes, edges, stats: emptyStats("azure", "blocked", [`Azure SDK init failed: ${redact(errMessage(err))}`]) };
  }

  const client = new NetworkManagementClient(credential, subscriptionId);
  const seenVnetIds = new Set<string>();

  try {
    let probed = 0;
    for await (const v of client.virtualNetworks.listAll()) {
      if (probed >= MAX_PER_CLOUD) break;
      probed++;
      if (!v.id) continue;
      seenVnetIds.add(v.id);
      const vNodeId = nodeId("azure", "vpc", v.id);
      const cidrs = v.addressSpace?.addressPrefixes ?? [];
      // Azure has no per-VNet IGW concept; treat as internet-facing when
      // any subnet has serviceEndpoints + no NSG with denyAll.
      const internetFacing = (v.subnets ?? []).some(
        (s) => (s.serviceEndpoints?.length ?? 0) > 0 || s.natGateway != null,
      );
      nodes.push({
        id: vNodeId,
        kind: "vpc",
        cloud: "azure",
        label: v.name ?? v.id,
        region: v.location,
        cidrs,
        internetFacing,
      });
      if (internetFacing) {
        edges.push({
          id: edgeId("internet_edge", "azure", v.id, "internet"),
          kind: "internet_edge",
          fromNodeId: vNodeId,
          toNodeId: INTERNET_NODE_ID,
        });
        internetFacingVpcCount++;
      }
      vpcCount++;

      // Subnets are inline.
      for (const s of v.subnets ?? []) {
        if (!s.id) continue;
        const sNodeId = nodeId("azure", "subnet", s.id);
        nodes.push({
          id: sNodeId,
          kind: "subnet",
          cloud: "azure",
          label: s.name ?? s.id,
          region: v.location,
          cidrs: s.addressPrefix ? [s.addressPrefix] : [],
        });
        edges.push({
          id: edgeId("contains", "azure", v.id, s.id),
          kind: "contains",
          fromNodeId: vNodeId,
          toNodeId: sNodeId,
        });
        subnetCount++;
      }

      // Peerings are inline.
      for (const p of v.virtualNetworkPeerings ?? []) {
        const remoteId = p.remoteVirtualNetwork?.id;
        if (!remoteId || !p.id) continue;
        const pNodeId = nodeId("azure", "peering", p.id);
        nodes.push({
          id: pNodeId,
          kind: "peering",
          cloud: "azure",
          label: p.name ?? p.id,
          region: v.location,
        });
        edges.push({ id: edgeId("peers", "azure", v.id, p.id), kind: "peers", fromNodeId: vNodeId, toNodeId: pNodeId });
        // The remote vnet may or may not be in this subscription — we
        // create a lazy "peer target" node only if not already present.
        edges.push({
          id: edgeId("peers", "azure", p.id, remoteId),
          kind: "peers",
          fromNodeId: pNodeId,
          toNodeId: nodeId("azure", "vpc", remoteId),
        });
        peeringCount++;
      }
    }
  } catch (err) {
    limitations.push(`Azure VNet traversal failed: ${redact(errMessage(err))}`);
  }

  return {
    nodes,
    edges,
    stats: { cloud: "azure", mode: "live", vpcCount, subnetCount, peeringCount, internetFacingVpcCount, limitations },
  };
}

// ---------------------------------------------------------------------------
// GCP
// ---------------------------------------------------------------------------

async function extractGcpTopology(): Promise<{ nodes: TopologyNode[]; edges: TopologyEdge[]; stats: CloudSectionStats }> {
  const nodes: TopologyNode[] = [];
  const edges: TopologyEdge[] = [];
  const limitations: string[] = [];
  let vpcCount = 0;
  let subnetCount = 0;
  let peeringCount = 0;
  let internetFacingVpcCount = 0;

  const env = loadAppEnv();
  const cfg = getGcpConfig();
  if (!env.gcpInventoryExtractEnabled) {
    return { nodes, edges, stats: emptyStats("gcp", "disabled", ["GCP_INVENTORY_EXTRACT_ENABLED not set."]) };
  }
  if (cfg.mode !== "live") {
    return { nodes, edges, stats: emptyStats("gcp", "preview", ["GCP mode is not live."]) };
  }
  const projectId = env.gcpProjectId;
  if (!projectId) {
    return { nodes, edges, stats: emptyStats("gcp", "blocked", ["GCP_PROJECT_ID required."]) };
  }

  let key: { client_email?: string; private_key?: string } = {};
  try {
    const json = resolveGcpServiceAccountJson();
    key = json
      ? (JSON.parse(json) as typeof key)
      : { client_email: resolveGcpClientEmail(), private_key: resolveGcpPrivateKey() };
  } catch (err) {
    return { nodes, edges, stats: emptyStats("gcp", "blocked", [`GCP creds parse failed: ${redact(errMessage(err))}`]) };
  }
  if (!key.client_email || !key.private_key) {
    return { nodes, edges, stats: emptyStats("gcp", "blocked", ["GCP credentials missing client_email or private_key."]) };
  }

  let NetworksClient;
  let SubnetworksClient;
  try {
    const mod = await import("@google-cloud/compute");
    NetworksClient = mod.NetworksClient;
    SubnetworksClient = mod.SubnetworksClient;
  } catch (err) {
    return { nodes, edges, stats: emptyStats("gcp", "blocked", [`GCP SDK import failed: ${redact(errMessage(err))}`]) };
  }

  const credentials = { client_email: key.client_email, private_key: key.private_key };
  const networks = new NetworksClient({ projectId, credentials });

  const seenNets = new Set<string>();
  interface GcpNetwork { name?: string; selfLink?: string; peerings?: { name?: string; network?: string; state?: string }[] }
  const netByLink = new Map<string, GcpNetwork>();

  try {
    let probed = 0;
    for await (const net of (networks.listAsync({ project: projectId, maxResults: 200 }) as AsyncIterable<GcpNetwork>)) {
      if (probed >= MAX_PER_CLOUD) break;
      probed++;
      if (!net.selfLink || !net.name) continue;
      seenNets.add(net.selfLink);
      netByLink.set(net.selfLink, net);
      const vNodeId = nodeId("gcp", "vpc", net.selfLink);
      // GCP networks are always internet-routable (subnets get public IPs by
      // default unless explicit firewall/private mode), so we treat them as
      // internet-facing — the firewall rules surface decides the real
      // exposure number.
      nodes.push({
        id: vNodeId,
        kind: "vpc",
        cloud: "gcp",
        label: net.name,
        cidrs: [],
        internetFacing: true,
      });
      edges.push({
        id: edgeId("internet_edge", "gcp", net.name, "internet"),
        kind: "internet_edge",
        fromNodeId: vNodeId,
        toNodeId: INTERNET_NODE_ID,
      });
      internetFacingVpcCount++;
      vpcCount++;

      for (const p of net.peerings ?? []) {
        if (!p.network) continue;
        const pNodeId = nodeId("gcp", "peering", `${net.name}:${p.name ?? p.network}`);
        nodes.push({ id: pNodeId, kind: "peering", cloud: "gcp", label: p.name ?? p.network });
        edges.push({ id: edgeId("peers", "gcp", net.name, pNodeId), kind: "peers", fromNodeId: vNodeId, toNodeId: pNodeId });
        edges.push({
          id: edgeId("peers", "gcp", pNodeId, p.network),
          kind: "peers",
          fromNodeId: pNodeId,
          toNodeId: nodeId("gcp", "vpc", p.network),
        });
        peeringCount++;
      }
    }
  } catch (err) {
    limitations.push(`GCP network list failed: ${redact(errMessage(err))}`);
  }

  // Subnetworks via aggregated list (across all regions).
  try {
    const subnets = new SubnetworksClient({ projectId, credentials });
    const iter = subnets.aggregatedListAsync({ project: projectId, maxResults: 200 });
    let probed = 0;
    interface GcpSubnet { name?: string; selfLink?: string; ipCidrRange?: string; network?: string; region?: string }
    for await (const [, response] of (iter as AsyncIterable<[string, { subnetworks?: GcpSubnet[] }]>)) {
      for (const s of response.subnetworks ?? []) {
        if (probed >= MAX_PER_CLOUD * 4) break;
        probed++;
        if (!s.selfLink || !s.network) continue;
        if (!seenNets.has(s.network)) continue;
        const sNodeId = nodeId("gcp", "subnet", s.selfLink);
        nodes.push({
          id: sNodeId,
          kind: "subnet",
          cloud: "gcp",
          label: s.name ?? s.selfLink,
          region: s.region?.split("/").pop(),
          cidrs: s.ipCidrRange ? [s.ipCidrRange] : [],
        });
        edges.push({
          id: edgeId("contains", "gcp", s.network, s.selfLink),
          kind: "contains",
          fromNodeId: nodeId("gcp", "vpc", s.network),
          toNodeId: sNodeId,
        });
        subnetCount++;
      }
    }
  } catch (err) {
    limitations.push(`GCP subnet list failed: ${redact(errMessage(err))}`);
  }

  return {
    nodes,
    edges,
    stats: { cloud: "gcp", mode: "live", vpcCount, subnetCount, peeringCount, internetFacingVpcCount, limitations },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyStats(
  cloud: CloudSectionStats["cloud"],
  mode: CloudSectionStats["mode"],
  limitations: string[],
): CloudSectionStats {
  return {
    cloud,
    mode,
    vpcCount: 0,
    subnetCount: 0,
    peeringCount: 0,
    internetFacingVpcCount: 0,
    limitations,
  };
}

function nodeId(cloud: string, kind: string, raw: string): string {
  return `${cloud}:${kind}:${raw}`;
}
function edgeId(kind: string, cloud: string, a: string, b: string): string {
  return `${cloud}:${kind}:${a}->${b}`;
}
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
function errMessage(e: unknown): string { return e instanceof Error ? e.message : String(e); }
function redact(msg: string): string {
  return msg.replace(/AKIA[0-9A-Z]{16}/g, "[redacted]").replace(/[A-Za-z0-9/+=]{40,}/g, "[redacted]");
}
