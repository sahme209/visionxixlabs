# Azure Read-Only Enrollment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Execution stays in this agent; no subagents. Root reviews this spec/plan before product code.

**Goal:** Deliver desktop Azure enrollment, scoped canonical storage, explicit first-page resource-group inventory, local disconnect and fresh reconnect.

**Architecture:** Separate Azure routes, server modules, desktop contract/client/component preserve AWS interfaces. Reuse canonical account/vault/session/entitlement helpers without changing their implementations. Only one bounded IO module calls the real Azure SDK and HTTPS.

**Tech Stack:** TypeScript, Next.js routes, Prisma/Postgres, AES-GCM scoped vault, installed Azure Identity and ARM Resources SDKs, React desktop, Vitest and owned Node HTTP fixture.

**Spec:** `docs/superpowers/specs/2026-10-16-azure-readonly-enrollment-design.md` (read together).

## Global Constraints

- No real cloud calls, production mutations, deploy, installers or live billing are authorized.
- No product code before root review. Fresh branch at `2682ba732ab1bd262dcaa378e3a6e3119d245229`; no master or canonical tracker changes.
- Do not edit AWS, ECS v3 contracts/review kernels, Terraform, Airflow, shared vault implementation, package lock or schema.
- Explicit tenant/subscription/client UUIDs and bounded secret only; no lead payload, environment credential/endpoint, ambient chain or caller URL.
- Canonical CloudAccount/Credential; Azure-bound AEAD; disabled observe-only rows; quota and reconnect CAS in final Serializable transaction.
- Network: exact public Microsoft hosts and paths, one 15-second deadline, 5 seconds/request, at most 3 requests, zero retries, no redirects/pagination, 131072 bytes/response before buffering.
- Inventory: at most 100 groups, one SDK page, `complete:false`, fixed safe limitations; no broad Reader-only permission claim.
- Desktop secret never persisted, echoed, logged, exported to token API, or sent to AI; clear on submission/context change.
- Living docs plus Desktop App Pairing demo update in same product commit. Coordinate any full compiler/build/test run with root.

## Review Focus

1. Delayed enrollment after admin removal must fail storage even if Azure accepted credentials (Task 3).
2. Shared quota's last slot cannot be consumed concurrently by different providers; missing entitlement lookup must fail before IO (Task 3 and Task 6 DB rehearsal).
3. A delayed inventory/list/disconnect must not resurrect pre-disconnect or replaced connection state in desktop (Task 5).
4. ARM nextLink, redirects, compressed/oversized chunks and metadata-selected token hosts must not expand network authority (Tasks 1–2).
5. A lost POST response must demand refresh without automatic secret replay, and audit failures must preserve committed success (Tasks 3–5).

## File responsibilities

- `lib/cloud/azure/enrollment/policy.ts`: strict inputs, safe errors, Azure AEAD context, public types and runtime guards.
- `boundedHttp.ts`: exact URL/method/query/budget/time/byte gate and verified production HTTPS transport.
- `providerClient.ts`: actual ClientSecretCredential/MSAL, fixed subscription GET, ARM resource-group first-page SDK and internal token lifetime.
- `service.ts`: canonical repo interface, current authority, enrollment/list/disconnect, quota and Serializable CAS.
- `scopedConnection.ts`: read/decrypt/use/recheck current connection and authority.
- `runtime.ts`: Prisma composition, session principal, audit/error mapping and request-body bound.
- Four new route modules under `app/api/desktop/cloud/azure`; no generic AWS routes changed.
- `desktop/src/lib/azureEnrollmentContract.ts`: desktop input/public validators; imports no server/vault/SDK.
- `desktop/src/lib/azureEnrollmentClient.ts`: paired native API requests and fixed safe error text, no desktopClient edits.
- `desktop/src/components/AzureReadOnlyEnrollment.tsx`: capability-gated secret form, canonical list, inventory, versioned disconnect/reconnect and async response ownership.
- Tests in root-discovered `lib/cloud/azure/enrollment/__tests__`, `app/api/desktop/cloud/azure/__tests__`, `components/__tests__`.
- Owned fixture/rehearsal scripts under `scripts/fixtures` and `scripts`; no product endpoint override.

