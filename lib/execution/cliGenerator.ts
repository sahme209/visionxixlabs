/**
 * CLI command generator — emits AWS CLI command sequences for plan previews.
 * Companion to terraformGenerator.ts; same safety guarantees.
 */

import type { ReasonedRecommendation } from "@/lib/agent/snapshotReasoner";
import type { ResourceRef } from "@/lib/cloud/snapshotModel";

export interface CliArtifact {
  filename: string;
  content: string;
  commands: { description: string; command: string }[];
  assumptions: string[];
  warnings: string[];
  rollbackCommands: { description: string; command: string }[];
  hasDestructiveIntent: boolean;
  bytes: number;
}

export function generateCliPreview(
  rec: ReasonedRecommendation,
  affectedResources: ResourceRef[]
): CliArtifact {
  const action = rec.action.toLowerCase();
  const provider = affectedResources[0]?.provider ?? "aws";
  const region = affectedResources[0]?.region ?? "us-east-1";

  if (provider !== "aws") {
    return buildUnsupported(rec, affectedResources, `${provider} CLI generation is part of the provider's expanding lifecycle.`);
  }

  if (/destroy|delete|terminate|drop|remove/.test(action)) {
    return buildBlocked(rec, affectedResources, "Destructive CLI commands require explicit risk acknowledgement.");
  }

  if (/right-?size/.test(action)) return generateRightsizeCli(rec, affectedResources, region);
  if (/tag/.test(action)) return generateTagCli(rec, affectedResources, region);
  if (/lifecycle/.test(action)) return generateLifecycleCli(rec, affectedResources, region);

  return generateGenericCli(rec, affectedResources, region);
}

function generateRightsizeCli(rec: ReasonedRecommendation, refs: ResourceRef[], region: string): CliArtifact {
  const target = inferTarget(rec.action);
  const commands: { description: string; command: string }[] = [];
  const rollback: { description: string; command: string }[] = [];

  for (const ref of refs) {
    commands.push({
      description: `Pre-flight: capture snapshot of ${ref.id}`,
      command: `aws ec2 create-image --instance-id ${ref.id} --name "axiom-preflight-${ref.id}" --no-reboot --region ${region}`,
    });
    commands.push({
      description: `Stop ${ref.id}`,
      command: `aws ec2 stop-instances --instance-ids ${ref.id} --region ${region}`,
    });
    commands.push({
      description: `Modify instance type to ${target}`,
      command: `aws ec2 modify-instance-attribute --instance-id ${ref.id} --instance-type "{\\"Value\\":\\"${target}\\"}" --region ${region}`,
    });
    commands.push({
      description: `Start ${ref.id}`,
      command: `aws ec2 start-instances --instance-ids ${ref.id} --region ${region}`,
    });

    rollback.push({
      description: `Rollback: restore prior instance type`,
      command: `aws ec2 modify-instance-attribute --instance-id ${ref.id} --instance-type "{\\"Value\\":\\"$PRIOR_TYPE\\"}" --region ${region}`,
    });
  }

  return {
    filename: `${rec.id}_rightsize.sh`,
    content: assembleScript(rec, commands),
    commands,
    assumptions: [
      `Target instance type: ${target}.`,
      "Pre-flight AMI is created before any stop.",
      "ALB drain is configured externally.",
    ],
    warnings: [
      "Instances must be stopped to modify type — ~2 minutes downtime per instance.",
      "Run with --dry-run first if the CLI is being executed directly.",
    ],
    rollbackCommands: rollback,
    hasDestructiveIntent: false,
    bytes: 0,
  };
}

function generateTagCli(rec: ReasonedRecommendation, refs: ResourceRef[], region: string): CliArtifact {
  const commands: { description: string; command: string }[] = refs.map((ref) => ({
    description: `Tag ${ref.id}`,
    command: `aws ec2 create-tags --resources ${ref.id} --tags Key=Managed_By,Value=axiom-agent Key=Plan_Id,Value=${rec.id} --region ${region}`,
  }));

  return {
    filename: `${rec.id}_tag.sh`,
    content: assembleScript(rec, commands),
    commands,
    assumptions: ["Existing tags are preserved."],
    warnings: [],
    rollbackCommands: refs.map((ref) => ({
      description: `Remove Axiom tags`,
      command: `aws ec2 delete-tags --resources ${ref.id} --tags Key=Managed_By Key=Plan_Id --region ${region}`,
    })),
    hasDestructiveIntent: false,
    bytes: 0,
  };
}

