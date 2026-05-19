/**
 * Cross-cloud guardrail policy preview generator.
 *
 * Given the live runbook generator output, this builder emits
 * ready-to-paste policy JSON for the three big policy engines:
 *
 *   • AWS Service Control Policy (Organizations)
 *   • Azure Policy (Microsoft.Authorization/policyDefinitions)
 *   • GCP Organization Policy (constraints/* boolean policies)
 *
 * The JSON is generated from the same recipe table the runbook
 * generator uses, so the preview always matches the suggested
 * hardening. Operators copy the JSON into their existing IaC stack
 * (terraform / cloudformation / arm template / pulumi) — Axiom
 * never attaches the policy directly.
 *
 * Hard rules:
 *   - Read-only. Returns text/JSON. Never calls a mutate API.
 *   - Each output is a *preview* — operator must paste and apply.
 *   - When we don't have a recipe, we emit a "no_preview_available"
 *     entry instead of a hallucinated policy.
 */

import "server-only";

import { generateRemediationRunbooks, type RemediationRunbook } from "./remediationRunbookGenerator";

export type PolicyCloud = "aws" | "azure" | "gcp";

export interface PolicyPreview {
  cloud: PolicyCloud;
  /** Short label (e.g. "Deny s3:DeleteBucket without MFA"). */
  label: string;
  /** One-line description for the dashboard. */
  description: string;
  /** Ready-to-paste JSON string. */
  policyJson: string;
  /** What guardrail tool consumes this JSON. */
  applyHint: string;
}

export interface RunbookPolicyPackage {
  runbookId: string;
  eventName: string;
  severity: string;
  /** Original hardening action label. */
  hardeningLabel: string;
  /** Per-cloud preview policies generated from the recipe. */
  previews: PolicyPreview[];
  /** When the recipe has no preview, list why. */
  notes: string[];
}

export interface PolicyPreviewReport {
  generatedAt: string;
  lookbackMinutes: number;
  totalRunbooks: number;
  totalPackages: number;
  totalPreviews: number;
  packages: RunbookPolicyPackage[];
  durationMs: number;
  limitations: string[];
}

