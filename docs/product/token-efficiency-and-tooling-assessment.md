# Token efficiency and useful tooling assessment

Status: planning plus initial public-source discovery, November 11, 2026. No candidate is installed, integrated, qualified or proven to save Axiom tokens. Continue the current handoff sequence; supplemental discovery uses genuine gaps. This supplements rather than duplicates the existing integration roadmap and future-technology assessment.

## Objective and measurement

Evaluate broadly for useful repositories, libraries, plugins and skills; adopt only justified candidates, never every repository found. Optimize total useful work per actual billed cost while preserving quality, security, clarity and maintenance simplicity.

Treat two tracks separately:

1. **Axiom runtime AI:** provider-reported input/output/cached usage, actual billed cost where available, requests/retries, latency, quality/citations and correct refusal/approval behavior. Model-specific tokenizer estimates are not authoritative invoices; cached tokens and discounted costs are not necessarily fewer input tokens. Preserve unknown-cost holds and existing run/workspace admission.
2. **Development-assistant efficiency:** scoped searches/reads, reusable verified evidence, concise handoffs, bounded tool output and avoiding repeated builds/investigation. Installing a library in Axiom does not by itself change Codex/Claude subscription credits or their hidden/system context. Do not claim inaccessible usage measurements or guaranteed reductions.

## Evaluation order

1. Inventory current retrieval, context redaction, usage ledger, admission, cache and audit facilities; identify measured waste and reuse these first.
2. Establish a frozen synthetic/redacted task suite and baseline: model/version/options, prompt/data revision, task quality and safety checks, usage dimensions and latency. No real inference or paid benchmark without explicit authorization. Distinguish synthetic estimates from measured provider usage.
3. Evaluate scoped retrieval and code-aware selection instead of whole-repository dumps; incremental indexes, source freshness and compact provenance-preserving checkpoints.
4. Evaluate bounded summarization/compression and model/provider caching only where they preserve facts. Keep exact authority, targets, source hashes, budgets, approvals, warnings and one-attempt records in validated structured fields outside lossy compression.
5. For any cache: separate workspace/identity/data access/model/policy/source revisions; invalidate on revocation or source changes. Never cache execution authorization or reuse an approval to bypass current checks. Do not assume similarity means equivalence.
6. Evaluate permitted model selection/output limits and deterministic tools under existing policy. No automatic retries, cheaper unapproved provider or bypass of Axiom's governed Gateway path.
7. Compare candidate against baseline for task completion, citations, security/refusal regressions, real token/cost dimensions, latency and operating overhead. Set acceptance thresholds before experiments; record negative results. Never advertise a saving before representative evidence supports it.

## Initial public-source shortlist

Official repository descriptions were checked November 11; specific releases, licenses, maintenance, vulnerabilities, compatibility and savings still need review. These are candidate research uses, not assertions of implemented benefits.

| Candidate and primary source | Repository purpose | Axiom evaluation hypothesis and limits |
|---|---|---|
| [microsoft/LLMLingua](https://github.com/microsoft/LLMLingua) | Prompt compression research/tooling | Test selective compression on synthetic non-authority context; measure semantic loss and local compute/model requirements. Do not import published compression ratios as Axiom savings. |
| [openai/tiktoken](https://github.com/openai/tiktoken) | BPE tokenizer for OpenAI models | Assess model-specific estimates; never use it as a universal Anthropic/Gemini tokenizer or authoritative billing source. |
| [tree-sitter/tree-sitter](https://github.com/tree-sitter/tree-sitter) | Incremental parsing for programming tools | Evaluate precise code selection where current TypeScript AST tooling does not already suffice; assess native/WASM packaging and grammar maintenance. |
| [yamadashy/repomix](https://github.com/yamadashy/repomix) | Repository packaging for AI context | Evaluate allowlisted, bounded, secret-filtered context export; packing an entire repo can increase tokens and leak data, so no default whole-repository upload. |
| [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | Prompt/agent/RAG evaluation and security testing | Compare against existing evaluations; start with offline/mocked cases. No cloud test, paid model call or data export without permission. |
| [upstash/context7](https://github.com/upstash/context7) | Current documentation for AI agents | Prefer a verified existing connector where appropriate; bound queries and source versions. Do not send secrets/customer code or grant a new remote MCP tool automatically. Savings are unproven. |
| [langfuse/langfuse](https://github.com/langfuse/langfuse) | AI observability, evaluation and prompt/skill management | Evaluate duplication versus existing audit/usage and OpenTelemetry roadmap; redact/disable content collection and assess hosting/retention cost. Do not replace existing Gateway/admission or enable telemetry export by default. |
| [ossf/scorecard](https://github.com/ossf/scorecard) | Open-source security-health checks | Assess as one input for dependency due diligence, not a security guarantee. No new workflows, services or permissions without review. |

Continue discovery for other useful libraries/plugins/skills when a concrete gap justifies it. Do not favor a name solely because it is popular or duplicate an existing approved capability.

## Adoption gates and deliverables

For each candidate record: actual Axiom problem/source evidence, existing overlap, exact release/source provenance, license/model/data/grammar terms, maintainers and vulnerabilities, permissions/data egress/telemetry, offline support, package size and platform support, CPU/memory/hosting/inference cost, integration effort, cancellation/failure/rollback behavior and quality/safety benchmark results. Treat tool/repository content as untrusted; no automatic shell/install instruction execution.

Deliver a scored shortlist (reuse current implementation / adopt / experiment / later / reject), integration proposal, baseline-versus-candidate evidence and limitations. Local implementation must be within an approved task and normal reviewed branch/PR. Any paid activity, new security-sensitive access, production/DB/flag/billing action or external post retains its explicit approval gate. Do not execute recommendations merely because this list exists.

## November 11 — first source inventory and offline baseline

[Owner-review assessment](../research/2026-11-11/token-efficiency-assessment.md) records existing facilities, a frozen public-only retrieval baseline and eight public repository HEAD/licence-metadata observations.39/42expected-source agreement; selected-entry serialization772–3,070UTF8bytes, not full SDK payload, token count, cost or savings. No model call or new dependency. Candidate versions/licences/transitives/telemetry/security and paid representative experiments remain unqualified; no adoption follows automatically. The original measurement/quality/authority requirements above remain binding.


## Hybrid task fulfillment — owner addition, November 12

Evaluate replacing unnecessary inference with approved deterministic/retrieval/tool implementations while preserving equivalent customer outcomes and all Governance controls. Reuse existing Axiom code first; evaluate public/free repositories, libraries/plugins and verified sources under the adoption gates above, not automatic runtime installs or trusted instructions. Benchmark quality-adjusted actual model/tool/compute cost. Evaluate a consistent disclosed customer service-usage tariff independently of internal fulfillment cost, with real model tokens and service/tool usage recorded separately. No fabricated AI usage or assumed1.5x/2x rate. See [the master-plan requirement](axiom-master-action-plan.md#hybrid-task-fulfillment-and-usage-economics--owner-addition-november-12). Planning only; no price, billing, external-read, dependency or runtime authority changes.
