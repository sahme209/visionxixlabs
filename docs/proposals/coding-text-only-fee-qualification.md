# Coding text-only fee qualification — local proposal

Status: **design for user review; not approved or implemented.** This proposes a separately versioned future contract, not an amendment already accepted into [the first quote contract](coding-request-quotes.md). Production quote issuance remains unavailable. No documentation fetch, provider request, inference, DB operation, credential access, code change or test execution was performed for this document.

## Observed starting point

The preserved `coding-quote-public-metadata/response.json` identifies `anthropic/claude-sonnet-5`. Its Anthropic endpoint lists nonzero web-search, cache-read and cache-write prices, including regional overrides. The 40-case observational candidate correctly retains those fee rejections and always returns `qualified:false` and `quoteEligible:false`. Its digest binds observed bytes; its timestamp is a local observation, not a price guarantee. This proposal leaves that parser and its existing contract unchanged.

`VercelGatewayProvider.generateTextWithRetries` prepares a text prompt/system, consumes coding dispatch before standard SDK generation, passes coding Anthropic/Gateway options, and sets zero retries for coding. Its early mixed-extraction-handle rejection is an existing boundary. These source observations establish local request construction only: omitted tools/search/cache controls in SDK input do not establish provider billing applicability, automatic feature behavior, or downstream serialization semantics.

## Alternatives and recommendation

| Alternative | Evidence required | Tradeoff |
| --- | --- | --- |
| Retain strict zero ancillary fees | Existing first-contract evidence, plus all remaining estimator/transport/source qualification | Safest immediate behavior; this saved snapshot stays unusable for quotes. |
| Feature-qualified narrow text-only contract | Authoritative proof that each nonzero feature dimension cannot apply to the exact dispatched contract | Potentially tighter estimate, but cache exclusion is an additional proof obligation and cannot come from absent SDK fields alone. |
| Conservatively include cache rates; separately prove no search | Source-backed cache billing units/count bounds, complete routing/tier coverage, and authoritative search exclusion | Larger holds, fewer feature-exclusion assumptions; unsupported or unbounded fees still refuse. |

**Recommendation, as a new proposal:** retain strict zero as the current behavior and investigate the third alternative for a separately versioned future local contract. Model every possibly applicable input-token dimension conservatively. Do not waive web-search fees until authoritative evidence establishes that search cannot be charged for the exact model/upstream/request contract. If that proof is unavailable, retain refusal; do not assume the fee irrelevant or insert an arbitrary search allowance.

The selected model remains `anthropic/claude-sonnet-5` only when already selected and permitted, with independently verified Anthropic-only routing. No fallback model/provider, default-hold reduction, cap change, silent contract substitution or automatic retry is proposed. A quote attempt that fails cannot downgrade into the fixed-hold path. Existing default behavior remains unchanged.

## Proposed arithmetic and dimension accounting

For each possible upstream region and supported billing tier, retain a complete explicit price record, including base fees inherited by regional overrides. Missing overrides, unknown billing fields, ambiguous eligible routes, missing units, unknown tier thresholds, unsupported precision and absent fee dimensions refuse. A regional token override never clears a base search/request fee. No field is inferred to be zero.

Let `I` be a separately qualified upper bound on all billable input tokens, including system/transport/wrapper overhead, and `O=4096` a separately qualified total billable output bound. For route/tier `j`, the conservative input coefficient is:

`a[j] = prompt[j] + cache_read[j] + cache_write[j] + every other applicable input-token rate[j]`.

Each positive rate is multiplied by the full `I` unless authoritative semantics prove mutually exclusive accounting or provide a larger required multiplicity. Summing is conservative only after proving each component's charged token count is bounded by `I`; repeat writes, multiple cache lifetimes, or other multiplicities need explicit finite bounds. Mutually exclusive maxima may replace sums only under reviewed source-backed semantics. Cache discounts are never assumed. Tier/context thresholds must cover the entire bound; uncertain applicability uses a proven upper envelope across all possible tiers or refuses.

Compute `Rin=max_j(a[j])` and an independently complete `Rout` across applicable output/reasoning dimensions and routes/tiers. Preserve full per-route observations for audit. Convert explicit USD-per-token decimal strings to integer nano-dollars without binary floating point; retain checked integer arithmetic through multiplication and ceiling conversion. Proposed provider cents remain `P=ceil((I*Rin + O*Rout + F)/10,000,000)`, with separately qualified fixed/event fee bound `F`. Keep the existing proposed hold formula `H=ceil(ceil(3*P/2)*3/2)`, no clipping, and the same full `H` in both ledgers. This arithmetic does not qualify `I`, `O`, units, or price completeness.

Every non-token fee needs either authoritative exclusion for this exact request contract or a source-backed finite event bound and exact unit conversion into `F`. SDK JSON omission alone is insufficient. Search is a blocking exclusion question for the recommended investigation, not an assumed zero. Nonzero request fees also refuse until an explicit fee contract is reviewed. Unknown event types or unbounded counts refuse even if token prices are known.

