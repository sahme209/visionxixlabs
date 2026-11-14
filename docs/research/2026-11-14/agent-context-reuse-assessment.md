# Existing Agent context controls — reuse assessment, November14

Source-grounded gap-time assessment while the separately requested presentation-build permission is pending. No runtime behavior, model policy, pricing or dependency changed. This supplements the November12 public-help/retrieval/coding-quote assessments; it does not repeat their benchmarks or qualify a new library.

## Current facilities worth retaining

| Existing source | Confirmed local behavior | Boundary that must survive future optimization |
| --- | --- | --- |
| `lib/axiom/agentRuntime/conversationPromptBudget.ts` | Bounds the prompt's conversation portion. The newest user message remains whole up to32,768UTF8bytes. Older history has a32,768-byte allowance and a32-selected-turn target; old user/assistant turns are bounded at4,096bytes, historical tool turns at8,192bytes, with explicit truncation/omission text. Stored history is not rewritten. | Mandatory fresh tool results can exceed the ordinary32-turn target; they remain complete. If newest request plus mandatory fresh evidence cannot fit the65,536-byte transcript budget, refuse rather than treating partial evidence as complete. Do not describe this as a hard32-turn cap on all current evidence. |
| `lib/axiom/agentRuntime/decisionLoop.ts` | Calls that helper with `completeToolResultsFromIndex: input.transcript.length`, distinguishing fresh results from earlier history. Oversized fresh evidence returns an explicit final limitation before another model decision or write proposal. Inspect/Engineer/DeepOps allow at most2/4/6decision attempts, with any lower caller limit applied. A bounded malformed-envelope repair consumes the same attempt allowance. | No separate unlimited repair loop, no authorization inferred from omitted history, no cache of execution approval, and no bypass of current tool/identity checks. These are source facts, not actual-provider acceptance. |
| `lib/ai/inputByteBound.ts` plus `governedAiCall.ts` | A separate128KiB bound applies to the redacted aggregate prompt+system input. Schema instructions and system/profile/skill/workspace/current-selection framing exist beyond the transcript text. | The transcript's64KiB limit is not a full-request token or bill limit. Keep exact model/policy/admission/currentness/usage controls; byte counts cannot establish provider tokens or an invoice. |
| `/api/support/answer` and `lib/support/answerKernel.ts` | Existing public-help route uses deterministic retrieval. A low-confidence unanswered-question record explicitly stores `totalTokens:0`. | This already-existing path is not new savings. Hosting/rate limiting/storage can still cost money, and public docs cannot answer private workspace state. |

## One new synthetic local measurement

Ran the actual existing pure `conversationPromptBudget.ts` helper once, using the existing Node24.21.0 type-stripping support and the saved `agent-context-reuse-measurement.mjs` procedure. Five cases/assertion groups passed, exit0; source hash and synthetic input arrays were unchanged. No SDK/provider/model/database program was used. Node emitted a module-type/performance warning; no package setting was changed to suppress it.

| Case | Observation |
| --- | --- |
|48synthetic earlier turns plus newest request |109,011bytes of input **content** produced a32,923-byte formatted transcript with an omission notice and complete newest request. The input-content measure excludes role delimiters, while output includes them; these are explicitly different serializations, not a claimed reduction ratio. |
|Newest request at32,768bytes |Preserved completely; transcript32,775bytes including its role prefix. |
|Fresh Unicode tool evidence |Retained in full;1,381input content bytes became1,404formatted transcript bytes. |
|Newest request32,769bytes |Refused at the existing request limit. |
|Fresh tool evidence70,000bytes |Refused with `CurrentToolEvidenceLimitError`; no partial fresh-evidence prompt was produced. |

The result is `agent-context-reuse-measurement.json`; exact inspected source hashes are in `agent-context-reuse-inventory.json`. This is a narrow helper measurement, not the full assembled Agent prompt, an answer-quality evaluation, real token/cost/latency savings, deployed behavior or complete security qualification. No existing whole-suite pass was rerun or relabelled as new evidence.

## Recommended next evaluation, without changing current work

Reuse these controls before adopting prompt-compression, context-packing or tokenizer libraries. The next meaningful authorized benchmark should compare quality-equivalent **complete final payloads** (including framing/schema/skills/current context), separately account for decision/repair calls, and preserve fresh evidence and structured authority. Only separately approved real inference could measure actual provider input/output/cache usage and billed cost. Compression must not silently truncate exact targets, approvals, uncertainty or action history.

The earlier repository shortlist remains research-only. This pass performs no new external repository lookup, version/license refresh, install, telemetry export or adoption. Deterministic work must never be recorded as fabricated model tokens or used to silently change the customer's disclosed tariff. The owner's pricing/credit idea remains a separate reviewed commercial decision.