function generateLifecycleCli(rec: ReasonedRecommendation, refs: ResourceRef[], region: string): CliArtifact {
  const commands: { description: string; command: string }[] = refs.map((ref) => ({
    description: `Apply lifecycle policy to ${ref.id}`,
    command: `aws s3api put-bucket-lifecycle-configuration --bucket ${ref.id} --lifecycle-configuration file://${rec.id}_lifecycle.json --region ${region}`,
  }));

  return {
    filename: `${rec.id}_lifecycle.sh`,
    content: assembleScript(rec, commands),
    commands,
    assumptions: [
      "Lifecycle JSON file is co-located with the script.",
      "Existing lifecycle config is fully replaced — review prior config first.",
    ],
    warnings: [
      "Lifecycle changes affect all objects in the bucket.",
      "Glacier transitions have retrieval cost + latency.",
    ],
    rollbackCommands: refs.map((ref) => ({
      description: `Restore prior lifecycle config (captured pre-flight)`,
      command: `aws s3api put-bucket-lifecycle-configuration --bucket ${ref.id} --lifecycle-configuration file://${rec.id}_lifecycle_prior.json --region ${region}`,
    })),
    hasDestructiveIntent: false,
    bytes: 0,
  };
}

function generateGenericCli(rec: ReasonedRecommendation, refs: ResourceRef[], region: string): CliArtifact {
  void region;
  return {
    filename: `${rec.id}_review.sh`,
    content: `#!/usr/bin/env bash\n# Generic preview for: ${rec.action}\n# No automated generator for this action class.\n# Affected: ${refs.map((r) => r.id).join(", ")}\n`,
    commands: [],
    assumptions: ["Axiom does not yet auto-generate CLI for this action class."],
    warnings: ["Manual CLI authoring required."],
    rollbackCommands: [],
    hasDestructiveIntent: false,
    bytes: 0,
  };
}

function buildBlocked(rec: ReasonedRecommendation, refs: ResourceRef[], reason: string): CliArtifact {
  const content =
    `#!/usr/bin/env bash\n` +
    `# BLOCKED · ${reason}\n` +
    `# Plan: ${rec.id}\n` +
    `# Action: ${rec.action}\n` +
    `# Affected: ${refs.map((r) => r.id).join(", ")}\n`;
  return { filename: `${rec.id}_blocked.sh`, content, commands: [], assumptions: [], warnings: [reason], rollbackCommands: [], hasDestructiveIntent: true, bytes: content.length };
}

function buildUnsupported(rec: ReasonedRecommendation, refs: ResourceRef[], reason: string): CliArtifact {
  const content =
    `#!/usr/bin/env bash\n` +
    `# UNSUPPORTED · ${reason}\n` +
    `# Plan: ${rec.id}\n` +
    `# Action: ${rec.action}\n` +
    `# Affected: ${refs.map((r) => r.id).join(", ")}\n`;
  return { filename: `${rec.id}_unsupported.sh`, content, commands: [], assumptions: [], warnings: [reason], rollbackCommands: [], hasDestructiveIntent: false, bytes: content.length };
}

function assembleScript(rec: ReasonedRecommendation, commands: { description: string; command: string }[]): string {
  const lines: string[] = [
    `#!/usr/bin/env bash`,
    `# Axiom Agent — CLI plan preview`,
    `# Plan: ${rec.id}`,
    `# Action: ${rec.action}`,
    `# Risk: ${rec.risk} · Approval: ${rec.approvalRequired ? "required" : "optional"}`,
    `# Confidence: ${(rec.confidence * 100).toFixed(0)}%`,
    `#`,
    `# Run with --dry-run first via your provider CLI if available.`,
    `set -euo pipefail`,
    ``,
  ];
  for (const c of commands) {
    lines.push(`# ${c.description}`);
    lines.push(c.command);
    lines.push(``);
  }
  const content = lines.join("\n");
  return content;
}

function inferTarget(action: string): string {
  const match = action.match(/m\d?\.[a-z]+|t\d?\.[a-z]+|r\d?\.[a-z]+|c\d?\.[a-z]+/i);
  return match ? match[0] : "t3.medium";
}