### Task 1: Lock safe policy and streaming transport

**Files:** Create `lib/cloud/azure/enrollment/{policy,boundedHttp}.ts`; tests `__tests__/{policy,boundedHttp}.test.ts`.

**Interfaces:** `parseAzureEnrollmentInput(unknown):AzureEnrollmentInput`; `parseAzureDisconnectInput(unknown):{expectedVersion:number}`; `azureCredentialContext({organizationId,accountId,version}):string`; `AzureEnrollmentError` with spec error union; `createBoundedAzureHttpClient({tenantId,subscriptionId,operation:"validate"|"inventory",signal?,send?}):HttpClient`. `send` is a low-level dependency used only by test construction; production default is verified fixed HTTPS. Return no direct token to consumers.

- [ ] Write failing tests for strict fields/UUID normalization/16KiB body and 4096-byte secret bounds; expectedVersion create/reconnect integers with active version capped at 2147483646 to reserve disconnect; Azure AAD differs from AWS/other org/account/version; foreign host/path/query/redirect/compression/overflow/duplicate/budget rejection. Assert response overflow chunk is never appended. Verify 5-second/request and 15-second total abort destroy the active request.
- [ ] Run `npx vitest run lib/cloud/azure/enrollment/__tests__/policy.test.ts lib/cloud/azure/enrollment/__tests__/boundedHttp.test.ts`; expect missing implementations/failing assertions.
- [ ] Implement policy and transport exactly to spec. Keep successful response allocation below cap and fixed error codes free of original body/error text. Default HTTPS cannot consume proxy/agent/endpoint environment values.
- [ ] Repeat focused tests; expect all pass. Inspect module imports for env credential resolvers, loggers and leaked token/secret values.
- [ ] Commit Task 1 source/tests on isolated branch.

### Task 2: Actual SDK bounded provider IO

**Files:** Create `providerClient.ts`, `__tests__/providerClient.test.ts`; create permanent `scripts/fixtures/ownedAzureWireFixture.mjs` and its egress guard; preserve throwaway result only as prior feasibility evidence.

**Interfaces:** `validateAzureEnrollment(input:AzureCredentialInput):Promise<{tenantId:string;subscriptionId:string}>`; `readAzureResourceGroups(input:AzureCredentialInput):Promise<{resourceGroups:AzureResourceGroup[];complete:false;scope:"first_resource_groups_page";limit:100;limitations:string[]}>`. Provider module accepts a test factory for bounded HTTP transport without exposing URL/secret/token options through routes. Product defaults always fixed.

- [ ] Write failing tests: exact echoed subscription+tenant/resource ID required, token never in output, mismatched identities fail, malformed groups fail, empty first page succeeds only with `complete:false`, >100 rows capped, access-denied differs from timeout/malformed. Verify actual SDK serializes `$top=100`/`api-version=2025-04-01` and first page only; embedded malicious nextLink is not requested.
- [ ] Run `npx vitest run lib/cloud/azure/enrollment/__tests__/providerClient.test.ts`; expect fail.
- [ ] Implement fresh explicit ClientSecretCredential, pinned Microsoft authority, disable discovery, zero retries/redirects, safe logging; acquire once internally, privately reuse short-lived token in ARM SDK credential wrapper; subscription GET uses pinned API `2022-12-01`. Apply Task 1 bounds to both Identity and ARM traffic. Strict validate every outgoing metadata-derived URL before IO.
- [ ] Reuse the proven throwaway transport pattern in permanent owned fixture, with exact synthetic values and explicit egress rejection. Exercise actual SDK token and group serialization; 302, giant streamed body, denied ARM, attacker nextLink, wrong subscription and alternate metadata host all fail closed. Run focused provider/transport tests; expect pass and no non-owned requests.
- [ ] Commit Task 2 source/tests/fixture.

