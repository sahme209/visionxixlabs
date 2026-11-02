# Release write-credential admission and expiry — local design proposal

November 2, 2026 · **USER-APPROVED LOCAL IMPLEMENTATION — November2.**

This changes the existing provider-proof/claim authority boundary. It is not authorized by the earlier native Git lease or drain implementation alone. No new permission, wildcard credential, provider request, migration, activation or deployment is proposed as an automatic consequence. Production coverage/enrollment and old-issuer qualification remain unavailable; this proposal does not make the release path production ready.

## Actual source and problem

- `lib/governance/intelligence/deploymentRequestAdmission.ts:createDeploymentProviderPreflight` calls `transport.readCredential` before policy/action claim; its current private proof establishes validated credential binding/expiry plus workflow/source evidence and then supplies `providerAccessVerified: true`.
- `lib/desktop/releaseDeploymentServices.ts` supplies that credential using `resolveReleaseInstallationToken` with dispatch purpose and `actions:write`; read-only source-policy/workflow purposes exist separately. Final transport can obtain another write credential.
- `lib/governance/intelligence/mergeProviderPreflight.ts` similarly reads a `contentsWrite` credential before claim and checks provider policy/source evidence. `lib/desktop/releaseProviderMergeToken.ts` selects merge versus merge-policy-read purposes. `githubAppAuth.ts:resolveReleaseInstallationToken` validates actual issued permissions, repository selection, expiration and current installation; the App signer stays private.
- `mergeRequestAdmission.ts`, `governedProviderMerge.ts`, `governedReleaseDeployment.ts` and the release Governance coordinators use those proofs in claim admission and final transport. `admissionGuard.ts` currently treats provider access as part of admission; simply moving minting after claim would create a circular dependency or weaken that meaning.
- The native Git ledger (`nativeGitCredentialLeaseStore.ts`) reserves before mint, records actual expiry before returning a bearer and preserves unknown indefinitely. Its approved protocol is **native push specific**, with positive unenrolled absence; it cannot be reused as an enrolled release authorization or renamed without review.
- `enrollmentDrainStore.ts` now provides local exact decisions/barriers, outbound intent/blockers and private one-use freshness. It supplies neither a production source/operation/quiescence verifier nor full caller integration/activation/legacy qualification. Credential lifetime and accepted provider-work drain are different blockers.

Issuing a write-capable credential is itself consequential authority exposure even if the intended merge/deployment later refuses. Current preflight therefore cannot be described as only harmless reads, and a second token issued at final transport can escape accounting unless every issuance/cache return participates in the protocol.

## Recommended end state: two independent gates, not a guessed write grant

Recommend **read-only eligibility proof → exact policy/action admission and claim → reserved write issuance → actual permission validation → final dispatch admission**. Keep `providerAccessVerified` meaningful by making the evidence phase explicit; do not silently reinterpret its existing boolean as “GET succeeded.” This requires reviewed versioned private proof/guard interfaces and policy semantics before implementation.

### 1. Provider facts before claim

