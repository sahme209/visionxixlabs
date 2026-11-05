# Funded AI helper migration — reviewed design required

## Outcome and full scope

Every inference must have a real owner, purpose, policy and reservation before dispatch, with retained uncertainty afterward. The saved source inventory is not complete transport coverage. Preserve all existing generic/Agent/coding admissions, the contained website assistant and current provider/write refusals. This proposal does not create a free/public subsidy or platform maintenance account.

The migration backlog includes scoped ReleaseOps/workforce helpers, public bot/lead products, callback planning, admin/cron probes, growth text/images, legacy/raw/provider SDKs and excluded/dynamic callers. Their funding modes differ. Do not batch-disable ordinary methods or attach guessed organization/user fields. No entire family is marked complete because its direct declaration was mapped.

**First complete local slice:** authenticated single-engineer Q&A, from the existing server-rendered form and HTTP handler through a durable request intent, current policy, existing reservation/claim, admitted instrumented fetcher, actual manager/provider/SDK, usage linkage, result persistence and honest recovery UI. This is an exercised vertical integration, not an unused capability kernel. Other callers stay explicitly unfinished; no global enforcement claim.

## Source basis

- `app/api/workforce/[id]/ask/route.ts` uses requireContext but forwards only org/question to askEngineer; its user is currently used for an audit record afterward.
- `lib/workforce/engineerAsk.ts` calls makeInstrumentedFetcher and creates a timestamp-keyed answer row. That historical timestamp is not a stable request identity.
- `lib/releaseops/instrumentedAiFetcher.ts` supplies credit checks and post-call usage, not a pre-call hold; unscoped calls can skip org policy/accounting. Its timeout race does not abort an in-flight request.
- `CurrentContext.sessionUserId` is a stable session identity; legacy `userId` may be an email fallback. An email/system/API-key label must not become a silently substituted billable member.
- Existing AIUsageReservation/admission/usage primitives provide the funding authority. Generic scope/task binding is not an exact payload quote; the new purpose must bind the actual prepared request without claiming real pricing qualification.

## Durable intent, not another credit ledger

Add one **local Prisma definition** for a tenant/actor-bound `WorkforceAIRequestIntent`, with an isolated test migration only. Do not change production schema. The existing AI reservation remains the only funding ledger; the intent contains no balance, price or billable amount.

The intent records stable request ID, authenticated org/stable actor, engineer ID, purpose/version, immutable bounded question/prepared-payload digest, selected model/options/policy binding, unique namespaced request-key digest, creation/expiry, optional unique existing reservation linkage, outcome/usage/result references and timestamps. Store only the bounded/redacted question needed for pending/recovery UI, plus its immutable digest; do not store full composed prompts, raw connector data or secrets in the intent. Model text stays in the existing Q&A result store. This does not establish complete PII redaction; retention and customer-data cutover still need review before activation. Bind the request schema/version and all copied fields; reject getters/malformed descriptors where objects cross a private capability boundary. Database relations/unique constraints must make double linkage impossible. Exact schema and SQL must receive source review before isolated execution.

Intent creation is not a spending grant. Current authenticated membership/entitlement/provider authority and the existing financial claim must still succeed. Intent states are a separately typed lifecycle, not an overload of the existing AiRationaleEnrichment closed outcome vocabulary. Avoid storing an authorization object inside riskFactorsJson/nextActionsJson. A missing production intent table must refuse this new path before dispatch, never fall back to legacy inference.

## Request and UI ownership

Keep the no-JavaScript form usable. Render a fresh cryptographically random intent nonce in a hidden field; the explicit submit carries it. Server derives the namespaced request key from the stable authenticated org/sessionUserId, engineer ID, purpose/version and nonce. Client nonce, actor/body fields, role claims and engine labels cannot issue authority. Validate nonce size/grammar. Missing stable session identity refuses; do not bill a workspace owner instead.

Within a transaction, create or resolve the exact intent. Same key/same immutable request observes existing state; same key/different request conflicts. Concurrent duplicates must not create a second reservation or start another inference. Refresh/back/duplicate submission observes the original intent, never converts it into a new attempt. A genuinely new question requires an explicit new intent; no automatic retry after unknown outcome.

Use the existing tenant/org access model for the Q&A thread, but all intent/financial result reads must recheck current actor and workspace authority. Do not widen access to another actor's private admission. Page rendering must not call AI. Show configuration/disabled, budget refusal, pending, unknown, success and storage-failure states plainly; never call an unknown result a deterministic successful fallback or suggest simply trying again. No header/model choice or old result restores authority.

## Admitted fetcher and exact dispatch