### Task 3: Canonical enrollment, read binding and disconnect

**Files:** Create `service.ts`, `scopedConnection.ts`, `__tests__/{service,scopedConnection}.test.ts`.

**Interfaces:** `createAzureEnrollmentService(repo:AzureEnrollmentRepo,deps?:Partial<AzureEnrollmentDependencies>)` returns `enroll(principal,input):Promise<{account:AzureAccount}>`, `list(principal):Promise<{accounts:AzureAccount[]}>`, `disconnect(principal,accountId,expectedVersion):Promise<{account:AzureAccount}>`, `inventory(principal,accountId):Promise<AzureInventory>`. Principal is `{organizationId,userId,sessionId}`. Repo exposes canonical delegates for CloudAccount/Credential, TenantBillingPlan, DesktopSessionRecord, OrgMembership and callback Serializable transaction; no lead delegates. Dependencies include `now`, `randomId`, `seal`, `open`, `validate`, `read`, `configured`, `audit`.

- [ ] Write failing tests asserting no provider IO for unaccepted/foreign/revoked/expired/non-manager authority, missing required tables, missing encryption config/quota, wrong initial version or enabled/legacy pointer. Count account usage across providers. New enrollment stores `cloud-v2:<id>`, disabled/observe-only, Azure v2 ciphertext with only four explicit credential fields. Wrong-context decrypt fails.
- [ ] Add deferred-IO tests for admin/device revocation and account/version/revocation change before final transaction; assert zero commits. Race final slot/new subscription claims and same-subscription replacements. Check version max overflow and provider validation failure preserve state; audit throw after commit still returns success.
- [ ] Add disconnect/reconnect/read tests: zeroize and increment atomically, same expected version idempotent, unrelated version conflicts, disconnect works without provider/decryption/commercial gate, late inventory rejected after disconnect/reconnect/role removal, revoked read performs no provider IO, reconnect requires fresh provider validation at current version.
- [ ] Run `npx vitest run lib/cloud/azure/enrollment/__tests__/service.test.ts lib/cloud/azure/enrollment/__tests__/scopedConnection.test.ts`; expect fail.
- [ ] Implement current-authority helper plus service and scoped reader with before/after checks and Serializable final CAS/quota. No whole-row/provider errors or ciphertext in public results.
- [ ] Repeat focused tests; expect all pass. Commit Task 3.

### Task 4: Reachable paired desktop backend

**Files:** Create `runtime.ts`; create `app/api/desktop/cloud/azure/enrollment/route.ts`, `accounts/route.ts`, `accounts/[id]/inventory/route.ts`, `accounts/[id]/disconnect/route.ts`; tests `app/api/desktop/cloud/azure/__tests__/routes.test.ts`.

**Interfaces:** Runtime exports composed Azure service, `azureEnrollmentPrincipal(request,mode:"read"|"manage"|"disconnect")`, `azureEnrollmentFailure(error)`, bounded `readAzureJsonBody(request)`. Routes consume Task 3 methods and exact spec envelopes/statuses.

- [ ] Write failing route tests for bearer only, no API key/cookie fallback, wrong methods/unknown fields/query/body overflow, exact capability/scope mapping, disconnect's `requireActiveAccess:false`, safe fixed messages and provider errors without secret echo. Verify foreign IDs return 404 without provider work.
- [ ] Run `npx vitest run app/api/desktop/cloud/azure/__tests__/routes.test.ts`; expect fail.
- [ ] Implement narrow session/Prisma composition and routes, fixed safe audit kinds/summaries and body-size gate before parsing. No endpoint/config override reaches provider module.
- [ ] Repeat route tests plus focused service tests; expect pass. Commit Task 4.

### Task 5: Complete desktop connection lifecycle