## Trust boundaries and failure states

Raw metadata remains an untrusted observation. A future trusted reader requires separate authorization and review: fixed reviewed origin/path, no caller URL or credentials/code, bounded streaming before parsing, no redirects, timeout/status/content validation and byte-digest/time custody. Reader provenance cannot be minted by a caller-supplied observation object or copied JSON. Local parsing, SDK mocks and fee arithmetic cannot create trusted pricing authority.

Any future contract must bind exact prepared/redacted prompt and optional system bytes, selected model, Anthropic upstream and all eligible regions, adapter/SDK serialization version, temperature 0.2, total output bound, disabled reasoning where qualified, text-only shape, feature restrictions and fee-policy version. Existing manager and final provider one-use checks, original actor/run/stage/CAS/phase/key binding, mixed-handle exclusion, atomic dual-ledger reservation and durable unknown-outcome handling remain prerequisites. No new caller Boolean may bypass them.

Explicit unavailable states are: strict-contract nonzero fee; feature applicability unproven; fee count/unit unbounded; incomplete region/tier coverage; ambiguous route; unknown schema dimension; invalid decimal/overflow; unqualified estimator or output semantics; untrusted/stale/future/unverifiable pricing custody or clocks; payload/options/model/authority drift; expired or reused authority. Each refuses quote issuance/consumption without model switching or cap changes. Before reservation, create no financial row; after durable dispatch claim, retain conservative unknown exposure under the existing recovery rules. Expiry is not release authority.

## Next action: documentation qualification before more arithmetic code

The immediate recommendation is to answer the four bounded official-documentation questions below **before** implementing another fee-accounting module. The saved response and local SDK source cannot resolve upstream applicability or billing multiplicity alone. A successful read is evidence, not acceptance of its claims for a different SDK/model version. Preserve unanswered questions and blocked destinations; do not use repeated fetches or paid inference to fill them.

The requested exception is official documentation search to locate relevant pages and at most four public official Vercel, AI SDK or Anthropic page reads. No metadata-API refetch, customer/code disclosure, credentials, model change, AI call, execution, installation, deployment or spending. This does not approve the future fee contract or its implementation. After those findings, present any concrete changed contract for the user's validation-first review; do not silently adopt the recommendation.

## Local acceptance and exact permission scope

If the user approves a later local implementation packet, its scope should be a separate pure fee-accounting contract/module and owned synthetic tests, using the already preserved snapshot as an explicit still-unqualified observation. Keep the strict candidate behavior and 40 existing cases. Add no reader, production constructor integration, DB/schema/migration change, network capability, live inference, provider activation, deployment, credential use or default/cap change. Synthetic feature proofs must be labeled test-only and incapable of authorizing production issuance. Approval must not presume that real provider fees are irrelevant.

Acceptance tests should demonstrate exact nano-dollar conversion and overflow refusal; sum of all positive possibly applicable cache rates; regional/base fee retention; complete tier maxima and thresholds; refusal on missing/unknown dimensions and ambiguous routes; explicit multiplicity bounds; non-token exclusion unavailable without proof; bounded supported event-fee arithmetic only under a reviewed synthetic contract; immutable provenance; and `qualified:false`/`quoteEligible:false` for the preserved snapshot and all synthetic arithmetic outputs. Synthetic no-search assertions and installed-SDK request capture prove local shaping only, never provider applicability. Existing quote binding, dual-ledger and recovery tests need a separate reviewed owned execution packet before any extension or execution.

## Later documentation exception: four bounded questions

No fetch is authorized by this proposal. A later separately approved official-provider/SDK documentation read should answer only:

1. For the exact Gateway model and Anthropic upstream, what do prompt/cache-read/cache-write prices measure, can charges overlap or repeat, and what regional/context/tier rules and units apply?
2. Under which exact request and account/provider conditions can web-search or other event/request fees be charged, and which documented controls guarantee their exclusion for this text-only contract, including automatic server behavior?
3. How does the installed AI SDK/Gateway adapter serialize the exact disabled-reasoning, upstream-routing, no-tool and total-output controls, and what provider guarantees bind total billable output and wrapper overhead?
4. What authoritative metadata completeness, update/freshness and price-validity guarantees exist, and how are all eligible regional/tier overrides represented?

Use official documentation selected during that approved read; this document invents no exact documentation URLs or answers. Estimator qualification, real trusted-reader custody, freshness/clock policy, adapter/output qualification and any later operational evidence remain independent gates. A useful affordable completion, guaranteed maximum charge and production acceptance are not established by this design.

## Subsequent approved documentation evidence

The user approved the bounded research exception (call_6QNV8xixpi5HQH0ApCBRqJnt); its four destinations are now consumed. [Findings](../recovery/2026-11-04/coding-fee-documentation/FINDINGS.md) distinguish Messages versus Managed Agents search defaults, cache lifetimes/regions and direct-provider output semantics. This approves neither this fee contract nor implementation. Keep current parser and issuance behavior unchanged; do not repeat the reads automatically.
