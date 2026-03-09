/**
 * AWS Security Group Exposure Scan — read-only.
 * Enumerates EC2 security groups and flags ingress rules that allow
 * unrestricted access (0.0.0.0/0 or ::/0) on sensitive ports.
 * Attaches attached resource counts via DescribeInstances and DescribeNetworkInterfaces.
 * Always requires dryRun=true.
 */

import {
  EC2Client,
  DescribeSecurityGroupsCommand,
  DescribeInstancesCommand,
  DescribeNetworkInterfacesCommand,
  DescribeVpcsCommand,
} from "@aws-sdk/client-ec2";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

type RiskLevel = "medium" | "high" | "critical";

type SGFinding = {
  protocol: string;
  fromPort?: number;
  toPort?: number;
  cidr: string;
  riskLevel: RiskLevel;
  reason: string;
};

type RiskyGroupResult = {
  groupId: string;
  groupName: string;
  vpcId?: string;
  attachedResourceCount?: number;
  findings: SGFinding[];
};

const OPEN_CIDRS = ["0.0.0.0/0", "::/0"];

/** Ports that are considered sensitive when exposed to the world. */
const SENSITIVE_PORTS: Array<{ port: number; label: string; risk: RiskLevel }> = [
  { port: 22, label: "SSH", risk: "critical" },
  { port: 3389, label: "RDP", risk: "critical" },
  { port: 3306, label: "MySQL", risk: "high" },
  { port: 5432, label: "PostgreSQL", risk: "high" },
  { port: 1433, label: "MSSQL", risk: "high" },
  { port: 27017, label: "MongoDB", risk: "high" },
];

/** Return the risk level for a given port range and CIDR. */
function classifyRule(
  fromPort: number | undefined,
  toPort: number | undefined,
  ipProtocol: string
): { riskLevel: RiskLevel; reason: string } | null {
  // Protocol -1 means all traffic
  if (ipProtocol === "-1") {
    return {
      riskLevel: "critical",
      reason: "All traffic (all protocols, all ports) open to the world.",
    };
  }

  // Check full port range (0-65535)
  if (fromPort === 0 && toPort === 65535) {
    return {
      riskLevel: "critical",
      reason: "All ports open to the world.",
    };
  }

  // Check specific sensitive ports
  for (const { port, label, risk } of SENSITIVE_PORTS) {
    if (
      fromPort !== undefined &&
      toPort !== undefined &&
      fromPort <= port &&
      port <= toPort
    ) {
      return {
        riskLevel: risk,
        reason: `Port ${port} (${label}) is open to the world.`,
      };
    }
  }

  // Wide port range (not 0-65535 but more than 1000 ports) is medium
  if (
    fromPort !== undefined &&
    toPort !== undefined &&
    toPort - fromPort >= 1000
  ) {
    return {
      riskLevel: "medium",
      reason: `Wide port range ${fromPort}–${toPort} open to the world (${toPort - fromPort + 1} ports).`,
    };
  }

  // Any non-sensitive port open to the world is still medium
  return {
    riskLevel: "medium",
    reason: `Port ${fromPort ?? "?"}${toPort !== undefined && toPort !== fromPort ? `–${toPort}` : ""} open to the world.`,
  };
}

