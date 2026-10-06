/**
 * AI workflow translator.
 *
 * Takes a one-line natural language operator intent ("when an S3 bucket
 * gets public ACL, page security and stage a remediation runbook")
 * and produces a structured workflow draft the operator can review
 * before pinning. This is a DRAFT generator only — Axiom never applies
 * a workflow on its own. (Approval-only-no-execution.)
 *
 * Pure orchestration around extractStructuredData. Never throws.
 */

import "server-only";
import { getAIProviderManager } from "@/lib/ai/AIProviderManager";
import { loadWorkspaceAIProviderPolicyWithState, resolveWorkspaceAIProviderPolicy } from "@/lib/ai/workspaceProviderPolicy";
import { checkWorkspaceAICredits } from "@/lib/billing/checkWorkspaceAICredits";

const ALLOWED_TRIGGER_KINDS = [
  "telemetry_signal", "cloud_inventory_change", "schedule", "manual",
] as const;
export type TriggerKind = (typeof ALLOWED_TRIGGER_KINDS)[number];

const ALLOWED_ACTION_KINDS = [
  "notify_outbound", "stage_runbook", "stage_policy_proposal",
  "open_approval_packet", "log_audit_only",
] as const;
export type ActionKind = (typeof ALLOWED_ACTION_KINDS)[number];

export interface WorkflowDraft {
  name: string;
  description: string;
  trigger: { kind: TriggerKind; selector: string };
  actions: Array<{ kind: ActionKind; label: string; reason?: string }>;
}

export interface TranslateResult {
  draft: WorkflowDraft | null;
  aiUsed: boolean;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  /** Reason for null draft (e.g. "model_returned_invalid_trigger_kind"). */
  rejectionReason?: string;
}

const SCHEMA_HINT = `{
  "name": "string (5-80 chars)",
  "description": "string (10-300 chars)",
  "trigger": { "kind": "telemetry_signal | cloud_inventory_change | schedule | manual", "selector": "string" },
  "actions": [ { "kind": "notify_outbound | stage_runbook | stage_policy_proposal | open_approval_packet | log_audit_only", "label": "string", "reason": "string (optional)" } ]
}`;

const SYSTEM = [
  "You translate operator natural-language intent into a JSON workflow DRAFT for an AGI ops platform.",
  "Hard rules: Axiom NEVER auto-applies workflows — your draft is reviewed by humans.",
  "Allowed trigger kinds: telemetry_signal, cloud_inventory_change, schedule, manual.",
  "Allowed action kinds: notify_outbound, stage_runbook, stage_policy_proposal, open_approval_packet, log_audit_only.",
  "Never propose execution actions like 'apply_change' or 'rollback'. Stage only.",
  "Reply with strictly ONE JSON object — no prose, no markdown.",
].join(" ");

const isValidTrigger = (t: unknown): t is { kind: string; selector: string } =>
  t !== null && typeof t === "object" && !Array.isArray(t)
  && typeof (t as { kind?: unknown }).kind === "string"
  && typeof (t as { selector?: unknown }).selector === "string";

export async function translateWorkflowIntent(intent: string, organizationId: string): Promise<TranslateResult> {
  const fallback: TranslateResult = {
    draft: null, aiUsed: false, provider: null, model: null, latencyMs: 0,
    rejectionReason: "ai_unavailable_or_mock",
  };
  if (!intent || intent.trim().length === 0) {
    return { ...fallback, rejectionReason: "empty_intent" };
  }
  try {
    const mgr = getAIProviderManager();
    // This workflow-drafting call previously went straight to the AI
    // manager with no workspace scoping at all — not even an
    // organizationId. A workspace could have a provider explicitly
    // disallowed in its own AI settings and this call would still use
    // whatever the service has configured, unmetered and unaudited.
    // Load and enforce the workspace's policy the same way
    // /api/ai/generate and lib/insights/tenantInsightsSynthesizer do;
    // fail closed (same as "only mock available") when the policy
    // can't be resolved, is disabled, has no allowed providers, or the
    // workspace's AI budget is exhausted.
    const serviceEnabled = mgr.status()
      .filter((provider) => provider.configured && provider.provider !== "mock")
      .map((provider) => provider.provider);
    const loadedPolicy = await loadWorkspaceAIProviderPolicyWithState(organizationId).catch(() => null);
    if (!loadedPolicy || loadedPolicy.storageState !== "ready") {
      return { ...fallback, rejectionReason: "workspace_ai_policy_unavailable" };
    }
    const policy = resolveWorkspaceAIProviderPolicy({ stored: loadedPolicy.policy, serviceEnabled });
    if (!policy.enabled || policy.allowedProviders.length === 0) {
      return { ...fallback, rejectionReason: "ai_unavailable_or_mock" };
    }
    const creditDecision = await checkWorkspaceAICredits(
      organizationId,
      0,
      { failClosedOnUsageReadError: true },
    ).catch(() => null);
    if (!creditDecision || creditDecision.kind === "block") {
      return { ...fallback, rejectionReason: "workspace_ai_credit_unavailable" };
    }
    const r = await mgr.extractStructuredData<unknown>(
      intent,
      SCHEMA_HINT,
      {
        system: SYSTEM,
        temperature: 0,
        maxTokens: 4096,
        timeoutMs: 15_000,
        organizationId,
        allowedProviders: policy.allowedProviders,
        modelSelections: policy.modelSelections,
        fallbackOrder: policy.fallbackOrder,
      },
    );
    if (r.provider === "mock") return { ...fallback, latencyMs: r.latencyMs };
    const data = r.data as Partial<WorkflowDraft> | null;
    if (!data || typeof data !== "object") {
      return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "model_returned_non_object" };
    }
    if (typeof data.name !== "string" || data.name.length < 5 || data.name.length > 80) {
      return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "invalid_name" };
    }
    if (typeof data.description !== "string" || data.description.length < 10 || data.description.length > 300) {
      return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "invalid_description" };
    }
    if (!isValidTrigger(data.trigger) || !(ALLOWED_TRIGGER_KINDS as readonly string[]).includes(data.trigger.kind)) {
      return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "model_returned_invalid_trigger_kind" };
    }
    if (!Array.isArray(data.actions) || data.actions.length === 0 || data.actions.length > 6) {
      return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "invalid_action_count" };
    }
    const actions: WorkflowDraft["actions"] = [];
    for (const a of data.actions) {
      if (!a || typeof a !== "object" || Array.isArray(a)) {
        return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "model_returned_invalid_action_object" };
      }
      const k = (a as { kind?: unknown }).kind;
      const label = (a as { label?: unknown }).label;
      const reason = (a as { reason?: unknown }).reason;
      if (typeof k !== "string" || !(ALLOWED_ACTION_KINDS as readonly string[]).includes(k)) {
        return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "model_returned_invalid_action_kind" };
      }
      if (typeof label !== "string" || label.length === 0) {
        return { ...fallback, provider: r.provider, model: r.model, latencyMs: r.latencyMs, rejectionReason: "missing_action_label" };
      }
      actions.push({
        kind: k as ActionKind,
        label,
        reason: typeof reason === "string" && reason.length > 0 ? reason : undefined,
      });
    }
    const draft: WorkflowDraft = {
      name: data.name,
      description: data.description,
      trigger: { kind: data.trigger.kind as TriggerKind, selector: data.trigger.selector },
      actions,
    };
    return { draft, aiUsed: true, provider: r.provider, model: r.model, latencyMs: r.latencyMs };
  } catch {
    return { ...fallback, rejectionReason: "provider_threw" };
  }
}
