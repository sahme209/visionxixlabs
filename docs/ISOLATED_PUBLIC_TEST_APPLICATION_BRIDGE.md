# Isolated public TEST application bridge

Baseline main154 `50f54d65`; local evidence dated2026-10-16. This source is
**default off** and does not activate an application runtime, production schema,
prices, Stripe or any external provider. Existing customers/support payments retain
their normal path. Only the owned local fixture process selects this lane.

## Reused application authority

The existing NextAuth credentials/session and currentContext establish identity.
The existing control billing page calls currentAIAllowance; the existing generate
handler uses shared credit preflight and the actual Serializable reservation
ledger. A shared verified-contract IO reader checks the runtime/account marker,
organization, false livemode, catalog version, bound intent, immutable account/
customer/subscription/session/plan identity and current actual TenantBillingPlan
status/seat/token. Current accepted membership is rechecked in the transaction.
The same resolver projects the public TEST base into read/preflight/reservation;
new missing/mismatched proof never falls back to the legacy Growth pool, including
reservation replay. Legacy mode never queries these new tables and its defaults
remain unchanged. The internal fixture adapter reuses the shared verifier.

Public TEST assumptions remain active-only paid, inactive Free, UTC month and
current verified licensed seats; actual paid top-ups, used amounts and pending
holds retain existing ledger arithmetic. No User.plan grants, automatic overage,
invoice items or new feature/cloud allowances are introduced.

## Runtime and unsupported-operation boundary

Only a server process variable selects the lane. Headers, body/catalog metadata,
query parameters and cookies cannot select it. Invalid selected configuration
fails closed. Before constructing the ambient Prisma client, the target must be
PostgreSQL on127.0.0.1 with the exact dedicated fixture database, no URL parameters,
matching direct URL, explicit runtime/account/organization configuration, and no
Vercel or production runtime. No legacy global Prisma client is reused. An
isolated-only query extension checks the actual runtime/account marker through
the fixed unextended client before model/raw queries, including authentication
and membership bootstrap. The transactional contract reader separately rechecks
proof; the extension is not entitlement authority.

A server-created AsyncLocalStorage scope binds current authenticated organization
and actor. Read scopes allow current accepted members; admission scopes require
current owner/admin and are rechecked in the actual transaction. Unscoped background
credit calls are unsupported. No positive provider permit exists.

Exact isolated HTTP allowlist:

| Path | Methods |
| --- | --- |
| /api/auth/csrf, /api/auth/session, /api/auth/providers | GET |
| /api/auth/callback/credentials | POST |
| /api/auth/signout | GET, POST |
| /auth/signin, /auth/error, /control/usage-billing | GET |
| /api/ai/generate | POST; admission only, provider remains disabled |

Next-Action transport is denied even on allowed paths. Other SSR pages, OAuth,
checkout/portal/webhooks, desktop/cloud/features, support payments, API keys and
cron HTTP endpoints are unsupported. Existing static asset matcher exclusions
remain unchanged. Standard-mode proxy/security/CORS behavior is preserved.

Provider denial also applies beyond HTTP: manager generation/health, direct
Gateway, aiFetch-backed legacy adapters, direct OpenAI/Anthropic/Gemini SDK
functions, model discovery and direct growth image generation deny before IO.
Gateway reconciliation, invoice settlement, legacy quota/feature/API-key admission
and execution engines also reject the isolated lane before their work. These
are lightweight pure flag checks; provider modules import no Prisma, server-only
request scope or AsyncLocalStorage. Actual full workflow/cloud/feature support
is not added by this bounded allowlist. The isolated launcher starts no scheduler.

## Actual local HTTP evidence, not hosted payment acceptance

Explicit fixture command:

```sh
AXIOM_RUN_OWNED_COMMERCIAL_FIXTURE=1 AXIOM_RUN_OWNED_COMMERCIAL_HTTP=1 npx vitest run lib/billing/__tests__/newTestSubscriptionService.postgres.test.ts
```

The test provisions only a unique owned cached PostgreSQL17 container, empty
loopback database and full current schema with generation disabled. No production
migrations/history reset. It refuses .env files. An independent local Next dev
process uses a sanitized environment: no inherited Stripe/AI/cloud credentials,
AWS shared/config files point to/dev/null and metadata lookup is disabled. An
explicit **inert noncredential marker** exercises the existing configured-provider
policy/hold branch, while primary code guards independently prohibit SDK IO.
There is no fake provider success. Fonts are mocked only in the test process to
avoid external font downloads; product fonts/design source are unchanged.

The test uses actual HTTP NextAuth CSRF, credentials callback and session with a
synthetic verified User/password and derived organization, not forged identity
headers. The contract was created through the foundation's clearly simulated
provider boundary before launching the app; this does not establish real Stripe
attempt proof. HTTP evidence covers three-seat$30 pool/$27.50 remaining with a
$2.50 unresolved hold; actual cap denial before a new hold; unsupported operations;
provider-disabled failure releases its actual100c hold with zero generated usage;
current role downgrade denies another hold; unavailable provenance renders
Unavailable and hides the compatibility plan panel without a$200 legacy fallback.
Unsupported deployment allowance is explicitly unavailable and never queries the
legacy quota in this lane. Missing-marker authentication denial
is checked before the valid-marker login. All child processes and only the owned
container/temp font fixtures are removed in finally. No payment/generation/real
Gateway receipt or complete customer journey is claimed.

New focused regressions were observed failing before fixes: eight HTTP/provider
cases, four allowance/provenance cases, direct background authority, two extra
SDK/reconciliation bypasses and four method/server-action cases. Existing page,
reservation, generation, allowance and Gateway reconciliation tests also run.
Local final full suite passed: 606 files, 6447 tests, 5 skipped (70.17s).
Web TypeScript, desktop TypeScript/release alignment/Vite build and 30 Python
unit tests passed. New bridge modules/tests lint clean; changed-source lint
retains five existing explicit-any errors in aiCreditReservation.ts (unchanged
base types). Direct Next optimized build passed (webpack56s, TypeScript76s,
293 static pages), with fixture-only offline font CSS and no Prisma generation.
A conservative3GB initial build exhausted its compiler heap; the single4GB retry
passed without source/gate changes. Exact-head CI remains a coordinator gate.

## Remaining gates

Real secure Stripe TEST account/key, exact configured approved test prices,
endpoint-specific webhook delivery and **independent original provider-attempt
proof** remain absent. Never derive request key/digest from event metadata or a
fresh reconstruction. Actual Gateway access and cost receipt need separate
bounded evidence. OAuth/email/signup/native desktop and governed cloud deployment
are not exercised by this credentials/read/admission slice. Extending the
allowlist requires its own version-aware admission/read/role/provider review.
Production/live activation or migration still requires explicit owner approval.
