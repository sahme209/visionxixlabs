/**
 * AWS IAM Exposure Scan — real read-only scan.
 * Uses @aws-sdk/client-iam and assume-role credentials.
 * Collects users, roles, attached policies; detects AdminAccess, wildcards, unused keys.
 */

import {
  IAMClient,
  ListUsersCommand,
  ListRolesCommand,
  ListAccessKeysCommand,
  GetAccessKeyLastUsedCommand,
  ListAttachedUserPoliciesCommand,
  ListAttachedRolePoliciesCommand,
  GetPolicyCommand,
  GetPolicyVersionCommand,
  ListUserPoliciesCommand,
  ListRolePoliciesCommand,
  GetUserPolicyCommand,
  GetRolePolicyCommand,
} from "@aws-sdk/client-iam";
import { registerExecutionPlugin } from "../executionRegistry";
import { getCredentialProvider } from "../credentials";
import type { ExecutionPluginContext, PluginResult } from "../types";

const ADMIN_POLICY_ARN = "arn:aws:iam::aws:policy/AdministratorAccess";
const UNUSED_DAYS_THRESHOLD = 90;

type IAMCreds = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
};

function createIAMClient(creds: IAMCreds): IAMClient {
  const region = creds.region ?? "us-east-1";
  return new IAMClient({
    region,
    credentials: {
      accessKeyId: creds.accessKeyId,
      secretAccessKey: creds.secretAccessKey,
      sessionToken: creds.sessionToken,
    },
  });
}

function hasWildcardInPolicyDoc(doc: unknown): boolean {
  if (!doc || typeof doc !== "object") return false;
  const d = doc as Record<string, unknown>;
  const statements = Array.isArray(d.Statement) ? d.Statement : [d.Statement];
  for (const stmt of statements) {
    if (!stmt || typeof stmt !== "object") continue;
    const s = stmt as Record<string, unknown>;
    const actions = Array.isArray(s.Action) ? s.Action : s.Action ? [s.Action] : [];
    const resources = Array.isArray(s.Resource) ? s.Resource : s.Resource ? [s.Resource] : [];
    for (const a of actions) {
      if (a === "*" || (typeof a === "string" && a.includes("*"))) return true;
    }
    for (const r of resources) {
      if (r === "*" || (typeof r === "string" && r.includes("*"))) return true;
    }
  }
  return false;
}

function isAdminPolicy(arn: string): boolean {
  return arn === ADMIN_POLICY_ARN || arn.endsWith("/AdministratorAccess");
}

