# Hybrid task fulfillment — reuse before adding tools

Status: source-inspected gap-time assessment, not a runtime routing change, benchmark result or adopted commercial tariff. Current Governance source work retains priority; its pending approvals were not repeated. No provider/model/database call, external repository read, installation, new dependency, billing or production action occurred. Exact local source hashes/head are in hybrid-fulfillment-reuse-inventory.json.

## Important correction to the premise

Axiom does not require inference for every existing task. `components/AIChatWidget.tsx` submits the initial support question to `/api/support/answer`, whose current route builds a knowledge index and calls `answerQuestion` without a model. The separate explicit Ask AI action calls `/api/support/ai-answer`; that route checks signed-in workspace authority and uses the governed model path when eligible. Its guards, unavailable model and invalid/failed model response can return grounded help. Do not silently replace the explicit customer AI action with a different billed service or assume every help interaction is a model request.

The model-free help route can still use hosting, rate-limit state and a best-effort unanswered-question database write; zero inference is not zero operating cost. Deterministic retrieval/citations also do not guarantee factual completeness or accuracy. Existing source versioning, uncertainty handling and evaluations remain necessary.

## Source-backed reuse map

| Customer job | Existing implementation | Recommended treatment / limits |
|---|---|---|
| Explain documented setup/permissions with citations | `lib/support/answerKernel.ts`, knowledge base and `/api/support/answer`; default widget path traced | Reuse. Preserve secret/action/account guards, source version/citations and low-confidence suggestions. No new retrieval library needed merely to provide this path. Customer/private-workspace questions must not use the public corpus as account evidence. |
| Ask for richer phrasing or ambiguous documentation help | `/api/support/ai-answer`, `aiAnswerKernel.ts`, `governedAiCall.ts` | Existing separately requested governed inference, not a reason to make every answer paid. Maintain current tenant/model/policy/admission/redaction/output/citation constraints and actual usage accounting. No unapproved cheaper-model fallback. |
| Identify likely affected areas from changed file paths | `lib/impact/impactKernel.ts` | Reuse deterministic path rules as a bounded heuristic. Not semantic code analysis, vulnerability detection, complete blast-radius proof or execution approval. Model explanation may supplement but cannot turn the heuristic into authority. |
| Compare a draft approval policy against recorded actions | `lib/policy/replayKernel.ts` | Reuse current resolver/pure replay. Preserve its explicit unsupported-category/history limits; replay does not enable or save policy. Historical economic estimates are not verified AI savings. |
| Show the latest recorded release-readiness snapshot | `lib/releaseops/readinessListResponder.ts` | Reuse the scoped repository/responder contract. It reads recorded data, not fresh provider health, complete safety or a new readiness evaluation. Caller authority/tenant binding and actual adapter acceptance must still be checked for each exposed entrypoint. |
| Compare approved and current evidence versions | `lib/governance/intelligence/drift.ts` | Reuse typed comparison/currentness and unknown outcomes. Current evidence suppliers can involve database/provider reads and their own permissions/operating costs. A changed/unchanged report remains executionAuthorized:false, never remediation authority. Complete Governance acceptance is still open. |
| Compile exact task/role/run proposal and validate hashes | `lib/governance/platform/operations/ecsPreparation.ts` and existing pure metadata contracts | Reuse deterministic parsing/hashing/reference recovery. No model is needed to establish matching bytes. A digest cannot qualify the source, supply a genuine reviewer or authorize execution. Current platform workflow is prepared/local, not production accepted. |
| Redact AI context and bound admitted requests | `lib/axiom/agentRuntime/governedAiCall.ts` and its imported controls | Preserve this mandatory boundary. Redaction is a security control, not a demonstrated token-reduction algorithm. Existing accounting/admission must not be replaced by a compression library. |

Rows without a traced customer entrypoint are module-level reuse opportunities, not assertions that every customer currently has a usable integrated feature. This assessment does not broaden production availability or call any connected source.

## Candidate priority, without automatic adoption

1. **Reuse existing:** grounded support, typed readiness/evidence/history reads, exact proposal validation and policy/path kernels. These already address the first categories of non-model work; adding another framework would require evidence of a specific gap.
2. **Design next if selected:** a closed task contract that proposes an existing deterministic tool or explicit governed AI option, with current access, consent, budget and honest outcome. Do not infer a generic autonomous dispatcher, new tool permission or automatic fallback from this research.
3. **Existing external shortlist retained:** tree-sitter for unsupported language-aware selection, tiktoken for supported model estimates, LLMLingua for non-authority context experiments, promptfoo for gaps in existing evaluation. November11 observations are historical and these candidates remain uninstalled/unqualified. No new external verification or version/licence claim is made here.
4. **Reject:** fetching arbitrary repository instructions at runtime and executing them, uncontrolled MCP/plugin discovery, treating popularity/free access as safety or commercial-use permission, and changing the AI model or billing unit merely because an alternative looks cheaper.

## Finite next comparison (prepared, not run)

Use a frozen synthetic task set with expected source/outcome, authority/refusal cases and quality thresholds agreed before experimentation. Avoid rerunning the existing November11 retrieval baseline unchanged.

- Documentation question: correct supported-version citation or uncertainty; compare existing grounded result with a separately authorized model-assisted result only if it offers measurable quality benefit.
- Changed paths: correct limited impact categories plus explicit unsupported semantic conclusions; no claim of detecting every security problem.
- Draft policy replay: supported deterministic outcomes and explicit category/history gaps; no enabled policy.
- Readiness/evidence: exact authorized recorded snapshot with freshness/source limitations; missing evidence is unknown, not healthy.
- Malicious repository text or private-account request: no tool authority, secret disclosure, cross-tenant read or execution from retrieved content.
- Revoked role/source, exhausted budget or uncertain prior action: explicit refusal/original-history recovery, no automatic model/tool retry.

Measure successful equivalent outcomes, safety/refusal errors, actual provider-reported input/output/cached usage when a model call is separately authorized, model/tool/hosting/storage/network costs, latency and maintenance. Local estimates and avoided hypothetical calls are not invoices or measured savings. A deterministic implementation may use no model tokens while still incurring compute/storage cost. No new benchmark/model call is authorized by this file.

## Commercial separation

The owner's consistent customer service-usage tariff can be evaluated independently of internal fulfillment cost. First define the service unit, quote/disclosure, limits, actual tool/compute/model ledger dimensions and settlement rules. Never invent model tokens or call a service charge provider-token cost. Current1.5x/2x examples are unselected hypotheses; billing/payments remain unchanged/off where currently held. Marketing savings require representative quality-adjusted evidence, not this source inventory.
