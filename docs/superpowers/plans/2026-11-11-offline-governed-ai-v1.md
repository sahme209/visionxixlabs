# Offline governed AI v1 implementation plan

> **For agentic workers:** Use superpowers:executing-plans task by task; one fresh whole-branch review before a PR. The owner authorized continuous local implementation and selected the v1 settings; no redundant execution-method checkpoint. No production/model-server/real-inference authority.

**Goal:** Compose the accepted customer-hosted, token-metered branch into the actual governed AI path, with online behavior preserved and offline cloud leakage refused.

**Spec:** `docs/product/adr/2026-11-09-a9-offline-governed-local-models.md`, accepted November11; deployment operator, not workspace Operator, owns endpoints and caps.

**Architecture:** Separate installation mode/operator configuration, durable token accounting, bounded OpenAI-compatible transport and existing workspace-policy/caller composition. Reuse existing audit/redaction/opt-in boundaries; no currency conversion, generic fallback or parallel permission system. Default configuration grants nothing. Keep the branch open until the composed feature passes, not a guard-only release.

**Stack:** Existing TypeScript/Prisma7/PostgreSQL/Vitest5/Node HTTPS; no added runtime dependency by default.

## Global constraints and interfaces

Local code/mock tests first. Actual isolated SQL tests only on an owned fixture under existing permitted setup; never production SQL, credentials or providers. No server install, inference, flag enablement, deployment or paid workflow. Existing canonical issuer/custody gates remain unchanged. Historical engine/schema receipts are not renewed by re-pinning.

Interface ledger: mode/config → token store/transport uses immutable parsed snapshots and semantic digest, not raw request JSON. Token admission → final transport uses one-use opaque claim bound to organization/actor/request/config/model/window. Transport → accounting uses finite verified usage and exact model; missing, excessive or malformed results preserve unknown exposure. Current workspace opt-in/policy and caller fences are rechecked around awaited work. New budget windows/config revisions cannot erase old unknown holds.

## Task 1 — installation contract and operator configuration

- [x] Write RED tests for exact absent/false/true/invalid mode selection and JSON-only bounded configuration: no defaults, exact hosts/no URL credentials/query/fragment, HTTPS or loopback HTTP, model bounds, unique identities, explicit per-workspace budget windows, immutable digest, expiry/cross-workspace refusal.
- [x] Implement `lib/ai/customerHostedConfig.ts`: `readInstallationAIMode(raw:unknown)` returns online/offline/unavailable; `parseCustomerHostedOperatorConfig(raw:unknown)` returns parsed data or null; `activeCustomerHostedBudget(config,organizationId,now)` returns the exact active window or null. No environment/DNS/DB/network read, credential field or execution authority.
- [x] GREEN command: `node scripts/run-vitest.mjs lib/ai/__tests__/customerHostedConfig.test.ts`. Preserve strict negatives and positive configurations for all three server kinds.

## Task 2 — durable token admission, not dollar accounting

- [ ] Define operator-window and reservation records with explicit TOKEN units, config/model/request digests, claim state and reported usage. Use atomic current-window locking and one-attempt claim; no default allowance. Additive LOCAL schema only if existing records cannot represent units safely.
- [ ] Expose `reserveCustomerHostedCall`, `claimCustomerHostedCall`, `settleCustomerHostedCall`; no serializable authority flag. Preserve unknown holds; quota reduction/revocation/expiry after awaits must refuse before dispatch. Audit success/refusal/unknown without prompt content; settlement label `customer_hosted_unpriced`.
- [ ] Input reservation uses a qualified per-model maximum input/context bound plus output bound; bytes must never be treated as universally equivalent to tokens. Configuration parsing does not qualify that bound. Positive execution requires trusted server/model limit evidence; missing evidence refuses. Usage exceeding an accepted bound is recorded as an integrity/overrun event, not refunded or reported as successful cap enforcement. Live server-bound qualification remains an enabling gate.
- [ ] RED→GREEN pure arithmetic/race/one-attempt tests and actual owned-PG transactions with simulated provider: concurrent cap, revision changes, duplicate request, old unknown across windows, settlement and rollback.

## Task 3 — fixed bounded OpenAI-compatible transport

- [ ] One `/v1/chat/completions` JSON request for each configured vLLM/Ollama/LMStudio profile; no native API, tools, streaming fallback or retry in this v1 structured-extraction path. Same caller-visible structured result/usage contract.
- [ ] Operator-owned host allowlist checked after resolution, pinned actual dial target and TLS hostname, no redirect or URL substitution. HTTPS/private deployment or explicit loopback HTTP; offline cannot route prompts to public Internet. Bound request/response/header bytes, deadline and cancellation; no endpoint or key from workspace/model output.
- [ ] Tests: three valid profiles, DNS rebinding/mixed addresses/peer mismatch/redirect, abort before/after claim, malformed/truncated/excessive output, missing usage, exact model mismatch and no second attempt. Inject transport; no actual model/server/network run.

## Task 4 — real policy/admission composition

