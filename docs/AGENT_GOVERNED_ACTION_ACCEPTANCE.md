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