export async function buildPolicyPreviewReport(opts?: { lookbackMinutes?: number }): Promise<PolicyPreviewReport> {
  const start = Date.now();
  const runbookReport = await generateRemediationRunbooks({ lookbackMinutes: opts?.lookbackMinutes });

  const packages: RunbookPolicyPackage[] = [];
  for (const rb of runbookReport.runbooks) {
    if (rb.hardening.risk === "needs_human_triage" && !RECIPE_LIBRARY[rb.eventName]) {
      packages.push({
        runbookId: rb.id,
        eventName: rb.eventName,
        severity: rb.severity,
        hardeningLabel: rb.hardening.label,
        previews: [],
        notes: [`No canonical guardrail preview for ${rb.eventName}. The runbook's hardening action requires human design.`],
      });
      continue;
    }
    const previews = buildPreviewsFor(rb);
    packages.push({
      runbookId: rb.id,
      eventName: rb.eventName,
      severity: rb.severity,
      hardeningLabel: rb.hardening.label,
      previews,
      notes: previews.length === 0
        ? [`No guardrail recipe for ${rb.eventName} on any supported cloud yet.`]
        : [],
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    lookbackMinutes: runbookReport.lookbackMinutes,
    totalRunbooks: runbookReport.totalRunbooks,
    totalPackages: packages.length,
    totalPreviews: packages.reduce((n, p) => n + p.previews.length, 0),
    packages,
    durationMs: Date.now() - start,
    limitations: runbookReport.limitations,
  };
}

// ---------------------------------------------------------------------------
// Recipe library — per CloudTrail eventName, the guardrail policy text.
// ---------------------------------------------------------------------------

interface RecipeEntry {
  aws?: { label: string; description: string; policy: object };
  azure?: { label: string; description: string; policy: object };
  gcp?: { label: string; description: string; policy: object };
}

const RECIPE_LIBRARY: Record<string, RecipeEntry> = {
  PutBucketPublicAccessBlock: {
    aws: {
      label: "Deny PutBucketPublicAccessBlock weakening",
      description: "SCP denying s3:PutPublicAccessBlock + s3:DeletePublicAccessBlock for every principal except a break-glass role tagged BreakGlass=true.",
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "DenyWeakeningS3PublicAccessBlock",
            Effect: "Deny",
            Action: [
              "s3:PutBucketPublicAccessBlock",
              "s3:DeleteBucketPublicAccessBlock",
              "s3:PutAccountPublicAccessBlock",
            ],
            Resource: "*",
            Condition: {
              StringNotEquals: { "aws:PrincipalTag/BreakGlass": "true" },
            },
          },
        ],
      },
    },
    azure: {
      label: "Audit Storage accounts with allowBlobPublicAccess=true",
      description: "Built-in Azure Policy effect: audit any Microsoft.Storage/storageAccounts that has allowBlobPublicAccess=true so Defender for Cloud flags it.",
      policy: {
        properties: {
          displayName: "Storage accounts should disallow public blob access",
          policyType: "Custom",
          mode: "Indexed",
          policyRule: {
            if: {
              allOf: [
                { field: "type", equals: "Microsoft.Storage/storageAccounts" },
                { field: "Microsoft.Storage/storageAccounts/allowBlobPublicAccess", equals: true },
              ],
            },
            then: { effect: "audit" },
          },
        },
      },
    },
    gcp: {
      label: "Enforce publicAccessPrevention on every Storage bucket",
      description: "GCP Organization Policy constraint forcing storage.publicAccessPrevention = enforced across the org.",
      policy: {
        name: "policies/storage.publicAccessPrevention",
        spec: {
          rules: [{ enforce: true }],
        },
      },
    },
  },
  DeleteTrail: {
    aws: {
      label: "Deny CloudTrail tampering",
      description: "SCP denying cloudtrail:DeleteTrail + StopLogging + UpdateTrail for non-break-glass principals.",
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "DenyCloudTrailTampering",
            Effect: "Deny",
            Action: [
              "cloudtrail:DeleteTrail",
              "cloudtrail:StopLogging",
              "cloudtrail:UpdateTrail",
              "cloudtrail:PutEventSelectors",
            ],
            Resource: "*",
            Condition: {
              StringNotEquals: { "aws:PrincipalTag/BreakGlass": "true" },
            },
          },
        ],
      },
    },
  },
  StopLogging: {
    aws: {
      label: "Deny CloudTrail StopLogging",
      description: "Same shape as DeleteTrail recipe — included as its own entry so the runbook → preview mapping stays 1:1.",
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "DenyStopLoggingExceptBreakGlass",
            Effect: "Deny",
            Action: "cloudtrail:StopLogging",
            Resource: "*",
            Condition: {
              StringNotEquals: { "aws:PrincipalTag/BreakGlass": "true" },
            },
          },
        ],
      },
    },
  },
  AuthorizeSecurityGroupIngress: {
    aws: {
      label: "Deny 0.0.0.0/0 on admin ports",
      description: "SCP denying AuthorizeSecurityGroupIngress when source is 0.0.0.0/0 AND target port covers 22 / 3389 / 3306 / 5432.",
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "DenyOpenAdminPorts",
            Effect: "Deny",
            Action: "ec2:AuthorizeSecurityGroupIngress",
            Resource: "*",
            Condition: {
              StringEquals: { "ec2:SourceCidr": "0.0.0.0/0" },
              NumericEquals: { "ec2:FromPort": [22, 3389, 3306, 5432] },
            },
          },
        ],
      },
    },
    azure: {
      label: "Deny NSG rules with source = Internet on admin ports",
      description: "Azure Policy denying creation of NSG rules with sourceAddressPrefix=Internet (or *) when destinationPortRange includes 22 / 3389.",
      policy: {
        properties: {
          displayName: "NSGs should not expose admin ports to the internet",
          policyType: "Custom",
          mode: "Indexed",
          policyRule: {
            if: {
              allOf: [
                { field: "type", equals: "Microsoft.Network/networkSecurityGroups/securityRules" },
                {
                  anyOf: [
                    { field: "Microsoft.Network/networkSecurityGroups/securityRules/sourceAddressPrefix", equals: "Internet" },
                    { field: "Microsoft.Network/networkSecurityGroups/securityRules/sourceAddressPrefix", equals: "*" },
                  ],
                },
                { field: "Microsoft.Network/networkSecurityGroups/securityRules/access", equals: "Allow" },
                {
                  anyOf: [
                    { field: "Microsoft.Network/networkSecurityGroups/securityRules/destinationPortRange", equals: "22" },
                    { field: "Microsoft.Network/networkSecurityGroups/securityRules/destinationPortRange", equals: "3389" },
                  ],
                },
              ],
            },
            then: { effect: "deny" },
          },
        },
      },
    },
    gcp: {
      label: "Enforce restrict-default-network constraint",
      description: "Organization Policy enabling constraints/compute.skipDefaultNetworkCreation + restricting source ranges on firewall rules.",
      policy: {
        name: "policies/compute.skipDefaultNetworkCreation",
        spec: { rules: [{ enforce: true }] },
      },
    },
  },
  DisableKey: {
    aws: {
      label: "Deny kms:DisableKey on prod keys",
      description: "SCP scoped to KMS keys tagged Env=prod denying kms:DisableKey + kms:ScheduleKeyDeletion.",
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "DenyKmsTamperingOnProd",
            Effect: "Deny",
            Action: ["kms:DisableKey", "kms:ScheduleKeyDeletion"],
            Resource: "*",
            Condition: {
              StringEquals: { "aws:ResourceTag/Env": "prod" },
              StringNotEquals: { "aws:PrincipalTag/BreakGlass": "true" },
            },
          },
        ],
      },
    },
  },
  ScheduleKeyDeletion: {
    aws: {
      label: "Deny kms:ScheduleKeyDeletion on prod keys",
      description: "Same SCP as DisableKey but listed separately so the runbook mapping is exact.",
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "DenyScheduleKeyDeletionOnProd",
            Effect: "Deny",
            Action: "kms:ScheduleKeyDeletion",
            Resource: "*",
            Condition: {
              StringEquals: { "aws:ResourceTag/Env": "prod" },
              StringNotEquals: { "aws:PrincipalTag/BreakGlass": "true" },
            },
          },
        ],
      },
    },
  },
  TerminateInstances: {
    aws: {
      label: "Require termination protection on Persistent=true instances",
      description: "SCP denying ec2:ModifyInstanceAttribute when modifying disableApiTermination=false on instances tagged Persistent=true.",
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "DenyDisableTerminationProtectionOnPersistent",
            Effect: "Deny",
            Action: "ec2:ModifyInstanceAttribute",
            Resource: "*",
            Condition: {
              StringEquals: { "aws:ResourceTag/Persistent": "true" },
            },
          },
        ],
      },
    },
  },
  CreateAccessKey: {
    aws: {
      label: "Deny iam:CreateAccessKey for everyone except break-glass",
      description: "SCP denying iam:CreateAccessKey on all IAM users except those tagged BreakGlass=true.",
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "DenyAccessKeyCreation",
            Effect: "Deny",
            Action: "iam:CreateAccessKey",
            Resource: "*",
            Condition: {
              StringNotEquals: { "aws:PrincipalTag/BreakGlass": "true" },
            },
          },
        ],
      },
    },
  },
  AttachUserPolicy: {
    aws: {
      label: "Require permission boundary on IAM users",
      description: "SCP requiring iam:PermissionsBoundary on iam:CreateUser + iam:AttachUserPolicy calls.",
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "RequirePermissionsBoundary",
            Effect: "Deny",
            Action: ["iam:CreateUser", "iam:AttachUserPolicy"],
            Resource: "*",
            Condition: {
              "Null": { "iam:PermissionsBoundary": "true" },
            },
          },
        ],
      },
    },
  },
  DeleteBucket: {
    aws: {
      label: "Require MFA on s3:DeleteBucket",
      description: "SCP denying s3:DeleteBucket when MFA isn't present on the calling session.",
      policy: {
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "RequireMfaOnDeleteBucket",
            Effect: "Deny",
            Action: "s3:DeleteBucket",
            Resource: "*",
            Condition: {
              BoolIfExists: { "aws:MultiFactorAuthPresent": "false" },
            },
          },
        ],
      },
    },
  },
};

