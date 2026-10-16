# Agent capability and governed-action acceptance

Reviewed 2026-10-15. This is an implementation trace and simulated boundary acceptance record, not provider-backed customer acceptance.

## Supported authority

`lib/axiom/agentRuntime/tools.ts` is the execution catalog. `decisionLoop.ts` can invoke registered read tools only; every write exits as a proposal. Workspace Agent identity must exist, be enabled, and explicitly allow the selected tool. Unregistered tools and omitted permissions fail closed. An initial UI grounding read has the same requirements.

- Inspect (`ask` and `plan` compatibility modes): read and explain only.
- Engineer: read plus approval-gated GitHub branch, commit and pull-request proposals.
- DeepOps: registered operational proposals, including AWS ECS dispatch. It does not create Azure/GCP execution support.
- Legacy `agent` and omitted operation mode retain the existing operational proposal compatibility behavior; this change does not expand that behavior.

Effort controls bound structured decisions (2 Inspect, 4 Engineer, 6 DeepOps), not native model reasoning levels. Provider selection, allowed models, fallback order, workspace opt-in and credit-read failure behavior are resolved by `governedAiCall.ts`. Token usage is evidence, not a customer invoice or payment receipt.

## Action-boundary permission recovery

Previously, a turn loaded the Agent policy once before asynchronous provider setup/inference. A policy revocation during inference did not prevent the already-started turn from reading repository data or emitting a stale write proposal.

The runtime now reads current identity policy immediately before initial grounding and after a model-selected tool's contextual risk lookup, before executing a read or returning a proposal. It uses the intersection of the original prompt allowlist and current permission; adding a permission mid-turn cannot enable a tool omitted from the original prompt. Disabled identities, removed tools and unavailable policy storage fail closed. Existing browser approval independently rechecks execution authority and is unchanged.

The check is not a database lock across a remote GitHub request. It prevents observed revocations before invocation; it cannot retract an external request already in flight, cancel a model request already sent, or promise instantaneous revocation across distributed services. Fresh approval remains mandatory for writes.

## Capability-to-receipt trace

| Customer action | Existing implementation | Acceptance boundary |
| --- | --- | --- |
| Inspect selected repository | Tenant-scoped GitHub token, bounded evidence/search, restricted-path policy | Mocked repository tests; real tenant installation permission still required |
| Edit code | Approval-gated branch/single or atomic multi-file commit/PR; reviewed SHA and default-branch protection | Proposal and GitHub adapter behavior tested; no actual customer PR created here |
| Inspect cloud connections | Tenant connection/session state reporting | Stored/validated state evidence, not proof of provider execution authority |
| Deploy AWS ECS | Approved environment/target, branch policy and promotion evidence, billing reservation, workflow dispatch | Dispatch acceptance is not deployment success; workflow/execution receipts must confirm terminal outcome |
| Reject, expire or revoke action | Browser digest, expiry, separation of duties, conditional proposal claim and current Agent allowlist | Browser approval tests simulate storage; production journey unverified |
| Azure/GCP deployment or arbitrary shell/Terraform/Airflow execution through this Agent | No registered execution tools | Missing integration with this Agent runtime, not an access-only blocker; other product modules may have separate capabilities |

## Regression evidence

`lib/axiom/agentRuntime/__tests__/decisionLoop.test.ts` adds five regressions: disable, tool removal and policy-read outage during inference; revocation during initial governed setup; and removed operational permission before proposal. All five fail on the original implementation. They make no model, GitHub, cloud or database requests.

Remaining real customer acceptance requires a verified database/authentication target and an authenticated sandbox workspace, explicitly enabled Agent identity/provider/credit policy, tenant GitHub installation and nonproduction AWS target with bounded approval. The complete sequence must retain actual read evidence, proposed/rejected/approved receipts, provider workflow execution and rollback results. Passing unit tests does not establish that journey.

## Recoverable model setup — 2026-10-16

Agent model lookup, conversation recovery, skills and repository/environment catalogs now publish independently. A failed or malformed model response cannot leave otherwise successful context selectors disabled. The composer distinguishes loading, disabled workspace AI, an empty service catalog and unavailable model verification. Send and Enter wait for a verified enabled model; users can still draft, review history, decide a saved proposal and inspect its receipt. This client readiness state does not certify identity, tool permissions, credits or execution authority: the existing server checks remain authoritative.

**Retry models** refreshes model policy only, preserving the current draft, conversation and context and never resending. **Model settings** opens Settings → Models directly through a closed destination callback. Models has its own failed-lookup retry. Approved service-managed defaults are supported even when absent from the named model catalog. No policy, provider or Agent is enabled automatically.

Focused React tests cover these transitions, delayed independent resources, unchanged proposal decisions and credential replacement. Existing restart receipt/context tests retain their assertions and use a ready provider fixture for tests that send messages. These tests mock desktop services; they are not real browser or native acceptance.

The owned authentication harness has an additional exact opt-in, `AXIOM_RUN_LOCAL_AGENT_READINESS_HTTP=1` alongside `AXIOM_RUN_LOCAL_AUTH_HTTP=1`. Inside its existing `onPaired` continuation it reads the real disabled model policy, creates a conversation, submits a request denied by absent Agent identity, reopens persisted user/governance turns and verifies foreign-context denial and zero AI/tool/deployment/billing side effects. It does not enable an Agent, provider or financial policy. Preparation alone is not HTTP acceptance; a clean committed source run must be reported separately. Current-schema bootstrap remains separate from migration recovery.

Cached Playwright is available, but a bounded local-only Chromium probe outside the sandbox timed out after 15 seconds with zero DOM output. A prior sandboxed probe exited133. No browser download or reduced sandbox security flags were used for the approved retry. Browser interaction and native secure storage, packaged macOS signing/notarization, actual inference/provider behavior, paid entitlement and production acceptance remain unverified.
