# Read-only application bridge audit — reviewed isolated test-contract candidate

The owned-full-schema PostgreSQL tests exercise real models and existing helpers,
not a running Next application/customer payment journey. A false operationalPermit
in a returned preview does not protect other entry points. New test rows currently
use compatibility tier growth, so exposing this database to unmodified application
routes would incorrectly select legacy $200/org credit policy. Do not activate an
application runtime against it until the following boundary is implemented.

## Concrete unsupported entry points

| Entry or shared boundary | Current interpretation | Required isolated-new-test action |
| --- | --- | --- |
| POST /api/ai/generate | checkWorkspaceAICredits -> legacy flat pool/status-insensitive preflight; reserveAICredits called without isolated resolver | Both preflight and reservation must use verified version inside the actual transaction, including pending holds/current account; no default legacy fallback. |
| lib/axiom/agentRuntime/governedAiCall; lib/releaseops/instrumentedAiFetcher | Shared preflight uses legacy mapping; governed calls are a broad desktop/agent provider boundary | Select verified version or deny new-test calls before any provider request. Do not merely fix the standalone generate route. |
| lib/agents/aiWorkflowTranslator; lib/insights/tenantInsightsSynthesizer; lib/workforce/pipelines/codeProposeRealExecutor | Shared AI preflight from legacy mapping | Deny until routed through the same verified new-test admission contract. |
| POST workforce/dr_planner_engineer/run-domain, compliance_framework_engineer/run-domain, workload_performance_engineer/run-domain, safety-preflight/run, sweep-now; monitoring webhook | Each invokes legacy credit preflight, sometimes via noninteractive automation | Explicit deny in new-test runtime until version-aware; cron/webhooks must not bypass an HTTP customer guard. |
| POST /api/workforce/coding-tasks/start; lib/billing/enforceEntitlement | Legacy registry feature/count limits; missing read falls back Starter | New test catalog does not define all legacy dimensions/features. Return unsupported/policy_unresolved rather than infer Growth permissions. |
| lib/cloud/aws/enrollment/service.ts | Current canonical legacy plan shaping -> planForStripeTier cloud-account cap inside Serializable enrollment | Version-aware explicit test cloud-account policy or deny new-test enrollment; public catalog has no exact cloud-account numerical contract. |
| lib/security/authenticateApiKey; GET /api/v1/whoami | Legacy plan monthly API allowances; quota read failure can fail open | Reject API-key access in initial isolated lane, or implement explicit new-version API contract without fail-open. |
| lib/billing/tierGate gateAndConsume/peekGate | Legacy autonomy/outbound/runbook caps; permissive fallback on errors | Disable new-test background schedulers/outbound/automation until version-specific rules exist. |
| lib/billing/deploymentDispatchReservation, deploymentQuota, organizationSeatClaim | Public active status/seat mappings already used, but tier is still not version provenance; missing rows can mean Free | Preserve existing legacy behavior; new-test selection requires immutable binding/runtime/account evidence and unavailable-state denial. Pricing similarity is not a trust boundary. |
| POST billing checkout-session; stripe-webhook; portal-session; desktop/billing/portal | Existing recurring helper lacks new intent contract; webhook existing reconciler has no new provenance path; portal has no contract-change metadata workflow | Only explicitly reviewed isolated adapters may create/reconcile new-test intents. Existing public paths must be unavailable for these synthetic organizations until bridged. No generic webhook dual-consumer race. |
| POST cron/settle-ai-usage; settleAIUsageToStripe | Opted-in actual customer settlement can invoice all settled billedCents without included-credit allocation | Keep disabled for new-test contract; worker must explicitly exclude or reject this version until covered/uncovered policy is implemented. Disable entire isolated worker initially. |
| GET billing/add-ons; billing/plan; control/usage-billing; dashboard/billing; billing alert scanner | Mixed public labels/legacy entitlements or flat pool and plan-derived limits | Use one versioned read result with provenance/availability and period/paid seats/holds. Website balance helper currently legacy by default is not new-test paid-UI alignment. |
| desktop access/identity and Settings/model entitlement surfaces | Commercial policy deliberately identity-only; plan labels not full entitlement authority | Preserve pairing/identity but deny unsupported new-test operations. Do not treat successful pairing as commercial acceptance. |
| /api/axiom/{agent/onboard,agent/approve,agent/run,tasks,tasks/retry,approvals,approvals/[id],execution/apply,autopilot,preferences,execute-fixes,explain,entitlements,chat,scheduler,diff,cloud/validate,cloud/snapshot}; /api/execution/run | Read User.plan -> lib/entitlements; organization purchase does not update it | Deny unsupported new-test feature scope; do not promote purchasing user's global User.plan or infer these capabilities from Pro label. |

