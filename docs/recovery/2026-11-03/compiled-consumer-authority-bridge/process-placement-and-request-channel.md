# C: concrete process placement and data-only request channel

**Proposal only; new placement decision requires user approval.** Source snapshot `9feb32eb`; no implementation, installation, service/status call, credential inspection, test generation or runtime qualification. This specifies the first `compiled-direct-pr-merge/1` profile, not full Governance. It depends on [authority writer inventory](authority-writer-inventory.md) and the separately reviewed custody-profile decision. Neither file establishes actual deployed grants.

## Decision recommended for review

Use a dedicated non-login macOS service principal, proposed name `_axiomissuer`, and a system-domain launchd service, rather than claim the existing GUI-user SMAppService provides exclusive custody. Administrative installation would place the sealed control application/configuration beneath `/Library/Application Support/Vision XIX Labs/Axiom Issuer/`, owned by an administrative installer with no desktop-user write permission; actual coordinator/provider/DB work runs as the dedicated principal, **not root**. Do not create that account, grant rights or install anything under this proposal.

The exact installation owner/group, privileged install/mount mechanism, service UID assignment, code requirements and service-access policy must be approved and qualified before use. Current readonly-mounted-root checks remain: an ordinary root-owned directory is not a substitute for `MNT_RDONLY`. A system-context mount/bootstrap and privilege drop are unimplemented prerequisites; current per-user registration cannot be silently relabeled system service. Keep the actual same compiled coordinator/claim/final-send graph; no alternate miniature executor qualifies it.

A separate backend deployment is an alternative placement decision, but a remote Linux service cannot inherit evidence for this bounded macOS native profile. Do not mix that alternative into the local profile or export its secrets to the desktop.

## Why the current service is insufficient

The existing per-user SMAppService/broker verifies signed peers, owned startup/current native origin and retained resource observations. It shares the desktop user's OS identity. Code signature, Mach-service registration, a bundle identifier or an application-specific keyring name is not exclusive database/key custody. The standard Node executable's signature alone also does not authenticate which JavaScript it runs. The current bootstrap clears inherited configuration and fixes `NODE_ENV=production`; it does not provision backend credentials. NoWrite is not an all-secret-read or network boundary.

Custody requires real OS access separation **and** DB authorization: the general desktop/web/worker tier gets no authority-DB credential or equivalent signing/decryption material; the trusted tier owns the mapped session/role/plan/review/policy writers and exact merge effects. Read-only presentation must use mediated APIs. App-signing material, cached/live provider tokens, session signing and field/connection decryption are separate resources. Their actual locations, principals, fallback paths and removal from old runtimes are unknown. Do not put `DATABASE_URL`, `GITHUB_PRIVATE_KEY`, `DESKTOP_SESSION_SIGNING_KEY`, `NEXTAUTH_SECRET`, `CREDENTIAL_ENCRYPTION_KEY`, `STARTER_TOKEN_SECRET` or `FIELD_ENCRYPTION_KEY` into argv, request payloads or desktop vault and call that isolation. Provisioning/rotation/revocation and database role enforcement require a separate reviewed operational design; this proposal authorizes none.

Trusted-host scope excludes a hostile administrator/kernel and compromised trusted signer/build/installer. The new principal does not itself solve authenticated compiled-consumer admission. That bridge remains unresolved; current canonical outputs are observation-only/unavailable and typed readers refuse. Assembly, peer authentication or this placement cannot enable them.

## Exact initial channel

Proposed fixed system Mach service: `com.visionxixlabs.axiom.issuer-request`, separate from private origin/control channels. The installed SDK's `XPC_CONNECTION_MACH_SERVICE_PRIVILEGED` selects the privileged bootstrap namespace, typically `/Library/LaunchDaemons`; it confers no authorization by itself. No general TCP listener or client-selected URL/route is an alternate authority entry. Existing local Next loopback startup must be reconciled before this can be sole entry; it is not solved by this document.

The native front end checks the actual message sender's audit/code identity against the approved desktop requirement, with a bounded serialized data envelope. Peer identity is an admission filter, **not** org membership, user identity or independent review. Accept no functions, callbacks, Prisma/repository objects, trusted DTOs, client-selected DB scope, `approved`/`verified` boolean, arbitrary headers, process/root paths or provider token. Native service code independently constructs the fixed request and invokes the actual compiled handler; it must not accept an injected coordinator or caller-supplied claim verifier.