Add a separate server-only admitted composition used by this route; do not silently claim that old makeInstrumentedFetcher has become funded. Thread the real intent and current stable actor through askEngineer. The internal producer takes the intent's exact purpose/key/bounded prepared prompt+system/model/output/temperature, current policy and existing credit reservation. Extend purpose metadata explicitly; do not record workforce work as `api/ai/generate` or `coding_proposal`.

Reuse the existing reservation/serializable member claim and usage linking. A private one-use capability binds org, actor, intent/purpose, correlation, exact prepared request and all final options. It is not serializable; a string/boolean/body object cannot substitute. Consume before the one SDK attempt and before any alternate result writer can run. Malformed/mismatched/reused capabilities refuse, retaining claimed funding when appropriate. Keep existing generic/Agent/coding contracts unchanged.

The initial selected model comes from current workspace policy, not model output. Revalidate current member/provider/model policy after any awaited admission, before dispatch; a late refusal keeps the claimed hold unknown and never issues a free retry. Do not infer a qualified price from a catalog or token estimate. Current fixed-hold reservation is retained; real billable/routing bounds and canonical quote eligibility remain separate production prerequisites.

Propagate the caller abort signal and a bounded provider deadline to the actual admitted Gateway request. Do not rely solely on Promise.race or assume abort proves no bytes were sent. Disable SDK/provider retries for the admitted attempt. On timeout/disconnect/late response, retain uncertainty and prevent a second attempt; do not refund a possibly sent call or rewrite it as no-effect. Non-admitted legacy provider behavior is outside this first change.

The admitted usage producer remains the single usage writer. Instrumentation may write a bounded diagnostic record but must not bill the same generation twice. Successful usage linkage precedes customer success. A later Q&A-result persistence failure retains the usage/intent and shows a recoverable result-recording state; it never redispatches. Bind saved answer to the exact intent/usage generation; a reused nonce cannot overwrite an earlier answer or change its authority.

## Other family decisions remain explicit

1. Request-funded tenant work can migrate only from an actual current session or persisted authorized job actor with accepted membership. A stale session or system label refuses rather than inventing ownership.
2. Platform diagnostics, autonomous cron and organization-less helper calls need a separately selected and approved maintenance funding policy. This proposal adds none.
3. Public bot/lead/site products need their own product-owner entitlement, atomic allowance and consent design; access tokens/tiers/caches are not funding.
4. Image generation requires image-specific units, fees, retries and usage/unknown qualification. Do not reuse a text quote.
5. Existing consequential mutation guards and independent human approvals remain mandatory. Funding an explanation never authorizes a GitHub/ServiceNow/cloud write.

## Local acceptance before any activation proposal

- Real isolated PostgreSQL request → intent → existing reservation/claim → actual installed SDK with synthetic transport → single usage link → Q&A result → readback, plus duplicate concurrent submissions.
- Actual route obtains stable session identity; forged org/actor, email-only identity, wrong tenant, removed member, changed model/policy, expired intent and changed payload under the same key refuse before the applicable effect.
- Descriptor/forged/reused/cross-purpose capability and final wire changes refuse; verify total transport attempts, not just accepted destination captures.
- SDK timeout/abort, missing generation/usage, late completion, usage failure and result-store failure preserve funding/unknown state; observation cannot resend or turn unknown into zero cost.
- Real form/route/result components show pending/denied/unknown/result-recording states and do not infer on render or auto-retry. Same key returns saved state; new explicit intent remains subject to current budget.
- Existing generic/Agent/coding and no-inference fallbacks remain intact. No new price, fund balance, model, role, schema activation or provider registration.
- Independent code/schema/test review, scoped types and proportionate builds; retain failures and exact input/output evidence. No complete A2 or universal financial-admission claim.

## Authorization boundary

This is a proposal, not implementation authority. Requested next approval covers the actual single-engineer form/HTTP/helper/admission/store/provider-signal/result flow, one local schema definition and isolated synthetic/owned-database tests. No production migration, deployment, provider/customer read, real credential, paid AI/CI, new grant, platform subsidy, payment, price change or public offer. New real-runtime dispatch stays unavailable by default until separately authorized qualification/activation. Isolated synthetic compositions cannot issue production authority, and an enable flag alone cannot establish a qualified price or issuer. Full resource custody/issuer/fleet/Governance and separately authorized customer acceptance remain open. The pending A2 persistent preparation and health-metadata decisions are unchanged.

Rollback is local Git and owned isolated-fixture cleanup only. Preserve all existing real database branches/backups, consumed provider histories and the already-written unknown ServiceNow note. Never migrate a prior consumed attempt into a new financial intent.