- [ ] Extend the actual stored policy and explicit configured model selection for `customer_hosted`, without treating a model ID as an endpoint or allowing UI cap edits. Preserve existing M02 widening refusal and current membership/access requirements.
- [ ] Branch in `resolveGovernedAiCall` BEFORE Gateway catalog/credit/provider construction in offline mode; compose real token store, validated transport, redaction, current workspace opt-in and caller `beforeAdmission` fences. Preserve online Gateway path and tests unchanged.
- [ ] Update actual caller result/error handling and content-free usage/audit composition, so unpriced calls cannot enter credit settlement as free dollar events. No omission of durable authority or accounting in the default composition.
- [ ] Tests with the real composition and simulated I/O: positive valid calls for all profiles; disabled policy, missing caps, changed configuration/policy after await, stale/cross-tenant request, output-bound refusal and unknown-state preservation.

## Task 5 — complete offline egress and workflow boundaries

- [ ] Inventory all AI dispatch entrypoints, including generic text/coding/support/direct provider paths. Add the shared mode refusal where necessary so an offline installation cannot call a cloud model or fall back through legacy local adapters. Invalid mode must not default to online.
- [ ] Prove each inventoried seam refuses before network offline, and online refuses customer-hosted. Keep unrelated tool/connector/execution permissions and approval semantics unchanged. Existing unsafe/unqualified paths stay unavailable rather than becoming a bypass.
- [ ] Add operator/setup documentation, supported-operation matrix and explicit unqualified/live limitations; update public guide hashes/corpus/counts, ModuleIntro/demo/SDK only where behavior requires. Keep human decisions and native/custody gates visible.

## Task 6 — finish the complete source batch

- [ ] Run required full web types/tests/build, desktop types/build and Python; composed isolated tests with simulated providers distinguish real SQL from live inference. No automatic retry after an unknown provider effect.
- [ ] Fresh independent whole-branch review of source, security, actor/budget/DNS/cancellation races, all inventoried dispatch coverage and faithful ADR scope. Resolve important findings with actual RED→GREEN evidence.
- [ ] One PR, every applicable check green on the exact reviewed head, normal merge only. No production/flag/schema apply/provider call/installer publication. Record source completion separately from real offline isolated-network acceptance and on-prem readiness.

## Review focus

No byte-to-token heuristic posing as a hard budget; no parsing of config posing as qualified model-limit evidence; no cap reset via revision/window rollover; no mixed provider fallback; no cloud path outside the Agent seam; no policy/caller revocation race across awaits; no unknown-cost release; no constructor-side egress; no workspace Operator role confused with deployment operator; no schema-unit/history laundering.

## Progress ledger

Task1 starting from3754c049. The configuration parser is a data contract only; the deliverable remains all six tasks and actual mounted source composition, not just refusals.

Task1: complete locally. Initial module-absence RED, explicit non-implementing stub RED7fail/2pass, restored implementation GREEN9/9. Root native types pass. Configuration parsing is data only; no model-bound qualification, admission, network or runtime composition is claimed. Remaining Task2–6 are required before a feature PR; no guard-only merge.

Task2 partial: pure token-liability arithmetic implemented after stub RED5fail/1pass; configuration+arithmetic GREEN15/15. Unknown/dispatched/reserved holds and overruns survive window changes; malformed/overflow exposure refuses. No durable store/atomic claim/transport or runtime mounting yet. Task2 remains unchecked; this checkpoint is not a standalone feature PR.

Task2 further progress: one-attempt token store and PostgreSQL adapter implemented using existing workflow/event records, without schema or currency-field reuse. Twenty-one focused tests and root types pass; service concurrency tests use a serialized in-memory repository, not PostgreSQL. Actual SQL/concurrency/rollback and expiry-currentness validation remain required; no Task2 checkbox or feature readiness is claimed. Remaining transport/composition/egress/acceptance tasks unchanged.

Task2 actual SQL checkpoint: five real owned PostgreSQL journeys PASS (concurrent cap, one durable claim/history, event rollback, old unknown/new window, database-time expiry); cluster stopped. Existing workflow migration only, no schema changes/model calls. Database time now supplies expiry checks. Focused21/21 and root types PASS. Default Prisma mounting, qualified model-token bounds and final caller/policy/transport composition remain open; Task2 is not declared complete.

Task3 partial: private-address classification and bounded exact-model completion decoding, six tests/types PASS. Expanded mapped-IPv6 alias regression fixed after RED. Refusals preserve safe reported overrun liability. No actual network transport/DNS/socket or runtime mount yet; Task3 remains open.

Task3 further progress: actual fixed Node socket transport implemented; simulated DNS/socket tests prove single request, private-answer filtering, exact peer before body, final admission/cancellation, redirect refusal, DNS deadline, malformed/oversized responses, and loopback-only HTTP answers. Twelve transport tests PASS after a loopback-DNS regression. No actual network/inference; Task3 and full-feature acceptance remain open pending complete integration/review.