function buildPreviewsFor(rb: RemediationRunbook): PolicyPreview[] {
  const entry = RECIPE_LIBRARY[rb.eventName];
  if (!entry) return [];
  const out: PolicyPreview[] = [];

  if (entry.aws) {
    out.push({
      cloud: "aws",
      label: entry.aws.label,
      description: entry.aws.description,
      policyJson: JSON.stringify(entry.aws.policy, null, 2),
      applyHint: "Attach via Organizations > Policies > Service control policies — or paste into your terraform `aws_organizations_policy` resource.",
    });
  }
  if (entry.azure) {
    out.push({
      cloud: "azure",
      label: entry.azure.label,
      description: entry.azure.description,
      policyJson: JSON.stringify(entry.azure.policy, null, 2),
      applyHint: "Create via Azure Policy > Definitions — or use your terraform `azurerm_policy_definition` + assign to the management group.",
    });
  }
  if (entry.gcp) {
    out.push({
      cloud: "gcp",
      label: entry.gcp.label,
      description: entry.gcp.description,
      policyJson: JSON.stringify(entry.gcp.policy, null, 2),
      applyHint: "Apply via `gcloud org-policies set-policy POLICY_FILE.json --organization=ORG_ID` — or use terraform `google_org_policy_policy`.",
    });
  }
  return out;
}
