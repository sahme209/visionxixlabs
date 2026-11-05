# Review required: legacy GitHub live source isolation

## Reproduced behavior and limits
Two synthetic tenants traverse the actual execution-graph GET/POST route, graph builder, command-center aggregator, ReleaseOps aggregator and readiness engine. With the external collector configured as a synthetic server organization, both tenants receive that organization's repository diagnostics under their own tenant labels. Two desired-isolation regression tests currently fail. No real GitHub, credential, customer database or production exposure test occurred. This is a conditional code defect when the legacy live path is configured, not proof of an actual customer disclosure.

## Root and affected paths
- `app/api/agent/execution-graph/route.ts`: sign-in check alone does not establish source ownership.
- `lib/agent/executionGraphBuilder.ts`: labels nodes with caller organization but consumes unscoped command-center state.
- `lib/platform/getCommandCenterState.ts`: calls `getReleaseOpsState({})`.
- `lib/releaseops/getReleaseOpsState.ts`: derives GitHub organization from global environment and calls the live scanner; on errors currently falls back to preview.
- `lib/connectors/github/githubLiveScanner.ts` and `githubLiveClient.ts`: use the ambient server App/PAT client, without a verified caller-bound installation/repository source.
- Direct alternate caller `app/api/github/sync/route.ts` bypasses the ReleaseOps aggregator; changing only graph JSON would leave the shared source available. Other ReleaseOps consumers include state/scan routes, remediation, control-plane, digital-twin and AxiomOS composition.

## Proposed first local unit: explicit containment, not completed live discovery
1. At the shared legacy live scanner, refuse before client construction/token resolution/network whenever the source lacks verified tenant binding. No environment switch, caller-supplied organization, role claim or boolean can opt out. Non-live mode behavior remains unchanged.
2. Use a stable typed source-unavailable/precondition error. The ReleaseOps aggregator must propagate that specific refusal rather than turn it into a successful preview fallback, so authenticated graph/direct scan callers do not report a successful live observation. Explicit synthetic preview remains accurately labeled and may continue without a live collector.
3. Preserve independently governed desktop GitHub evidence/action paths, approvals, execution claims, credentials, unknown histories and production settings. Do not touch the existing separately scoped `resolveTenantScopedToken` paths.
4. For post-repair proof keep the actual scanner in the graph composition and substitute only its external client/transport; mocking the whole scanner would bypass the proposed guard. Preserve the original narrower diagnostic as historical evidence. Verify actual graph GET/POST, direct scanner and direct sync route refuse with no client/collector dispatch, including two tenants, arbitrary organization overrides, missing scope, and legacy live configuration. Verify preview/disabled controls separately and preserve response envelopes/source labels.

## Required subsequent feature work (not replaced by containment)
Restore useful live ReleaseOps discovery only through a reviewed source composition: fresh authenticated workspace membership, exact active installation/revision, repository/owner association and supported least-privilege read profile, bounded reads and cancellation, revocation before/following awaited reads, no global PAT/App fallback or cross-tenant cached results, real request-to-readback provenance and isolated positive/negative composition journeys. Tenant UUID and GitHub organization name are different identities and must not be compared as equivalent. Current one-repository resolvers are not a license to mint organization-wide discovery tokens. This later design/qualification remains open; containment does not complete A2/A7/A8 or the master plan.

## Authorization requested
Local code and isolated synthetic tests for the first containment unit only. This changes the existing live-read authority boundary and can make the affected legacy live views explicitly unavailable, so the user's validation-first rule requires review. No deployment, production flag/schema change, real provider/customer read, token/credential, grant, service, paid CI/AI, purchase or protected human approval is included. Existing production remains unchanged until separately authorized.