The concrete supported metadata sequence is App-JWT **GET `/app/installations/{installation_id}`** and **GET `/repos/{owner}/{repo}/installation`**. GitHub documents both as JWT-authenticated; their responses include installation/App/account identity, permission maps and suspension status. The repository endpoint associates the exact repository with the App installation. These are metadata observations, not an issued write credential or guarantee a later mutation succeeds. [Installation API](https://docs.github.com/en/rest/apps/apps#get-an-installation-for-the-authenticated-app), [repository installation API](https://docs.github.com/en/rest/apps/apps#get-a-repository-installation-for-the-authenticated-app).

Proposed implementation seam: keep both requests inside `githubAppAuth.ts` beside the existing private `signJwt`/App configuration/key resolution and bounded `readGithubAppInstallation`. That existing helper validates installation/App/account/suspension but currently does **not** project a validated permission map or bind a repository. Add a separately reviewed exact eligibility reader; do not pretend the current helper already proves those facts. Capture server-owned tenant/repository/installation/revision/profile before awaits; require exact App ID, numeric installation/account identity and unsuspended state from both responses, matching current tenant installation. Compare required fixed-profile permission levels against current returned maps; mismatch/unknown/redirect/404/partial response refuses. No App JWT/key leaves that module or enters a receipt, error or audit.

Use existing explicitly read-only repository-scoped token purposes to verify actual current repository access and collect source/workflow/PR/topology facts. Source GET success is not evidence of granted write permission. Installation `repository_selection: all` metadata must never produce an all-repository token; post-claim issuance still requests exactly one repository and a fixed permission profile. A 301 repository response refuses rather than silently adopting a renamed/transferred target.

A proposed `ReleaseProviderEligibilityProof` is private, single-use and bound to tenant, original operation/action/plan digest, installation ID/revision, repository, required exact permission profile, actual observed provider permission metadata, source/policy facts and original freshness window. It states **eligibility for a subsequent narrowly scoped issuance**, not that a write token exists or a write is permitted. Unknown/missing/inaccessible/partial permission metadata refuses this recommended path. The official endpoints exist; the exact combined eligibility verifier is proposed and not yet implemented or qualified.

Endpoint/permission response semantics are grounded in the linked official documentation; exact parsers, current tenant binding, races and failure behavior still require isolated tests and later separately authorized live qualification. These GETs do not promise an atomic future grant or prove old-token revocation. Read credential issuance/authentication remains separately bounded and current-tenant scoped; it must never silently request write permissions to make these reads work.

### 2. Exact admission/claim before write issuance

Current paired/commercial requester, original independent action approval/session, exact plan/source, active baseline, numeric policy and coverage remain mandatory. Their DB-only checks share the existing org-first transaction, approval consumption and attempt CAS; no provider IO enters locks. A pre-claim refusal rolls back consumption and attempt. Legacy/custom scope requires actual positive unenrolled absence and unchanged existing approval/role/source checks, not an invented baseline.

The proposed guard phase is explicitly `before_write_credential_issue`. It consumes verified provider eligibility evidence with an evaluator input that cannot be confused with actual credential possession. Do **not** set the existing `providerAccessVerified` to true from read access. Choose and approve a versioned evaluator contract such as `providerEligibilityVerified` for this phase, then require actual `providerAccessVerified` only after the fixed issuer validates the real returned credential. Phase-specific receipts are non-interchangeable and private; no JSON/client boolean can construct either. Existing baseline/action/numeric rules are not removed by this separation.

The claim consumes the original action attempt before write issuance. A later issuance refusal/unknown does not reset the attempt or automatically request a second token. Reuse of a consumed decision is confined to its original operation's authorized final checks and recovery.

### 3. Drain reservation before every mint or cache exposure

Before invoking the fixed write issuer, reserve a **new separately reviewed release credential-lifetime record** using existing durable tables. Bind exact tenant, actor/original session, original operation/attempt, action, plan digest, installation/revision, repository, fixed purpose/profile, server nonce and protocol version. Derive transition epoch from the store, never from input. No bearer, App JWT, private key, clone URL or secret body is stored.

Reservation shares the drain/enrollment organization lock and actual operation authorization. Draining refuses new issuance; an already reserved mint remains a blocker until genuinely resolved. Enrolled release execution needs its actual admitted profile, not the native-push unenrolled rule. An outbound mint-intent slot alone does not represent token lifetime: link it to the credential record so a returned token remains a blocker even after the mint HTTP finishes.

Perform exactly one actual issuer call outside DB locks. Validate the real fixed response: exact installation and selected repository, required permissions and no unexpected widened profile, finite future provider expiration within supported issuer constraints, token format and current pinned connection/session. Scope must be the existing exact release profile (`actions` dispatch or repository merge), never a wildcard repository or generic write-all profile. Do not guess expiry or infer granted rights from request parameters.

GitHub permits explicit repository/permission narrowing, and the issuance response reports granted scope and expiry. Therefore preserve the current fixed response validation rather than inferring grant from eligibility metadata. [Installation-token documentation](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app). This does not authorize SDK auto-refresh/remint: the approved one-attempt/unknown protocol remains stricter.

Finalize the same durable record with actual provider expiration before any caller/transport receives or uses the token. Recheck current action admission, original authority, drain epoch and installation around finalization, retain private expiry/cancel checks after final DB/commit delivery, and preserve the record even if the credential is subsequently withheld. Lost issuer/finalization acknowledgment stays pending/unknown indefinitely; read-only recovery cannot mint again, invent expiry or clear the blocker.

An expired issued token closes future bearer-use exposure only under the supported provider expiry semantics/database clock. Provider work accepted while it was live remains a separate outbound blocker until supported quiescence. A local request lease/attempt deadline is not token expiry or proof no effects remain.

### 4. Actual write authority and final transport

Only the fixed validated issuer can create `ReleaseIssuedCredentialProof`, bound to the exact operation/profile/lease and actual permission response. This is where provider write access can honestly become `providerAccessVerified`; serialized token DTO flags alone are not evidence. Failure of actual permission verification refuses before effect, retaining consumed/uncertain issuance history as appropriate.

Recheck current baseline/action/numeric policy, original reviewer/executor sessions, exact source/workflow/PR state, installation, original proof/credential expiry and actual outbound intent before the single merge PUT/deployment POST. Retain the current private store proof publisher through transaction return and the last synchronous transport boundary. All request serialization/other callbacks precede that final check. No provider call under DB locks, automatic retry, deadline extension or receipt-as-health/rollback promotion.

## Request-local reuse (optional, preferred to duplicate minting)

After validated durable finalization, an in-process private map may retain one credential/proof for its exact operation/attempt/profile/repository/installation and original signal/deadline. Preflight read and write profiles are distinct. No cache key may collapse purpose/profile, tenant, revision or operation. Reuse requires current admission and final expiry checks; it is not a new issue, approval or lifetime. Never serialize the map or recover a token from persisted metadata.

A second independent issuer call requires its own reservation and remains refused by default for this consumed operation unless a separately approved protocol proves it safe. A restarted process with a lost token/unknown issuer response observes history and escalates; it does not remint as recovery. Lower shared issuer caches must be audited: returning an already minted token still creates exposure and needs exact lifetime/binding accounting before return. A new empty cache/ledger does not qualify older tokens or mixed runtimes.

## Alternatives and circular-proof resolution

| Alternative | Benefit | Security/semantic cost and approval boundary |
|---|---|---|
| **Recommended two-phase eligibility/actual-access proof** | No write bearer before exact action claim; separates provider eligibility from issued permissions truthfully. | Requires supported authoritative read metadata and a versioned guard/evaluator phase. If that metadata cannot establish eligibility honestly, do not implement a guessed true value. |
| **Tracked preflight issuance with explicit credential policy phase** | Retains current meaningful actual-token provider proof without pretending GET verifies write access. | Separately approve an exact credential-issuance action/policy/independent consent phase before mint, reserve/drain/expiry-track it, then perform current action admission using actual returned access proof. This may issue a token when later action admission refuses; that exposure must be explicit, bounded and blocking. It does not satisfy “action admission before mint” and requires a distinct product decision. No silent reuse of action approval as preflight credential consent. |
| **Keep current preflight but only add logging/expiry** | Small change. | Rejected as the full solution: logging does not authorize issuance; no-policy preclaim mint persists, and a timestamp without reservation cannot serialize drain. |

If read metadata is unsupported, report that blocker and choose the explicit tracked-issuance phase only after fresh design approval, or keep the release path unavailable. Do not disable the provider proof, change it to always true, use a wildcard token, or treat a mock fixture as an implemented metadata verifier.

## Validation-first acceptance and remaining gaps

- Source/unit RED for current preflight invoking write issuer before failed action/numeric/baseline admission; new positive must show read-only profiles before claim and exact write profile only after the intended admitted phase. Missing metadata/proof/phase verifier refuses; forged/copy/replayed private proofs and GET-only evidence cannot satisfy actual write-access proof.
- Actual owned PostgreSQL composition with real coordinator/approval/claim/drain/credential records and fixed mocked issuer: both org-lock orders; enrollment/drain during waits; permission/session/source/installation changes; no issuer before reservation/claim; one issuer and one effect; lost issuer/finalize/dispatch replies; zero automatic remint/resend; unknown indefinite and secret-free records/errors.
- Exact provider-response negative vectors: wrong repository/installation, extra or missing permissions, missing/nonfinite/past/implausible expiry, changed original pin and canceled/expired session during later DB/result/transport waits. Keep real clocks/deadlines rather than widened fixtures.
- Request-local reuse and shared-cache tests cover operation/purpose/tenant/revision isolation, same-expiry overlapping references, process loss and old-issuer qualification always unavailable. Actual final source/credential checks and positive unenrolled legacy behavior remain intact; no new grants or scope expansion.
- Independent source review, exact scoped/full build evidence after implementation, complete mutation/credential manifest and genuine native/live acceptance remain separate. The supported metadata endpoints are identified, but no combined metadata verifier, release lease verifier, full admission-phase implementation, mixed-runtime proof, production coverage or activation is supplied here.

**Decision requested before code:** approve the recommended two-phase contract implementation around the identified JWT GETs, subject to failing-closed exact metadata/source validation and isolated qualification; otherwise return for approval of the explicit tracked-issuance alternative or retain refusal. Approve the separate release credential reservation/expiry protocol, operation-bound request-local reuse and no-remint recovery semantics. Existing approved native-push and drain records/history remain unchanged; no live provider verification or activation follows from local implementation approval.

## Local approval record

The user replied “Approve local credential-admission correction” to request9c0cc09b662f4357b67d2b635c739735. Code and isolated tests only; no live tokens, provider actions, deployment or production activation. The design sections above are the reviewed proposal baseline; current implementation and remaining gaps are recorded separately. No speculative provider evidence is converted into actual write access.
