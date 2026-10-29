# WITHDRAWN after actual provider acceptance

The smaller-hold deployment was rolled back to verified source157f504e after the real task reported 2,683 and 3,717 output tokens for two requests each capped at 1,024. The service recorded 40,894 input and 6,400 output tokens and executed only list_environments. The provider's aggregate output therefore did not satisfy the quoted cap despite Gateway documentation and endpoint metadata. The account's model approval is preserved; no further paid tests are authorized. A server-side pre-admission refusal now protects this concrete multi-agent variant; the Sonnet-only sized capability is restored. No new message-protocol enum is exposed: older desktop clients receive the existing request_failed issue with the clear budget-verification explanation. Settlement remains authoritative and separate from this refusal.

The text below records the withdrawn design, not current verified behavior.

---

# Bounded Grok request reservation

Actual native acceptance of the already approved Grok model stopped before inference because its ordinary request hold exceeded the Free workspace balance. Reloaded billing confirmed six cumulative calls, $1.87 available and zero held: no model call or debit occurred.

The existing immutable sized-request capability now also supports the exact spacexai/grok-4.20-multi-agent identifier, after every existing workspace/model/tool authority check. Legacy Sonnet exports remain for compatibility. It fetches fresh public endpoint metadata, pins xAI routing, limits the full redacted payload to 32KiB, caps Grok output at 1024 tokens (including reasoning under the documented Gateway contract), and prices all published prompt/cache/output/region and priority/long-context premiums with margin and buffer. No provider-native search tool is attached; published optional search prices grant no tool access. Unknown fees or service tiers, route ambiguity, stale/forged/switched/reused capabilities or exposure above the supported ceiling fail closed to ordinary admission. Explicit operator hold overrides remain authoritative.

Capability scope, exact model/payload/output digest, one-use durable claim, customer settlement and policy rechecks remain unchanged. This is not a model approval or extra tool grant. Tests use the public October23 pricing shape and synthetic transport; actual paid acceptance remains separately bounded to the human-approved one environment task, at most two calls and $0.25. No top-up, new credential or SQL migration is involved.

Official contract: https://vercel.com/ai-gateway/models/grok-4.20-multi-agent ; public metadata: https://ai-gateway.vercel.sh/v1/models/spacexai/grok-4.20-multi-agent/endpoints . The Grok metadata lacks the Sonnet-specific reasoning.supports_max_tokens field: the exact-model contract and endpoint max_tokens support/max completion bound are required instead; mandatory or non-disableable reasoning metadata remains refused.