Proposed envelope field names only: `protocol`, `operation`, `requestId`, `planId`, `authorization`, `body`. `protocol` is fixed `axiom.issuer-request/1`; `operation` is one of `read_execution`, `prepare_execution`, `execute_execution`, `cancel_execution`, `read_operation`, `recover_operation`. `authorization` carries the existing opaque paired-session credential, is never logged/echoed, and is not a backend key. Envelope cap 4 KiB is a **proposed new transport bound**, subject to review alongside a concrete bounded token length; no unbounded token fallback. Reject duplicate/unknown fields before dispatch. Do not expose a generic HTTP proxy.

| Operation | Actual fixed compiled handler and data |
|---|---|
| read/prepare/execute/cancel execution | `handleReleaseProviderMergeExecution`, fixed `/api/desktop/deployments/{requestId}/operation-plans/{planId}/provider-execution`; GET for read, POST body fields `action`, `expectedVersion`, `clientRequestId` for mutation |
| read/recover operation | `handleReleaseProviderMergeOperation`, corresponding fixed `/provider-operation`; GET read or POST fields `action`, `expectedVersion` with action `recover` |

`requestId` remains server route regex length1–160; `planId` retains `release_plan_` plus64 hex. Preserve actual strict schemas, versions and UUID checks. Adapter forwards only `Authorization` and mutation `Content-Type: application/json`; client `x-forwarded-for`, `x-real-ip` or scope/capability fields never become authority. Optional existing `x-correlation-id` and `x-axiom-expected-version` are not needed in this initial envelope; add only after an explicit use/schema review.

Service uses `resolveRequestDesktopSession` with actual credential verification and current durable session, accepted membership, capabilities and active access. For the merge action API keys remain prohibited. The service independently resolves exact saved plan, current source, real independent review, current authority and one-attempt claim. Requester/reviewer decisions remain separate; a signed caller or user message cannot manufacture Fatima's durable decision. The authority-writer inventory's trusted writer split is mandatory to prevent general-tier modification of those facts.

## Bounds, outcomes and recovery

Preserve existing execution-handler25s deadline,1024-byte body, URL2048/no-query validation and capacity8/refill0.1s rate policy. Existing desktop transport bounds the response to262144 bytes and25s; enforce the same response ceiling in the XPC adapter before deserialization, with no secret-bearing diagnostics. The history/recovery handler retains10s/256-byte body and its capacity15/refill0.3s policy. Transport envelope4KiB must not widen nested handler limits. Private/no-store HTTP behavior remains in the compiled handler; no persistent IPC payload log.

Cancellation/disconnection invalidates the request's current dispatch eligibility and forwards the request signal; it is not proof that a submitted provider effect stopped. Preserve original durable claim and unknown outcome after send/timeout/process loss. No automatic reconnect execution, replay, new credential issuance or retry. Read the same saved operation; `recover_operation` is the existing bounded history-state recovery (no coordinator/credential/provider transport imported), not authorization to repeat a provider write. Successful delivery requires the original durable confirmed outcome, not XPC reply success alone. A late response cannot authorize another attempt.

## Lifetime and cleanup

The system request host has a bounded outstanding-job/response budget and does not retain credentials between user requests beyond an explicitly reviewed secret-custody mechanism. Service restart cannot clear claims, exposures, approvals or unknown work. Current origin broker preserves its original180s startup budget and250ms native query bound; do not reset either on request receipt. Existing once-only startup ownership, absolute deadlines, suspended-child resume checks and late-result revocation remain necessary. Only an owned child/service is cleaned up; no unregistering another registration on uncertain ownership. Forced termination during kernel creation/reaping remains unqualified, not a proven cleanup guarantee.

The system-domain replacement needs a reviewed installation/start/stop/uninstall and boot/mount lifecycle. Existing GUI SMAppService APIs are not that operator. On uncertainty, refuse initialization and report bounded unavailable/unknown status; never fall back to same-user secrets, generic Node execution or the old listener.

## Finite decisions before implementation

1. Approve or reject dedicated system placement and administrative installer/mount scope; existing local-code approval does not grant it.
2. Approve exact trusted custody tier/no-general-tier DB/key access and writer migration from the inventory, including revoked/legacy credentials and real operational recovery.
3. Specify actual compiled-consumer authentication to the private native/resource custodian at claim and final send. Existing caller callbacks/digests are not that proof; blocked case stays unverified.
4. Approve channel schema/token cap and fixed same-compiled dispatch composition; prohibit alternate direct mutation entry. Then implement ordinary local source tests separately, with no service/identity activation inferred.

Until these are settled, this is a reviewable design choice, not runnable qualified C or completed Governance.
