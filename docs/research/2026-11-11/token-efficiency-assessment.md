# Token efficiency and tooling — first source-backed assessment

Scope: approved gap-time research, frozen Axiom source `9decdb28`. No package installed, model invoked, new service granted, customer data read, benchmark spend or runtime policy changed. This is a reuse/adoption proposal for owner review, not permission to implement new features. External release/licence/security qualification and real inference comparisons remain incomplete.

## What is already available

| Actual source | Verified narrow behavior | Implication |
|---|---|---|
| `lib/support/answerKernel.ts` | Pure BM25 retrieval, fixed public citations, uncertainty/action/secret guards, top-five retrieval default | Baseline and improve existing selection before adding a vector database or framework |
| `lib/ai/inputByteBound.ts` | 128 KiB aggregate UTF-8 input bound after redaction; explicitly not token estimation | Bytes and token limits are different; a large ceiling is not the typical prompt size |
| `lib/ai/contextRedaction.ts` | Pattern-based context redaction | Retain protection, test new formats; regexes are not proof that every possible secret is detected |
| `lib/axiom/agentRuntime/governedAiCall.ts` | Current policy checks, admitted budget hold, bounded model options and repeated caller checks around awaited work | No efficiency change may cache authorization, erase a hold or select a cheaper unapproved provider |
| `lib/ai/codingRequestQuote.ts` | Exact payload/scope/options binding; inspected contract fixes output4096, retries0, route cache:none | Provider caching or altered output/routing is a separate qualification/design change |
| `lib/workforce/pipelines/codingRunBudget.ts` | Pending/unknown exposure retains estimated holds; provider settlement distinct from display telemetry | Do not call unknown costs free or count a timeout as permission to retry |
| Existing TypeScript compiler API, `rg`, source hashes and focused tests | Current repository already uses these to select/verify source | Reuse existing parsing and compact evidence for development; a new runtime library does not lower Codex/Claude subscription usage by itself |

## Observed offline baseline

`public-retrieval-baseline.cjs` reads only the fixed public support sources/JSON and the literal existing evaluation cases, using retained compiler API5.9.3 to load the actual pure modules. It runs no test body, server, model, provider or database. The allowlisted loader is not an OS sandbox/security claim. The initial development run failed JSON default-import interop; corrected to the same ES interop semantics, then completed. No result from the failed run is accepted.

Committed `public-retrieval-baseline.json` binds all source hashes:

- 183 public knowledge entries; 42 frozen questions; 7 guard responses.
- Expected-source agreement39/42 (92.9%), not an independent semantic-quality or LLM benchmark. Original evaluation bar remains90%; all four newly added guide questions have separate exact-source tests.
- Retained negative cases: CI gate and GCP setup return suggestions; rollback cites ReleaseOps rather than the expected dedicated rollback guide. No speculative ranking repair is included.
- For35 non-guarded questions, the explicitly defined research serialization of top-five `{title,body,href}` entries is772–3,070UTF-8bytes; median1,893, p95=3,025. This is not the full SDK prompt/system/tool/history payload, a token count, cost, latency result or reduction against production.
- No tokens or billed cost measured; no savings claimed. A counterfactual whole-corpus prompt would be a misleading baseline because current retrieval already selects entries.

The next useful measurement is the actual admitted payload at the exact request boundary, not installing compression first. Use synthetic/redacted tasks, fixed model/options/source revisions, expected citations/refusals and provider-reported input/output/cache usage plus settled billed cost. Keep unknown-cost holds. Real paid inference remains separately authorized; do not infer savings from this offline observation.

## Candidate scorecard

Scores are research triage only:3=reuse inspected existing facility;2=concrete experiment candidate after qualification;1=monitor/later;0=not currently qualified. They are not token-saving or security scores. Public API metadata/HEADs are recorded in `tooling-public-source-snapshot.json` (16 read-only public calls, no clone/install/run). Pushed timestamps and non-archived status do not establish maintainer quality or vulnerability absence. Repository licence metadata is not a complete licence review, especially for models, grammars, enterprise components and transitive packages.