This is a source audit, not complete dynamic reachability proof. New routes must be covered
by a default-deny integration contract instead of trusting a frozen list forever.

## Smallest safe bridge

1. A dedicated isolated runtime validates its actual loopback disposable database
   binding and server-owned synthetic organization eligibility; it never points
   at production or chooses a lane from request catalogVersion/metadata. Legacy
   production runtime must never query new proposal tables.
2. New lane is explicit and default-deny at the server boundary. Initially permit
   only necessary authenticated purchase/reconciliation/balance/AI endpoints after
   each has version-aware handling. Reject every other operational API, cron,
   scheduled job and provider helper in that runtime. A middleware-only route list
   does not protect background functions; shared provider/admission boundaries
   need the same unsupported-lane guard. No live/production route activation yet.
3. One IO resolver returns a closed union: legacy (only explicitly existing legacy
   lane), verified_new_test (full immutable provenance + current account/mode/
   tenant/subscription binding + current status/seats + UTC period), unavailable,
   unsupported. An absent table/contract in an explicitly new-test lane is NEVER
   legacy/free fallback. Versioned data cannot be projected through planForStripeTier.
4. Reuse that resolver for preflight, actual Serializable reservation and read-only
   balances. Resolver executes before reused-hold success. Same published catalog
   and same used/paid-top-up/pending-hold evidence drive all three. No User.plan
   mutation and no automatic invoice item. Undefined cloud/features/API allowances
   remain unsupported, not expanded Growth rights.
5. Actual Next route tests must prove valid synthetic owner/member identity,
   workspace switching, missing/mismatched provenance, account/mode changes,
   table outage, unsupported API/job denial, exact $10/seat pool and pending holds,
   historical legacy unchanged, no provider dispatch on denial. Full current schema
   fixture tests are necessary but not this HTTP/browser acceptance proof.
6. Real Stripe adapter must independently verify original attempt provenance; never
   fill providerRequestKey or digest from webhook metadata or newly reconstructed
   request. Missing provider request evidence remains reconciliation_required.

## Hosted Stripe TEST acceptance inputs still absent

- Secure existing TEST account credential and stable account identity; no live key
  or secret printed. Test-only authorization exists, but access is absent.
- Dedicated isolated app runtime/domain and database binding, synthetic data only;
  reviewed proposal tables and actual current app schema, not production migration.
- Exact existing approved test price IDs verified USD, licensed per-unit, correct
  interval/count, active/nondeleted, Pro2900/27840 and Enterprise7900/75840 cents,
  no mixed/metered/quantity transforms. Never run legacy pricing-sync script.
- Secure endpoint-specific test webhook secret and actual signed provider delivery
  to that isolated runtime; current API origin/auth callback/session setup.
- Independently available provider request/session evidence for response-lost
  reconciliation; immutable request/intent/account correlation, not metadata claims.
- Bounded actual test checkout/payment/status/cancel/replay actions, synthetic
  customer/card, retained private evidence and authorized test cleanup.
- Actual AI Gateway credential/model/receipt access only if testing real cost;
  bounded provider budget and positive customer cap. Until then cost evidence is
  fixture-simulated. No invoice/overage activation until coverage rules reviewed.

No code or provider changes performed during this bridge audit. Independent
reviewer found no additional material blocker in the bounded owned-loopback
fixture slice; that is not approval to expose unmodified operational entry points.