async function run(
  _input: Record<string, unknown>,
  ctx: ExecutionPluginContext
): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("security-group-exposure-scan started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "Security group exposure scan is read-only and must run with dryRun=true.",
      summary: "Plugin requires dry run.",
    };
  }

  const creds = await getCredentialProvider().getAWSCredentials(ctx.userId, ctx.credentialsKey);
  if (!creds) {
    return {
      ok: false,
      error: "AWS connector not linked or validated. Connect your AWS account in Connectors first.",
      summary: "AWS connector required.",
    };
  }

  const region = creds.region ?? "us-east-1";
  const client = new EC2Client({
    region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });

  try {
    // 1. Fetch all security groups
    const sgRes = await client.send(new DescribeSecurityGroupsCommand({}));
    const groups = sgRes.SecurityGroups ?? [];
    const groupsScanned = groups.length;

    // 2. Fetch VPC names for display
    const vpcRes = await client.send(new DescribeVpcsCommand({}));
    const vpcNameMap = new Map<string, string>();
    for (const vpc of vpcRes.Vpcs ?? []) {
      if (!vpc.VpcId) continue;
      const nameTag = vpc.Tags?.find((t) => t.Key === "Name")?.Value;
      vpcNameMap.set(vpc.VpcId, nameTag ?? vpc.VpcId);
    }

    // 3. Build a map of security group → attached EC2 instance count
    const instanceRes = await client.send(
      new DescribeInstancesCommand({
        Filters: [{ Name: "instance-state-name", Values: ["running", "stopped"] }],
      })
    );
    const sgInstanceCount = new Map<string, number>();
    for (const reservation of instanceRes.Reservations ?? []) {
      for (const instance of reservation.Instances ?? []) {
        for (const sg of instance.SecurityGroups ?? []) {
          if (sg.GroupId) {
            sgInstanceCount.set(sg.GroupId, (sgInstanceCount.get(sg.GroupId) ?? 0) + 1);
          }
        }
      }
    }

    // 4. Build a map of security group → attached ENI count
    const eniRes = await client.send(new DescribeNetworkInterfacesCommand({}));
    const sgEniCount = new Map<string, number>();
    for (const eni of eniRes.NetworkInterfaces ?? []) {
      for (const sg of eni.Groups ?? []) {
        if (sg.GroupId) {
          sgEniCount.set(sg.GroupId, (sgEniCount.get(sg.GroupId) ?? 0) + 1);
        }
      }
    }

    // 5. Analyze ingress rules for each security group
    const riskyGroups: RiskyGroupResult[] = [];

    for (const group of groups) {
      const groupId = group.GroupId ?? "";
      const groupName = group.GroupName ?? "(unnamed)";
      const vpcId = group.VpcId;
      const findings: SGFinding[] = [];

      for (const rule of group.IpPermissions ?? []) {
        const ipProtocol = rule.IpProtocol ?? "";
        const fromPort = rule.FromPort;
        const toPort = rule.ToPort;

        // Collect all open CIDRs (IPv4 + IPv6)
        const openCidrs: string[] = [
          ...(rule.IpRanges?.map((r) => r.CidrIp ?? "").filter((c) => OPEN_CIDRS.includes(c)) ?? []),
          ...(rule.Ipv6Ranges?.map((r) => r.CidrIpv6 ?? "").filter((c) => OPEN_CIDRS.includes(c)) ?? []),
        ];

        for (const cidr of openCidrs) {
          const classification = classifyRule(fromPort, toPort, ipProtocol);
          if (classification) {
            findings.push({
              protocol: ipProtocol === "-1" ? "all" : ipProtocol,
              fromPort: fromPort !== undefined ? fromPort : undefined,
              toPort: toPort !== undefined ? toPort : undefined,
              cidr,
              riskLevel: classification.riskLevel,
              reason: classification.reason,
            });
          }
        }
      }

      if (findings.length > 0) {
        // Sum instance + ENI counts as total attached resources
        const attachedResourceCount =
          (sgInstanceCount.get(groupId) ?? 0) + (sgEniCount.get(groupId) ?? 0);

        riskyGroups.push({
          groupId,
          groupName,
          vpcId,
          attachedResourceCount,
          findings,
        });
      }
    }

    // 6. Build recommendations
    const criticalCount = riskyGroups.filter((g) =>
      g.findings.some((f) => f.riskLevel === "critical")
    ).length;
    const highCount = riskyGroups.filter((g) =>
      g.findings.some((f) => f.riskLevel === "high") && !g.findings.some((f) => f.riskLevel === "critical")
    ).length;

    const recommendations: string[] = [];

    if (criticalCount > 0) {
      recommendations.push(
        `Immediately restrict port 22 (SSH) and/or 3389 (RDP) on ${criticalCount} security group(s) — remove 0.0.0.0/0 and replace with specific IP ranges or a VPN CIDR.`
      );
    }
    if (highCount > 0) {
      recommendations.push(
        `Restrict database ports (MySQL, PostgreSQL, MSSQL, MongoDB) in ${highCount} group(s) — these should never be open to the public internet.`
      );
    }
    recommendations.push(
      "Apply the principle of least privilege — only allow traffic from known CIDRs, security group IDs, or private IP ranges."
    );
    recommendations.push(
      "Enable VPC Flow Logs to audit traffic hitting these security groups and detect unexpected access patterns."
    );
    recommendations.push(
      "Use AWS Network Firewall or a WAF in front of public-facing resources instead of wide security group rules."
    );

    const flaggedCount = riskyGroups.length;
    const summary =
      flaggedCount > 0
        ? `Scanned ${groupsScanned} security group(s). ${flaggedCount} flagged (${criticalCount} critical, ${highCount} high risk).`
        : `Scanned ${groupsScanned} security group(s). No exposed ingress rules found.`;

    logger.info("security-group-exposure-scan completed", {
      groupsScanned,
      flaggedCount,
      criticalCount,
      highCount,
    });

    return {
      ok: true,
      data: {
        groupsScanned,
        riskyGroups,
        recommendations,
      },
      summary,
    };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const msg = err?.message ?? String(e);
    logger.error("security-group-exposure-scan failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "Security group exposure scan failed.",
    };
  }
}

registerExecutionPlugin({
  id: "aws:security-group-exposure-scan",
  name: "AWS Security Group Exposure Scan",
  description:
    "Enumerate EC2 security groups and flag ingress rules allowing unrestricted access (0.0.0.0/0 or ::/0) on sensitive ports (SSH 22, RDP 3389, database ports, all traffic). Returns risk-rated findings per group with attached resource counts. Read-only.",
  scopesRequired: ["cloud:aws", "cloud:read"],
  readOnly: true,
  modifiesInfrastructure: false,
  run,
});
