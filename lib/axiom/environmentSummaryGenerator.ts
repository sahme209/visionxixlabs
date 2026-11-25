/**
 * Environment summary generation.
 * Summarizes discovery results, IAM findings, and connector status.
 */

import { generate } from "@/lib/ai/orchestrator";
import { publicBillingPolicyEnabled } from "@/lib/billing/publicBillingConfig";

export type EnvironmentSummaryInputs = {
  discovery: {
    ec2Count?: number;
    s3Count?: number;
    rdsCount?: number;
    vpcCount?: number;
    region?: string;
  };
  iamFindings: Array<{
    type?: string;
    severity?: string;
    principal?: string;
    detail?: string;
    summary?: string;
  }>;
  hasIamScan?: boolean;
  connectorStatus: {
    aws?: boolean;
    github?: boolean;
    azure?: boolean;
    gcp?: boolean;
    awsAccountId?: string;
  };
  userId?: string | null;
};

const SYSTEM_PROMPT = `You are an infrastructure analyst. Generate a concise Environment Summary from the provided discovery and security data.

Output format (follow exactly):

**Environment Summary**

**AWS Account:** [account ID or "Not linked" if no AWS]

**Services:**
- [N] EC2 instances
- [N] RDS databases
- [N] S3 buckets
- [N] VPCs

**Security:**
- [Brief IAM findings summary, e.g. "3 IAM users with admin privileges" or "No IAM scan data yet" if empty]

**Recommendations:**
- [2-5 actionable recommendations based on findings, e.g. "rotate unused access keys", "enforce least privilege", "enable MFA for root"]
- If no findings, suggest general best practices.

Keep the summary concise. Use bullet points. No markdown code fences.`;

export async function generateEnvironmentSummary(inputs: EnvironmentSummaryInputs): Promise<string> {
  const { discovery, iamFindings, connectorStatus, userId } = inputs;
  const awsAccount = connectorStatus.awsAccountId ?? (connectorStatus.aws ? "linked" : "Not linked");
  const count = (value: number | undefined, label: string) =>
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? `${value} ${label}` : `${label} count unavailable`;
  const services = [
    count(discovery.ec2Count, "EC2 instances"), count(discovery.rdsCount, "RDS databases"),
    count(discovery.s3Count, "S3 buckets"), count(discovery.vpcCount, "VPCs"),
  ];
  const fallback = [
    "**Environment Summary**", "", `**AWS Account:** ${awsAccount}`, "",
    "**Services:**", ...services.map(service => `- ${service}`),
    ...(discovery.region ? [`- Region: ${discovery.region}`] : []), "",
    "**Security:**",
    ...(inputs.hasIamScan || iamFindings.length > 0
      ? [`- ${iamFindings.length} recorded IAM findings.`, ...iamFindings.slice(0, 5)
        .map(finding => `- ${finding.type ?? "Finding"} (${finding.severity ?? "unknown severity"})`)]
      : ["- No IAM scan results are available."]),
    "", "**Recommendations:**", iamFindings.length > 0
      ? "- Review the recorded IAM findings before making access changes."
      : "- Review discovery results and verify IAM coverage before making changes.",
  ].join("\n");

  // A lead or initiating user does not authorize spending from a workspace.
  if (publicBillingPolicyEnabled()) return fallback;

  const iamSection =
    iamFindings.length > 0
      ? iamFindings
          .slice(0, 15)
          .map(
            (f) =>
              `- ${f.type ?? "Finding"}: ${f.principal ?? "—"} — ${f.detail ?? f.summary ?? "—"} (${f.severity ?? "unknown"})`
          )
          .join("\n")
      : "No IAM scan data.";

  const connectorsLine = Object.entries(connectorStatus)
    .filter(([k, v]) => k !== "awsAccountId" && typeof v === "boolean")
    .map(([k, v]) => `${k}: ${v ? "linked" : "not linked"}`)
    .join(", ");

  const userPrompt = `Discovery results:
- EC2: ${discovery.ec2Count}
- S3: ${discovery.s3Count}
- RDS: ${discovery.rdsCount}
- VPC: ${discovery.vpcCount}
${discovery.region ? `- Region: ${discovery.region}` : ""}

Connectors: ${connectorsLine}
AWS Account ID: ${awsAccount}

IAM findings (${iamFindings.length}):
${iamSection}

Generate the Environment Summary in the exact format specified.`;

  try {
    const res = await generate({
      taskType: "PLAN_STRONG",
      systemPrompt: SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 600,
      temperature: 0.3,
      responseFormat: "text",
      userId: userId ?? undefined,
    });
    return res.text.trim() || fallback;
  } catch {
    return fallback;
  }
}