| Candidate | Score / disposition | Specific fit, overlap and proposed experiment | Cost, data and qualification limits |
|---|---|---|---|
| Existing BM25, TypeScript AST, bounded context and ledger | 3 / reuse | Preserve citation baseline; investigate measured selection misses before new retrieval dependencies. Use scoped source searches and compact source-bound handoffs for development | Already present; no new service. Real request measurement still needed. No generalized savings claim |
| [tiktoken](https://github.com/openai/tiktoken) | 2 / later local estimate experiment | Compare exact supported model estimates with reported usage; useful for preflight sizing, not universal billing | Public licence metadata MIT. Native/WASM/Node wrapper/platform suitability and actual chosen version unqualified; OpenAI tokenizer is not an Anthropic/Gemini authority |
| [tree-sitter](https://github.com/tree-sitter/tree-sitter) | 2 / only for a demonstrated non-TS parsing gap | Incremental bounded source selection; compare with existing TS AST before adopting | MIT metadata; grammars, native/WASM builds, packaging, CPU/memory and cancellation need separate qualification. No reason to duplicate current TS parser |
| [Context7](https://github.com/upstash/context7) | 2 / use a verified existing connection when appropriate | Version-specific official documentation could reduce stale investigation; assess exact source freshness and concise response relevance | MIT repo metadata does not grant hosted service access. Tool availability is not verified account availability; no private code/secrets in queries, no new grants or assumed free quota |
| [promptfoo](https://github.com/promptfoo/promptfoo) | 2 / offline evaluation comparison | Compare with existing Vitest citation/refusal and boundary suites; start synthetic/mock cases, not live providers | MIT metadata. Review telemetry/export defaults, CLI/network behavior, dependencies, licence scope and cancellation. Real model runs can incur cost and need approval |
| [Repomix](https://github.com/yamadashy/repomix) | 1 / bounded export only if needed | Evaluate selected allowlisted files with size/redaction/source-manifest checks; never default to packing/uploading the entire repo | MIT metadata. Secret-scan false negatives, output destinations and include/exclude rules need review. Larger context can increase cost and disclosure |
| [LLMLingua](https://github.com/microsoft/LLMLingua) | 1 / research later | Test lossy compression only on non-authority synthetic context after a measured baseline; judge omissions/citations/refusals, not advertised ratios | MIT repository metadata does not qualify model weights/data or Python/model/accelerator requirements. Added local CPU/memory/inference cost may exceed benefit; no exact approval/target/budget records in compression |
| [Langfuse](https://github.com/langfuse/langfuse) | 0 / licence/export qualification first | Compare against existing usage/audit/telemetry before introducing another store; content-free metrics if later approved | GitHub licence metadata NOASSERTION: unresolved, not assumed MIT. Hosting, enterprise terms, retention, tenant isolation, data export and operational cost unqualified. No telemetry enabled |
| [OpenSSF Scorecard](https://github.com/ossf/scorecard) | 2 / due-diligence input only | Assess repository practices for a candidate; complement exact source/licence/vulnerability review | Apache-2.0 metadata. Running scanners/workflows, API limits and permissions remain unapproved here. A score is not proof a dependency is safe |

Exact candidate heads are research coordinates, not approved release pins. No dependency should be added at a moving HEAD. Before adoption choose a release, inspect licences/model/data/grammar terms, transitive vulnerabilities, provenance, telemetry/permissions, package/platform/offline support, CPU/memory/storage/inference cost and failure/rollback behavior. None of those checks is replaced by the metadata snapshot.

## Proposed experiment contract — not executed

1. Freeze representative synthetic tasks: public support questions and citations; repository debugging with exact code facts; release-review summaries with exact structured authority fields. Separate runtime usage from development-assistant usage.
2. Baseline the existing admitted path. Measure payload bytes, actual model/version/options, input/output/cache tokens, settled cost, latency, refusals, citations and task completion. Record retries/unknown holds rather than dropping failures.
3. Try one change at a time: narrower retrieval; code-aware selection for a demonstrated gap; provider caching only through a separately reviewed compatible fee/policy contract; compression last.
4. Keep tenant/identity/model/policy/source revisions in any cache key and invalidate on revocation. Never cache an execution decision or infer authorization from similarity. Exact actions, approvals, hashes, targets, warnings and accounting stay outside lossy text.
5. Predeclare acceptance: no required safety/refusal/citation regression; exact authority fields preserved; correct task outcome retained. Require measured cost improvement exceeding added compute/maintenance overhead across representative tasks, not one favorable prompt. Numerical savings targets await a real baseline and owner review.
6. Reject a candidate if it requires unapproved egress, weakened guards or duplicated authority. Preserve negative results. Roll back by disabling the experimental composition, never replaying a provider operation.

## Owner review outcome requested

Approve no new adoption on the present evidence alone. First reuse existing selection and measurement. If a concrete gap survives, review one scoped experiment with its exact release/licence/data/cost boundaries. The two assessment documents are recommendations only; the master plan's current execution, production, genuine approval and real-world acceptance gates remain unchanged.