**Files:** Create Azure desktop contract/client/component; tests `components/__tests__/{azureEnrollmentClient,azureReadOnlyEnrollment}.test.ts`; modify SettingsView import/mount and Azure Connectors card; update `desktop/{README.md,security.md}`, `app/docs/azure-setup/page.tsx`, `lib/demo/demoScenarios.ts`.

**Interfaces:** Contract exports `AzureEnrollmentInput`, `DesktopAzureAccount`, `DesktopAzureInventory` and strict response guards. Client exports `azureEnrollmentClient` with `enroll(input)`, `list()`, `inventory(accountId)`, `disconnect(accountId,expectedVersion)` returning existing `ApiResult<T>` envelope. Component exports `AzureReadOnlyEnrollment({identity:VerifiedDesktopIdentity})` and consumes no server imports.

- [ ] Write failing client tests for paired-token-only requests/credentials omit, strict summary and same account/version matching, malformed error responses and secret-echo server text reduced to client-owned copy; never retry POST automatically.
- [ ] Write failing UI tests for connect→list→explicit inventory→disconnect→reconnect, secret immediately cleared, read-only member secret form unavailable, disconnected/inventory unavailable distinct, identity/workspace/capability changes erase state, stale list cannot undo new version, pending disconnect immediately suppresses old/late inventory, stale disconnect cannot erase re-enrolled account, uncertain POST releases busy and requires refresh.
- [ ] Run those focused tests and expect fail. Implement controlled capability-gated form, request generation/version refs and fixed spec copy. Mount beside AWS; working Azure setup CTA navigates Settings. Do not make GCP capability claims or alter AWS behavior.
- [ ] Update named docs/demo in this product commit with actual bounded capability and today lastReviewed. Run focused tests plus `npx vitest run lib/demo/__tests__/demoScenarios.test.ts`; expect pass. Review accessibility/react guidance before completion.
- [ ] Commit Task 5.

### Task 6: Owned full route/storage/SDK acceptance

**Files:** Create `scripts/rehearse-local-azure-http.mjs` and fixture child-environment/guard helper as needed. Extend the owned local pairing harness only through an explicit isolated Azure rehearsal hook; do not change production auth, app entry point or SDK endpoints for test convenience.

**Interfaces:** Rehearsal consumes the existing owned Postgres URL/client/deviceRequest/paired token fixture, verifies database name/loopback ownership before writes, and produces a sanitized receipt identifying actual routes/SDK operations plus unverified production/native claims.

- [ ] First run rehearsal against absent implementation and capture the concrete failing assertion, never seed a prevalidated Azure connection.
- [ ] Exercise actual pairing session -> Azure enrollment endpoint -> SDK token/subscription wire -> canonical AEAD row -> list -> first SDK resource-group page -> zeroizing disconnect -> blocked revoked read -> revalidation/reconnect; assert exact safe public payload and no lead credentials/extra workflow/billing writes.
- [ ] Repeat using existing foreign account metadata, revoked session, admin removal during delayed IO, wrong response subscription, denied/302/oversized provider response, reconnect/disconnect race, and transaction quota race. All non-owned SDK egress is blocked before imports. No provider credentials or paid state are invented to bypass entitlement.
- [ ] Run targeted suites from Tasks 1–5 once after fixture fixes; check `git diff --check`; root coordinates full tsc/build/full-suite so heavy processes do not overlap.
- [ ] Hand root branch/commit list, exact owned receipt, checks and known limits. Root owns final full checks, push/PR/merge/tracker. Do not claim real Azure permission, production schema readiness or native installer acceptance.

## Self-review before handoff

Every spec requirement maps to a task: inputs/body/AAD/stream bounds Task 1; real provider identity/budget and bounded page Task 2; authority/quota/reconnect/disconnect races Task 3; paired routing/safe envelopes Task 4; desktop ownership/copy/docs Task 5; complete actual HTTP+DB+SDK chain Task 6. Shared model and AWS contracts remain untouched. All five Review Focus risks have explicit assertions. The throwaway SDK probe is complete; all product tasks remain unchecked until root review.

