# Azure desktop enrollment and bounded read-only inventory

Status: proposed for root review; product implementation has not started.
Base: `2682ba732ab1bd262dcaa378e3a6e3119d245229` (PR #160).
Worktree: `/workspace/axiom-azure-readonly`, `codex/azure-readonly-enrollment`.

## Customer outcome

An accepted workspace owner/admin using a browser-paired desktop session can connect an already provisioned Azure service principal, verify the exact subscription, request a bounded first page of resource groups, disconnect local Axiom access, and reconnect with freshly validated credentials. Other accepted desktop members with `workspace:read` may list connections and request inventory. Connection validation and inventory availability are separate facts.

The workflow uses the existing canonical `CloudAccount` and `CloudAccountCredential` models and scoped AEAD. It does not use `lead.fullPayload`, host Azure credentials, an ambient credential chain, the existing Azure snapshot adapter, or the old cookie-oriented validation route. Generic Agent scans remain disabled. It does not provision identities, grant permissions, inspect secrets, enumerate billing, mutate resources, deploy, apply Terraform, or execute rollback. Verification of subscription read access does not prove a Reader-only role assignment or permission to every Azure resource type.

## Bounded product surface

Routes are new and Azure-specific, preserving the AWS-only generic route contract:

- `POST /api/desktop/cloud/azure/enrollment`: validate and create/replace an enrollment.
- `GET /api/desktop/cloud/azure/accounts`: list tenant-owned enrolled Azure accounts.
- `GET /api/desktop/cloud/azure/accounts/:id/inventory`: explicitly read the bounded first resource-group page. Reject query parameters.
- `POST /api/desktop/cloud/azure/accounts/:id/disconnect`: zeroize local credentials, using expected connection version.

All routes return `{ok:true,data:...}` or `{ok:false,error:<stable code>,message:<fixed safe text>}` and are `force-dynamic`, node runtime. Successful account summaries never contain token, secret, ciphertext, SDK errors, or raw provider body. No `/api/v1` routes or SDKs change.

Desktop Settings displays `AzureReadOnlyEnrollment` beside the AWS component. Connectors' Azure card navigates to Settings and accurately describes this released read-only capability; GCP remains explicitly blocked. A separate `azureEnrollmentClient.ts` uses the configured desktop client origin and paired token, the existing installed native fetch bridge, `credentials:omit`, and POST/GET only. It does not add cookie fallback. AWS contracts and existing `desktopClient` cloud methods stay unchanged.

## Input and public contract

Enrollment input contains exactly `tenantId`, `subscriptionId`, `clientId`, `clientSecret`, `expectedVersion`. The three IDs are canonical lowercase UUIDs after trimming; accept UUID syntax, not arbitrary tenant names or authority URLs. Secret is an untrimmed nonempty string of at most 4096 UTF-8 bytes, with NUL/control characters rejected. Total request body limit is 16 KiB, counted while reading before concatenation/JSON parse. No caller-supplied endpoints, resource IDs, provider choice, encrypted references, scopes, flags, roles or sessions are accepted. `expectedVersion:null` means create only; reconnect/revalidation requires an integer `1..2147483645` matching the existing credential version. Unknown fields fail.

Disconnect input contains exactly `expectedVersion`, integer `1..2147483647`. Account IDs must be nonempty, at most 128 characters and encode as one path segment. Secret errors never include submitted values.

Public account type:

```
AzureAccount = {
  id: string; provider: "azure"; subscriptionId: string;
  connected: boolean; status: "connected" | "disconnected";
  connectionVersion: number; lastValidatedAt: string; revokedAt: string | null;
  enabled: false; agentScanAvailable: false;
  inventoryAvailability: "not_checked" | "unavailable";
}
```

List returns `{accounts:AzureAccount[]}` (at most 100 enrolled rows, newest first). Enrollment/disconnect return `{account:AzureAccount}`. List only selects tenant/provider-owned rows with `enabled:false` and the canonical `cloud-v2:<id>` pointer; it validates the credential row tenant, positive version, v2 envelope for live rows, or empty ciphertext plus revokedAt for disconnected rows. It does not decrypt credentials.

Inventory returns `{accountId,subscriptionId,connectionVersion,observedAt,scope:"first_resource_groups_page",complete:false,resourceGroups:[{id,name,location}],limit:100,limitations:[fixed text]}`. Emit at most 100 whitelisted resource groups; validate every returned ID has the exact requested subscription/resourceGroups prefix and matches the returned name, name/location string bounds and absence of controls. Reject malformed groups rather than manufacturing identities. `complete:false` is always present, including an empty response without nextLink. An empty observed first page is distinct from denied/timeout/malformed/unavailable outcomes. No nextLink is returned. No public-IP, cost, VM/storage, security posture, global permission or whole-subscription completeness claim is added.

## Provider IO and secret handling

New `providerClient.ts` is the only Azure network boundary. Input is a parsed explicit credential object; output contains verified IDs or whitelisted groups, never tokens. All operations use a fresh `ClientSecretCredential` with explicit tenant/client/secret, `authorityHost:"https://login.microsoftonline.com"`, `disableInstanceDiscovery:true`, no additional tenants, no persistent token cache, unsafe/PII logging off and a no-op HTTP logger. Never use DefaultAzureCredential or inspect ambient Azure settings. Third-party raw errors are mapped to fixed codes and never logged/returned.

Use one 15-second operation deadline and at most 5 seconds per network request, linked to the operation abort signal. Use SDK retryOptions `{maxRetries:0}` and redirectOptions `{maxRetries:0}`. The custom bounded HttpClient enforces a maximum of three underlying requests per operation (optional exact-tenant OIDC metadata GET, one OAuth token POST, then subscription GET or first-page group GET); no request may be repeated. Acquire one management access token internally and pass a private in-memory TokenCredential wrapper to the resource SDK so it cannot trigger an unbudgeted second token exchange. This wrapper never leaves providerClient. A redirect response is rejected by the transport itself, before SDK policy can follow it. Only token POST is allowed; all ARM operations are GET. No pagination is followed.

Fixed destinations and paths:

- HTTPS `login.microsoftonline.com`, default port: GET `/<tenant>/v2.0/.well-known/openid-configuration` only if requested by MSAL, and POST `/<tenant>/oauth2/v2.0/token` only. Token query permits only optional `client-request-id` with UUID syntax (observed in actual MSAL traffic); metadata query is empty. Token form must target the configured client, client-credentials grant, and management default scope. Validate any metadata-derived request against these exact destinations before sending; metadata never expands the allowlist.
- HTTPS `management.azure.com`, default port: GET `/subscriptions/<subscription>?api-version=2022-12-01` for validation; or GET `/subscriptions/<subscription>/resourcegroups?api-version=2025-04-01&$top=100` (parameter order/case/SDK percent encoding may differ) for inventory. Reject any extra query key or unexpected API version. SDK default base URI is pinned explicitly. Reject credentials in URL, fragments, encoded slash/dot path escapes and all other hosts/paths/methods.

The subscription GET uses the same bounded transport directly: installed `@azure/arm-subscriptions` is a management/mutation SDK without subscription-read. Call `ClientSecretCredential.getToken` internally and require the subscription response to include the exact subscriptionId and tenantId and matching `/subscriptions/<id>` resource id. Use `ResourceManagementClient.resourceGroups.list({top:100}).byPage().next()` once for inventory; never iterate its continuation. Dispose/abort after the one page. The stored exact subscription and tenant remain the scope; generic scan never resolves this credential.

Each HTTP response is limited to 131072 bytes before buffering: count streamed bytes before retaining each chunk, reject oversized Content-Length early, abort overflow/timeout and cap the final response string. Reject compressed responses (send `accept-encoding:identity`) so decompression cannot bypass the limit. Production transport uses `node:https` to the exact validated host with default verified TLS, `agent:false` to avoid ambient agent/proxy routing, maxHeaderSize 16384, at most 16384 request-body bytes, and abort cleanup. No network endpoint/HTTP/TLS bypass environment override exists in product code. Log no token, secret or provider body. A test-supplied low-level transport may route only to the owned loopback fixture; default runtime always constructs the fixed public transport.

## Authority, storage and concurrency

Use `resolveRequestDesktopSession` with `allowApiKey:false`, `pipeline:read`/`workspace:read` for reads and `pipeline:trigger`/`connections:manage` for enrollment/disconnect. Require `credentialKind:desktop_session`. Enrollment/read require active commercial access; disconnect sets `requireActiveAccess:false`. Reuse canonical accepted membership capability checks; do not infer rights from principal IDs or the desktop's displayed role.

Service authority checks load current device session (unrevoked, unexpired, matching org/user) and current accepted membership. Management also requires owner/admin. Read accepts the closed desktop role union with workspace read. Check before reading/decrypting and before returning/storing any result after external IO. A failed authority lookup fails closed. Preflight required canonical tables and encryption configuration before external calls. Never change provider connection state after failed validation, identity mismatch, missing storage or failed entitlement lookup.

Enrollment snapshots the matching canonical organization/provider/subscription account and credential before validation. Reject legacy-pointer/enabled accounts and mismatched `expectedVersion` before provider IO. Preflight canonical cloud-account quota across all providers for a new account; reconnection does not increase usage. After provider validation, use a Serializable transaction that rechecks current session/membership, current matching account ID/updatedAt/pointer/enabled and exact credential version/revocation snapshot. Recheck the quota and account count in that transaction. Create only if no account previously existed; replace only the exact observed connection. Uniqueness/serialization failures return conflict, with no automatic provider revalidation/retry.

Create disabled observe-only CloudAccount with `regions:[]`, canonical pointer. Seal only `{tenantId,subscriptionId,clientId,clientSecret}` using `encryptScopedCredential` and AAD `cloud-account-credential-v1:<organizationId>:azure:<accountId>:<version>`. Store canonical credential at the same account ID, version 1 or old+1, validatedAt now and revokedAt null. Resulting active version must be at most 2147483646, reserving one increment for disconnect; exhausted versions fail before provider IO. Neither secrets nor tokens are written to CloudAccount metadata, audits, events, demo data or logs. No schema change is needed; AWS-shaped EnrollmentAttempt is unused.

Inventory snapshots account/credential, verifies organization/provider/pointer, decrypts only the Azure context, validates parsed credential IDs against account external ID, and reads via the bounded provider client. Recheck current authority and exact account ID/updatedAt/provider/external ID/pointer/enabled/regions and credential version/revokedAt after provider IO. If replaced/disconnected/rebound, reject the late result. No persisted inventory is needed for this increment.

Disconnect is one Serializable transaction, independent of provider/billing/decryption health. Check current management authority and tenant/provider/canonical disabled row. CAS exact expected credential version, set encryptedConfiguration to empty string, increment version, set revokedAt and account updatedAt. Already revoked rows with empty ciphertext and version equal to expectedVersion or expectedVersion+1 return the same disconnected summary; different versions conflict. No resurrection or Azure revocation is claimed. A fresh validation plus expected current version is required to reconnect. No Azure challenge rows exist to invalidate.

Use existing `cloud.connection.validated` and `cloud.connection.disconnected` audit kinds, best-effort after success, with fixed safe summaries. Audit failure never turns committed enrollment/disconnect into an error.

Error codes: `invalid_input` 400, `desktop_session_required` 401, `connection_authority_required` 403, `cloud_account_limit_reached` 403, `azure_inventory_denied` 403, `enrollment_not_found` 404, `enrollment_conflict`/`connection_disconnected` 409, `azure_identity_unverified` 400, `enrollment_unavailable` 503, `azure_inventory_unavailable` 503. Map SDK/transport failures without body/message leakage. Auth rejection during enrollment is identity_unverified; inventory access denial is inventory_denied; timeout/bytes/malformed inventory is inventory_unavailable.

## Desktop ownership and user copy

State is keyed to desktopClient.config object identity, verified organization, paired identity kind and capability set. Clear secret, enrollment/disconnect states, results and pending requests when these change. Secret clears immediately after submission and on unmount; no localStorage, secure-storage, URL, telemetry or AI copy. Disable secret entry without a paired manager capability. Keep the network request's transient submitted value only for its lifetime.

Use monotonically increasing request tokens and authoritative account-version refs. A delayed list cannot replace a newly enrolled/disconnected version. Starting disconnect immediately suspends and clears inventory; a delayed inventory cannot restore it while disconnect is pending or after revocation. Ignore stale enrollment, reconnect or disconnect responses that do not match current account identity/version. A network-uncertain POST requires refresh and manual action, never automatic replay. Surface errors with fixed client-owned text, never arbitrary server error text that could echo a secret.

Copy: `Azure subscription read access verified. Request the bounded resource-group inventory separately. Agent scans and cloud changes remain unavailable.` Inventory: `First resource-group page only; this is not a complete subscription inventory.` Disconnect: `Axiom's stored Azure credential was removed. The Azure service principal, its grants, and previously issued tokens were not revoked.`

## Files and acceptance

New modules: `lib/cloud/azure/enrollment/{policy,service,runtime,providerClient,boundedHttp,scopedConnection}.ts`, focused tests under `__tests__`; four route modules and Azure route tests; `desktop/src/lib/{azureEnrollmentContract,azureEnrollmentClient}.ts`; `desktop/src/components/AzureReadOnlyEnrollment.tsx` and root-discovered component/client tests. Owned fixture/rehearsal scripts live under `scripts/fixtures` and `scripts`. Changes to Settings/Connectors are import/mount/CTA only. Update desktop README/security, Azure setup documentation and Desktop App Pairing demo in the same product commit. Do not edit AWS, ECS v3 contracts/review kernels, Terraform, Airflow, shared vault implementation, canonical tracker, package lock or schema.

Acceptance requires focused policy/service/transport/route/UI tests plus an owned local HTTP+Postgres rehearsal through actual paired routes and actual SDK wire serialization. It proves synthetic credential verification, actual canonical scoped storage, wrong-context rejection, bounded read, zeroizing disconnect, fresh reconnect, wrong-tenant/authority/version failures and zero provider IO on revoked connection. It does not prove real Azure IAM, production schema rollout or native installer/keychain behavior. Coordinate any root/desktop tsc/build/full-suite run with parent; no concurrent heavy checks. No real cloud calls, production mutations, deploy, installers or live billing are authorized.

## Completed throwaway feasibility

`/tmp/axiom-azure-sdk-wire-probe.cjs` ran successfully on 2026-10-16 with synthetic IDs/secret, an HTTP server bound only to 127.0.0.1, and guards on http/https/socket/fetch before Azure SDK import. Actual ClientSecretCredential/MSAL sent token POST; actual ResourceManagementClient serialized the bounded first resource-group request and parsed its response. Fixed subscription GET used the same byte-counting transport. An attacker nextLink was not fetched. Redirect and oversized responses were rejected for raw and ARM SDK requests. External HTTPS probe was denied. Result: `/tmp/axiom-azure-sdk-wire-probe-result.json`. The probe uses test-only transport routing, has no product import or endpoint env knob, and is explicitly throwaway; permanent guarded rehearsal is still required. It did not exercise canonical routes, DB, desktop, real Azure or native runtime.
