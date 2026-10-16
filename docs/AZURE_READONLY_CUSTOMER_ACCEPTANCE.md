# Azure read-only source candidate acceptance

The candidate lets an accepted owner/admin on a paired desktop enroll an **existing** Azure service principal for one exact subscription, request a separate first resource-group page, locally disconnect, and reconnect with fresh validation. It uses existing canonical CloudAccount/Credential storage and Azure-bound scoped AEAD. Generic Agent scans, provider mutation and broad inventory remain unavailable. The Settings Integrations form and Azure Connectors link are source changes; they are not proof of native release availability or real Azure permission acceptance.

## Exact source and owned evidence

The full HTTP rehearsal binds its application source before and after the run to `15878450068a7dc08a22d556ad27fd08fb68585a`. The production Azure implementation is unchanged from `22d83f31`; subsequent commits add standalone probe loading, explicit owned harness wiring and reviewed App/Terraform dependencies. `15878450` strips only the Next build-time `server-only` import in the standalone fixture loader; it replaces no SDK constructor, token acquisition, ARM serialization, product HTTPS transport, route, authorization or vault function. Next itself retains its normal server-only handling.

[Owned paired HTTP/Postgres receipt](mission/local-azure-readonly-http-acceptance.json) records **38 named check groups**, not 38 provider operations: 11 base auth, 10 desktop pairing, 4 approval-decision and 13 Azure groups. The Azure flow sent **20 guarded SDK/ARM wire requests** to an owned loopback protocol fixture. A separate [small actual-source SDK probe](mission/local-azure-source-sdk-wire-probe.json) records **4 guarded wire requests**: token, subscription GET, token, first resource-group page. It does not establish the paired routes or DB by itself; the larger rehearsal covers those boundaries.

The full run used a newly created disposable loopback-only Postgres container with the current schema and a real local Next HTTP process. It completed real signup/email-proof/CSRF login and paired bearer exchange before Azure operations. It did not seed a validated provider connection, install packages, grant a user plan, or create a billing subscription. The exact current commercial resolver observation was `allowed:true`, `code:active`, `billingStatus:no_plan`; enforcement remains an existing policy decision, not proven paid entitlement. Current runtime schema success is not evidence of production migration readiness.

## What the Azure flow proved

- Actual paired routes called the real composed service, vault, installed ClientSecretCredential/MSAL and ARM resource-group serializer. Default product verified HTTPS was remapped only by a fixture-process preload guard to the owned loopback server; no production endpoint override exists.
- Exact tenant/subscription identity preceded canonical disabled observe-only account creation. Ciphertext decrypted only with the correct organization/provider/account/version AAD; no token was stored. Public responses contained no submitted secret/token.
- Explicit inventory returned at most the first 100 resource groups with `complete:false`; attacker nextLink was never followed. Denied access, redirect, oversized and compressed responses failed rather than manufacturing empty success.
- Existing foreign account metadata was invisible without provider IO. Membership removal after an actual delayed SDK request withheld the late response. Disconnect during delayed inventory also withheld the response.
- Local disconnect erased ciphertext and incremented its version without provider work. Revoked reads and stale reconnect/disconnect versions did not regain access. Fresh reconnect performed new provider validation. Wrong subscription identity retained the previous connection. Canonical account quota blocked an additional account before provider IO.
- Lead, Terraform, billing-plan and deployment counts were unchanged by the Azure flow. Existing auth/pairing approval checks stayed active.

The owned fixture reported `fixtureCleanup:owned_disposable_container_removed`. A subsequent daemon label listing was empty and no Next process for this Azure worktree remained. Both loopback wire servers closed. Failed standalone probe diagnostics contain only synthetic fixture context and remain private under `/tmp`; no raw provider error is part of the checked-in receipt.

## Focused verification and remaining gates

Focused policy/service/transport/actual in-memory SDK/routes/desktop/demo checks plus the owned launcher tests cover strict inputs, operation/request deadlines, cancellation, no ambient Azure credentials/endpoints, current authority, quota/version CAS, secret clearing, parent-authoritative stale UI responses, safe errors and fixture opt-in boundaries. The final focused run result is recorded in the execution plan. Root schedules full web/desktop type checks, desktop build, broad suite and PR CI after its other exclusive validation windows.

Real Azure tenant/IAM behavior, permission-role assignments, complete inventory, production deployment/schema, packaged native UI/vault/installers, paid enforcement, billing and provider writes remain unverified. Subscription read validation does not prove Reader-only privileges or VM/storage/cost/security coverage. Local disconnect does not revoke the Azure principal, grants or already issued tokens.