Task4 partial: actual provider union/stored-policy reader accepts exact customer-hosted model opt-in; static registry invents no default/mock. Config and policy reject URL-shaped model IDs. Refused protocol responses preserve their entire unknown hold unless observed usage overruns it. Twenty-five focused/existing-policy tests and root types PASS. Mode-aware admin availability and governed-call composition remain unimplemented; no Task4 completion/activation claim.

Task2 evidence data: bounded operator-attestation parser binds proposed full-limit token hold to config/model/expiry/evidence digest; two tests/types PASS. Parsing is not live qualification or authority, and no new acceptance issuer or dispatch path is enabled. Trusted acceptance provenance and all composed-path requirements remain open.

Task5 partial: inventoried common cloud/legacy direct transports; online-only mode gates added with nine behavioral tests (RED→GREEN). Legacy local adapters also refuse offline to prevent unmetered bypass. Metadata/reconciliation, actual caller tests and default customer-hosted/Agent composition remain gaps in DISPATCH-INVENTORY.md; no Task5 completion claim.

Task4 coordinator: joined redaction/input bound → token reserve → final currentness → one claim → one send → unpriced settlement/audit. Five simulated composition tests/types PASS after stub RED. Actual trusted actor/policy/accepted-limit supplier, real-store composition journey and default Agent mount remain required; this is not a completed injected-port substitute.

Task5 metadata closure: offline/invalid mode refuses Sonnet metadata and Gateway reconciliation, including a mode change during awaited pending read, retaining liabilities. Four new tests + online compatibility68/68 and types PASS. Task4 trusted accepted-limit supplier needs owner design review (proposal prepared/question pending); never promote attestation parsing into authority silently. Other unblocked work may continue; all tasks/scope remain intact.

Composed owned-PG progress: expanded8/8 actual SQL tests PASS, including real coordinator/store success, authority revocation after claim and settlement rollback with no retry. Provider/authority are simulated; cluster stopped. Root types PASS. Trusted acceptance-supplier design still pending; do not claim default/live composition complete.

Transport mode race closure: independent offline checks before/after DNS and final admission;34 focused composition tests/types PASS. Owner approved local protected evidence-supplier design; implement locally next, without live qualification/provisioning/enablement.

Approved supplier source implemented: fixed protected manifest/evidence reads, exact hashes/bounds/model/config and reviewed/observed time checks, conservative root/mode/no-ACL/inode profile. Seven pure/injected-IO tests PASS; default OS IO was NOT run, no live record/provisioning/enablement. Default policy/actor reader and Agent mount remain next. Host no-ACL profile qualification is an explicit real-world gate.

Task4 current reader implemented with actual joined membership/policy SQL, protected accepted-limit source, final database-time/config/policy rechecks and explicit budget. Four injected-row/evidence tests/types PASS; actual SQL membership fixture and default Agent mount remain required. No Gateway/currency dependency or live acceptance claim.

Task4 default Agent mount implemented before Gateway/credit/catalog work; real reader/repository/transport/audit source composed with no public injection argument. Explicit budget starts checked against transaction time after RED future-window test. Routing/store/existing-online21/21 and types PASS. Positive whole-default/real membership SQL, policy-admin/M02, audit/result review and final checks remain; source mount alone is not end-to-end/live acceptance.

Task4 administration prerequisite: reproduced missing M02 refusal in account/desktop writes; all three policy routes now share the existing rule, including non-Gateway model reach. Disable remains possible during policy/enrollment outages. Thirty new/existing route tests/types PASS. Offline discovery/selection and actual default end-to-end acceptance still pending.

Task4 offline admin discovery/selection implemented across account/desktop/control, with accepted configured model IDs only, no endpoint/cap edit surface, no Gateway metadata offline, and preserved M02. Forty-one route/availability/enrollment checks/types PASS after proper behavioral RED; acceptance expiry during discovery also fixed after RED. Client rendering, full default acceptance and final checks remain open.

Default-path acceptance:15/15 real owned-PG tests PASS including real Prisma/default Agent resolver for all three profiles, real membership revocation after claim, missing-cap refusal, unknown-response liability and full decisionLoop. Model/evidence/audit sink simulated; clusters stopped. Root types PASS. This materially validates the actual mount, not merely an injected coordinator; no live OS/model/production acceptance claimed. Client/docs/final review gates remain.

Task4/5 client integration: web offline chooser/no default, desktop one-local-model/no-cloud-fallback transitions, operator-owned cap guidance, stop controls and exact composer/server preference binding implemented.151 UI/transport/route compatibility tests + root types PASS; desktop types/frontend build and demo15 checks PASS after compatible own-property fix. No native visual/live acceptance. Operator docs/support corpus and final source review remain.

Review corrections: P1 isolated-provider guard restored at default/coordinator/transport boundaries; P2 terminal cancellation now propagates through currentness/claim with bounded task drain and actual transaction rollback; early unsolicited responses refuse/cancel too.33 focused tests and17 actual isolated-PG tests PASS after reproductions; no live model/OS qualification. Re-review and final broad checks remain required.
