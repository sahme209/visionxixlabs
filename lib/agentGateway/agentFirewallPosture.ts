/**
 * Agent action firewall posture (agentic automation priority 1). Pure.
 *
 * Lists the rules V19 always enforces for AI agents, and findings from this workspace's own
 * configuration that weaken them, each with the one thing to do about it. It reads configuration
 * only; it never changes keys or environments.
 */
export interface FirewallApiKey { name: string; scopes: unknown; expiresAt: Date | null; revokedAt: Date | null }
export interface FirewallEnvironment { name: string; tier: string; changeWindowRuleJson: unknown; approvalPolicyId: string | null }
export type FirewallSeverity = "warning" | "suggestion";
export interface FirewallFinding { id: string; severity: FirewallSeverity; title: string; fix: string; subjects: string[] }

export const ALWAYS_ENFORCED: ReadonlyArray<{ id: string; rule: string }> = [
  { id: "no-agent-credentials", rule: "Agents never receive provider credentials. Their API keys can only ask; V19 runs an approved action with its own short-lived provider token." },
  { id: "approved-exact-action", rule: "Writes, deployments and configuration changes run only after a person approves that exact action. The action is checked against what was approved immediately before it runs." },
  { id: "same-release-gates", rule: "An approved Agent deployment faces the same change window, freezes, deployment checks and rings as a person's, and has no emergency bypass." },
  { id: "no-production-secrets", rule: "Production secret reads and deletes requested through the gateway are always refused." },
];

const scopesOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === "string") : []);

export function firewallPosture(input: { now: Date; apiKeys: readonly FirewallApiKey[]; environments: readonly FirewallEnvironment[] }): FirewallFinding[] {
  const active = input.apiKeys.filter((k) => !k.revokedAt && (!k.expiresAt || k.expiresAt > input.now));
  const findings: FirewallFinding[] = [];
  const broad = active.filter((k) => scopesOf(k.scopes).some((s) => s === "*" || s === "pipeline:trigger" || s === "pipeline:*"));
  if (broad.length) findings.push({ id: "broad-key", severity: "warning", title: "API keys that can start pipelines without the gateway", fix: "Give agents keys with only governance:read and governance:request, and revoke these if an agent uses them.", subjects: broad.map((k) => k.name).sort() });
  const neverExpire = active.filter((k) => !k.expiresAt && scopesOf(k.scopes).some((s) => s.startsWith("governance:")));
  if (neverExpire.length) findings.push({ id: "agent-key-no-expiry", severity: "suggestion", title: "Agent keys that never expire", fix: "Create agent keys with an expiry so a forgotten agent loses access on its own.", subjects: neverExpire.map((k) => k.name).sort() });
  const prod = input.environments.filter((e) => e.tier === "prod");
  const noApproval = prod.filter((e) => !e.approvalPolicyId);
  if (noApproval.length) findings.push({ id: "prod-no-approval-policy", severity: "warning", title: "Production environments without an approval policy", fix: "Attach an approval policy so production changes need a named approver.", subjects: noApproval.map((e) => e.name).sort() });
  const noWindow = prod.filter((e) => e.changeWindowRuleJson === null || e.changeWindowRuleJson === undefined);
  if (noWindow.length) findings.push({ id: "prod-no-change-window", severity: "suggestion", title: "Production environments that accept deployments at any time", fix: "Set a change window or a freeze in desktop Settings → Environments.", subjects: noWindow.map((e) => e.name).sort() });
  return findings;
}