## Execution evidence (2026-10-16)

Root approved `82f5a14d`, then independently reviewed production Azure source `22d83f31` and explicit fixture wiring `e65d88f3` with no material findings. Service, strict transport, real SDK, paired routes and desktop tests were observed red before implementation and green afterward. Regression tests additionally caught SDK missing-value-to-empty fallback and provider error/secret echoes; the boundary now rejects/sanitizes them before public results or SDK error logging.

At the initial `15878450` owned run, production Azure source was unchanged from `22d83f31`; the supported per-client SDK logging correction below later changes only `providerClient.ts`. Normal merges retain reviewed App `f9ce5500` and finalized Terraform `3a74b249` dependencies. Standalone fixture-only `15878450` removes the Next build-time server-only marker from the temporary source loader; actual ClientSecretCredential/MSAL, ARM serialization and default bounded product HTTPS remain intact.

Actual owned HTTP+Postgres acceptance passed at exact source `15878450068a7dc08a22d556ad27fd08fb68585a`: 38 named check groups, including 13 Azure groups, with 20 guarded wire calls. Separate small actual-source SDK probe: four wire calls. See `docs/AZURE_READONLY_CUSTOMER_ACCEPTANCE.md` and receipts under `docs/mission/local-azure-*`. Existing commercial observation is no_plan/allowed, not a paid grant. Owned container and Next processes were independently confirmed absent after cleanup.

No schema, dependency, shared-vault implementation, AWS, ECS review kernel, Terraform apply or canonical tracker changes were made by the Azure increment. Root retains full compiler/build/broad-suite/CI/integration ownership. Real Azure/native/production acceptance remains outside this evidence.

Initial focused verification before the logging correction: **113 tests passed across 9 files** (Azure service/transport/provider/fixture, paired routes, desktop client/UI, demo contracts and owned launcher). `git diff --check` passed. The initial checksum comparison confirmed 13 Azure production modules matched reviewed `22d83f31`. The current manifest records the corrected source at `4478efb0`; only `providerClient.ts` differs from that review base. The historical initial HTTP receipt binds `15878450`.


Post-integration SDK type review found four diagnostics that transpile-only tests did not detect. The correction types the test headers and credential fixture, implements all installed SDK Debugger fields for Identity, removes the unsupported ARM loggingOptions field, and removes that client’s actual HTTP logging policy before IO. No global logger mutation or vendor-option suppression is used. Affected tests/SDK options compile in a small isolated fixture; new tests were observed red then green. Focused result: 116/10, plus four-request actual-source SDK probe. The synthetic device expiry now remains valid independently of wall-clock execution time; authority-expiry tests still explicitly expire it. Scoped independent review and root whole web/desktop types plus desktop build passed. The new full HTTP/source binding below supersedes the historical initial run.


## Corrected final runtime binding

The supported-logging candidate reran the complete owned Next/Postgres/MSAL/ARM lifecycle at frozen `4478efb00df46fd2f2aa2212d762988ce24ab2cd`, with unchanged source asserted before and after. All **38 named check groups** passed (11 auth, 10 pairing, 4 approvals, 13 Azure), with **20 guarded Azure wire requests** and the same strict negative cases. No product changes were made during or after the run. The four-request small actual-source SDK probe is separate evidence. The former `15878450` receipt is retained under a historical filename; it is not claimed as current source acceptance.

Cleanup: owned-container removal assertion passed, a subsequent managed-daemon ownership-label listing was empty, and zero Next processes for the Azure worktree remained. Commercial observation remains the existing `allowed:true`/`active`/`no_plan` policy without paid grants. Scoped review, isolated installed-SDK/affected-test types, 116 focused tests in 10 files, root whole web/desktop types and desktop build passed. Root retains final full Vitest/integration/CI ownership.