function daysSince(date: Date | undefined): number | null {
  if (!date) return null;
  const now = new Date();
  const ms = now.getTime() - date.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

interface Finding {
  type: string;
  severity: string;
  principal?: string;
  principalType?: string;
  detail: string;
  policyArn?: string;
  accessKeyId?: string;
  daysUnused?: number;
}

async function run(input: Record<string, unknown>, ctx: ExecutionPluginContext): Promise<PluginResult> {
  const logger = ctx.logger;
  logger.info("iam-readonly-scan started", { dryRun: ctx.dryRun });

  if (!ctx.dryRun) {
    return {
      ok: false,
      error: "IAM scan is read-only and must run with dryRun=true for safety.",
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

  const client = createIAMClient(creds);
  const findings: Finding[] = [];
  const users: Array<{
    userName: string;
    arn: string;
    createDate?: string;
    accessKeys: Array<{
      accessKeyId: string;
      status: string;
      createDate?: string;
      lastUsed?: string;
      daysUnused?: number | null;
    }>;
    attachedPolicies: string[];
  }> = [];
  const roles: Array<{
    roleName: string;
    arn: string;
    createDate?: string;
    attachedPolicies: string[];
  }> = [];

  try {
    // 1) IAM users
    let userMarker: string | undefined;
    do {
      const userRes = await client.send(
        new ListUsersCommand({ Marker: userMarker, MaxItems: 100 })
      );
      for (const u of userRes.Users ?? []) {
        if (!u.UserName) continue;
        const attachedArns: string[] = [];
        let polMarker: string | undefined;
        do {
          const polRes = await client.send(
            new ListAttachedUserPoliciesCommand({
              UserName: u.UserName,
              Marker: polMarker,
              MaxItems: 100,
            })
          );
          for (const p of polRes.AttachedPolicies ?? []) {
            if (p.PolicyArn) attachedArns.push(p.PolicyArn);
            if (isAdminPolicy(p.PolicyArn ?? "")) {
              findings.push({
                type: "AdministratorAccess",
                severity: "high",
                principal: u.UserName,
                principalType: "user",
                detail: "AdministratorAccess policy attached to IAM user",
                policyArn: p.PolicyArn,
              });
            }
          }
          polMarker = polRes.Marker;
        } while (polMarker);

        const accessKeys: typeof users[0]["accessKeys"] = [];
        let keyMarker: string | undefined;
        do {
          const keyRes = await client.send(
            new ListAccessKeysCommand({
              UserName: u.UserName,
              Marker: keyMarker,
              MaxItems: 100,
            })
          );
          for (const k of keyRes.AccessKeyMetadata ?? []) {
            if (!k.AccessKeyId) continue;
            let lastUsed: string | undefined;
            let daysUnused: number | null = null;
            try {
              const usedRes = await client.send(
                new GetAccessKeyLastUsedCommand({ AccessKeyId: k.AccessKeyId })
              );
              lastUsed = usedRes.AccessKeyLastUsed?.LastUsedDate?.toISOString();
              const days = daysSince(usedRes.AccessKeyLastUsed?.LastUsedDate);
              if (days !== null && days > UNUSED_DAYS_THRESHOLD) {
                findings.push({
                  type: "UnusedAccessKey",
                  severity: "medium",
                  principal: u.UserName,
                  principalType: "user",
                  detail: `Access key unused for ${days} days`,
                  accessKeyId: k.AccessKeyId,
                  daysUnused: days,
                });
                daysUnused = days;
              }
            } catch {
              lastUsed = undefined;
            }
            accessKeys.push({
              accessKeyId: k.AccessKeyId,
              status: k.Status ?? "Unknown",
              createDate: k.CreateDate?.toISOString(),
              lastUsed,
              daysUnused,
            });
          }
          keyMarker = keyRes.Marker;
        } while (keyMarker);

        users.push({
          userName: u.UserName,
          arn: u.Arn ?? "",
          createDate: u.CreateDate?.toISOString(),
          accessKeys,
          attachedPolicies: attachedArns,
        });
      }
      userMarker = userRes.Marker;
    } while (userMarker);

    // 2) IAM roles
    let roleMarker: string | undefined;
    do {
      const roleRes = await client.send(
        new ListRolesCommand({ Marker: roleMarker, MaxItems: 100 })
      );
      for (const r of roleRes.Roles ?? []) {
        if (!r.RoleName) continue;
        const attachedArns: string[] = [];
        let polMarker: string | undefined;
        do {
          const polRes = await client.send(
            new ListAttachedRolePoliciesCommand({
              RoleName: r.RoleName,
              Marker: polMarker,
              MaxItems: 100,
            })
          );
          for (const p of polRes.AttachedPolicies ?? []) {
            if (p.PolicyArn) attachedArns.push(p.PolicyArn);
            if (isAdminPolicy(p.PolicyArn ?? "")) {
              findings.push({
                type: "AdministratorAccess",
                severity: "high",
                principal: r.RoleName,
                principalType: "role",
                detail: "AdministratorAccess policy attached to IAM role",
                policyArn: p.PolicyArn,
              });
            }
          }
          polMarker = polRes.Marker;
        } while (polMarker);

        roles.push({
          roleName: r.RoleName,
          arn: r.Arn ?? "",
          createDate: r.CreateDate?.toISOString(),
          attachedPolicies: attachedArns,
        });
      }
      roleMarker = roleRes.Marker;
    } while (roleMarker);

    // 3) Wildcard detection — sample attached managed policies
    const policyArnsChecked = new Set<string>();
    for (const u of users) {
      for (const arn of u.attachedPolicies) {
        if (policyArnsChecked.has(arn)) continue;
        policyArnsChecked.add(arn);
        try {
          const polRes = await client.send(new GetPolicyCommand({ PolicyArn: arn }));
          const versionId = polRes.Policy?.DefaultVersionId;
          if (!versionId) continue;
          const verRes = await client.send(
            new GetPolicyVersionCommand({ PolicyArn: arn, VersionId: versionId })
          );
          const docStr = verRes.PolicyVersion?.Document;
          if (!docStr) continue;
          let doc: unknown;
          try {
            doc = typeof docStr === "string" ? JSON.parse(decodeURIComponent(docStr)) : docStr;
          } catch {
            continue;
          }
          if (hasWildcardInPolicyDoc(doc)) {
            findings.push({
              type: "WildcardInPolicy",
              severity: "medium",
              detail: `Policy contains wildcard action or resource`,
              policyArn: arn,
            });
          }
        } catch {
          // Skip if we can't read policy (e.g. AWS managed)
        }
      }
    }
    for (const r of roles) {
      for (const arn of r.attachedPolicies) {
        if (policyArnsChecked.has(arn)) continue;
        policyArnsChecked.add(arn);
        try {
          const polRes = await client.send(new GetPolicyCommand({ PolicyArn: arn }));
          const versionId = polRes.Policy?.DefaultVersionId;
          if (!versionId) continue;
          const verRes = await client.send(
            new GetPolicyVersionCommand({ PolicyArn: arn, VersionId: versionId })
          );
          const docStr = verRes.PolicyVersion?.Document;
          if (!docStr) continue;
          let doc: unknown;
          try {
            doc = typeof docStr === "string" ? JSON.parse(decodeURIComponent(docStr)) : docStr;
          } catch {
            continue;
          }
          if (hasWildcardInPolicyDoc(doc)) {
            findings.push({
              type: "WildcardInPolicy",
              severity: "medium",
              detail: `Policy contains wildcard action or resource`,
              policyArn: arn,
            });
          }
        } catch {
          // Skip
        }
      }
    }

    const summary = `IAM scan: ${users.length} users, ${roles.length} roles, ${findings.length} findings`;
    logger.info("iam-readonly-scan completed", { usersCount: users.length, rolesCount: roles.length, findingsCount: findings.length });

    return {
      ok: true,
      data: {
        status: "scanned",
        region: creds.region ?? "us-east-1",
        users,
        roles,
        findings,
        summary: {
          usersCount: users.length,
          rolesCount: roles.length,
          findingsCount: findings.length,
          findingsByType: findings.reduce(
            (acc, f) => {
              acc[f.type] = (acc[f.type] ?? 0) + 1;
              return acc;
            },
            {} as Record<string, number>
          ),
        },
      },
      summary,
    };
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const msg = err?.message ?? String(e);
    logger.error("iam-readonly-scan failed", { error: msg });
    return {
      ok: false,
      error: msg,
      summary: "IAM scan failed",
    };
  }
}

registerExecutionPlugin({
  id: "aws:iam-readonly-scan",
  name: "IAM Exposure Scan",
  description: "Scan IAM users, roles, policies. Detect AdministratorAccess, wildcards, unused access keys. Read-only.",
  scopesRequired: ["cloud:aws", "cloud:read"],
  readOnly: true,
  run,
});
