/**
 * AI/copilot safety evidence.
 *
 * The honest answer to the enterprise question "what does your AI see and
 * what can it do?". Distinct from `copilotSafety.ts` (forbidden phrases)
 * and `safeContext.ts` (the redactor pipeline) — this module *describes*
 * what those guardrails do in a form the Trust Center can render and
 * export.
 */

import type { ConnectorPermissionEvidence } from "@/lib/connectors/permissionEvidence";

export type SafetyControlState = "implemented" | "partial" | "planned";

export interface AiSafetyControl {
  id: string;
  label: string;
  description: string;
  state: SafetyControlState;
  /** Source modules a reviewer can read. */
  sources: string[];
}

export interface AiSafetyEvidence {
  controls: AiSafetyControl[];
  /** Plain-language Q&A for the Trust Center. */
  qa: { question: string; answer: string }[];
  /** Models / providers Axiom is configured to call. */
  providers: { name: string; via: string; classification: "first_party" | "anthropic" | "openai" | "other" }[];
  /** What the AI has *no* way of seeing. */
  noContextLeaks: string[];
}

export function buildAiSafetyEvidence(connectorEvidence: ConnectorPermissionEvidence[] = []): AiSafetyEvidence {
  void connectorEvidence;
  return {
    controls: [
      {
        id: "ai.context.redaction",
        label: "Redaction before every LLM call",
        description:
          "Every prompt passes through buildSafeContext(): blocked-field stripping (passwords, tokens, " +
          "vault refs, private keys, …), deep redaction, size cap (24 KB), and tenant-scope tagging.",
        state: "implemented",
        sources: ["lib/agent/safeContext.ts", "lib/security/redaction.ts"],
      },
      {
        id: "ai.context.tenant_scope",
        label: "Tenant scope attached to every prompt",
        description:
          "The system prompt header explicitly names the tenant and the data source (live / preview / " +
          "demo). The model can't claim a fact comes from a different tenant.",
        state: "implemented",
        sources: ["lib/agent/safeContext.ts"],
      },
      {
        id: "ai.intent.classification",
        label: "Inbound intent classification",
        description:
          "Every user question runs through classifyCopilotIntent() — credential queries and privilege-" +
          "escalation prompts are blocked outright before reaching the model.",
        state: "implemented",
        sources: ["lib/agent/copilotSecurity.ts"],
      },
      {
        id: "ai.outbound.guardrails",
        label: "Outbound response guardrails",
        description:
          "Responses pass through enforceResponseGuardrails(): false-execution claims are stripped, " +
          "redaction runs once more, and the source tag is prepended when not live.",
        state: "implemented",
        sources: ["lib/agent/copilotSecurity.ts"],
      },
      {
        id: "ai.no.execution",
        label: "AI cannot execute changes",
        description:
          "The copilot proposes; it never executes. Execution requires a typed ExecutionPlanCandidate, " +
          "a policy decision, an approval, and a desktop handoff. The copilot can describe these, " +
          "never trigger them.",
        state: "implemented",
        sources: ["lib/agent/operationsCopilot.ts", "lib/safety/approvalPolicy.ts"],
      },
      {
        id: "ai.policy.aware",
        label: "Policy-aware answers",
        description:
          "When a user asks about a blocked plan, the copilot delegates to composeReliabilityAnswer() " +
          "and answers from the actual policy / classified failure. It will never suggest bypassing a " +
          "policy decision.",
        state: "implemented",
        sources: ["lib/agent/copilotReliabilityIntent.ts", "lib/agent/operationsCopilot.ts"],
      },
      {
        id: "ai.audit.attached",
        label: "Sensitive copilot interactions audited",
        description:
          "Queries classified as escalation, credential, or operational-change are recorded in the audit " +
          "log with the intent, the user, and the response disposition.",
        state: "partial",
        sources: ["lib/audit/secureAudit.ts"],
      },
    ],
    qa: [
      {
        question: "Can the AI see my credentials?",
        answer:
          "No. The redactor strips 22 credential patterns and 30 sensitive key names before any prompt " +
          "is built. Vault references and encrypted blobs are excluded structurally — they're never even " +
          "considered for the prompt.",
      },
      {
        question: "Can the AI execute changes?",
        answer:
          "No. The copilot proposes only. Execution requires a typed execution plan, a server-side " +
          "policy decision, an approval, and (for local apply) a signed desktop handoff. The model never " +
          "triggers any of those.",
      },
      {
        question: "Can the AI bypass approval?",
        answer:
          "No. Approval is a server-side gate evaluated by lib/safety/approvalPolicy.ts. The copilot can " +
          "describe approval state but cannot grant one — and the response guardrail strips any " +
          "phrasing that claims a bypass.",
      },
      {
        question: "What data does the AI see?",
        answer:
          "Only redacted, tenant-scoped operational facts attached to the user's current screen / " +
          "question. The data classification taxonomy decides what's eligible: anything marked " +
          "credential_secret or pii is never sent. Anything ai_context_restricted is redacted first.",
      },
      {
        question: "Which AI providers are configured?",
        answer:
          "First-party reasoning runs on Anthropic and OpenAI models when keys are configured. " +
          "If keys are missing, the copilot degrades to typed-state-only answers — no model call.",
      },
      {
        question: "Was the answer based on real data or preview data?",
        answer:
          "Every response carries the data-source tag. When the source is preview or demo, the response " +
          "is prefixed with a banner so the user knows the answer is illustrative.",
      },
    ],
    providers: [
      { name: "Anthropic Claude",  via: "@anthropic-ai/sdk",  classification: "anthropic" },
      { name: "OpenAI GPT-4o",     via: "openai",             classification: "openai" },
      { name: "Typed-state only",  via: "lib/agent/operationsCopilot.ts", classification: "first_party" },
    ],
    noContextLeaks: [
      "Connector credentials (raw or encrypted)",
      "Vault references",
      "Other tenants' data",
      "Server stack traces",
      "Cookie / session token values",
      "Audit row bodies marked credential_secret",
    ],
  };
}

export function summarizeAiSafety(evidence: AiSafetyEvidence): { implemented: number; partial: number; planned: number; total: number } {
  let implemented = 0, partial = 0, planned = 0;
  for (const c of evidence.controls) {
    if (c.state === "implemented") implemented++;
    else if (c.state === "partial") partial++;
    else planned++;
  }
  return { implemented, partial, planned, total: evidence.controls.length };
}
