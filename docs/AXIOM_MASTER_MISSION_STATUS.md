# Axiom Agent master-mission status

Updated 2026-10-14 from the current `main` checkout at `d1dc9c9d`.

## Evidence-based snapshot

| Capability | State | Evidence / gap |
| --- | --- | --- |
| Billing and AI-credit reservation lifecycle | CI verified and merged | PR #76 merged in `61b3fee5`; GitHub Test workflow run `38645130441` succeeded. Do not recreate this work. |
| Governed desktop agent | Partial, CI-tested | The desktop Agent has repository/environment selectors, Inspect/Engineer/DeepOps controls, read-only evidence tools, approval-gated proposals, audit rows, governed AI calls, bounded effort budgets, and a per-turn provider-reported usage receipt that never claims settled customer charges. |
| AWS/ECS operations | Partial, CI-tested | The registered agent tool set includes approval-gated AWS deployment proposals. Tenant workflows now serialize a target-specific deployment queue without cancelling an active rollback-capable run. A real nonproduction account, target, and explicit authorization are still required for live validation. |
| Azure/GCP inventory | Source present; live status unknown | Do not represent write execution as available until a registered tool and authorized provider evidence exist. |
| Local dependency validation | Blocked in this environment | The local npm registry cannot be reached. Use GitHub Actions for TypeScript and Vitest validation; do not repeat local network diagnostics. |
| Desktop release build | CI verified | PR #78 restored the approved footer copy; PR #79 makes Desktop CI run when any release-gate input changes. GitHub Desktop CI run `38648628935` passed. |

## Completed independent slice

**Bounded Agent effort budgets.** Acceptance criteria: Inspect has a small bounded read-only decision budget; Engineer retains the balanced default budget; DeepOps has a larger bounded budget; all modes retain the existing governed-AI, workspace-credit, and approval path; no mode claims a provider/model or customer price it cannot verify.

PR #77 merged the initial authority modes and passed GitHub `Test` run `38647204934`. PR #80 merged the bounded-effort follow-up in `9f2401e7`; its GitHub Test run `38650115351` and Desktop CI run `38650115334` passed. No deployment, live billing change, or cloud operation is authorized.

## Recently completed independent slices

**Truthful Agent usage receipt.** PR #81 merged in `46591b6e`. It returns per-turn decision-step and provider-reported token evidence to the desktop while explicitly separating that evidence from settled workspace-credit charges. GitHub Test run `38651830096` and Desktop CI run `38651829889` passed.

**ECS target deployment serialization.** PR #82 merged in `d1dc9c9d`. The checked-in tenant workflow and copyable template serialize runs by role, region, cluster, and service with `cancel-in-progress: false`; a contract test prevents those two workflow sources from drifting. GitHub Test run `38653509460` passed.

## Next operational vertical slice

Live AWS/ECS validation remains externally blocked. To safely validate it, provide: (1) a connected tenant-owned **nonproduction** AWS account, (2) a configured nonproduction environment target and repository workflow, (3) a narrowly trusted GitHub Actions OIDC role, and (4) explicit approval for one bounded test deployment. Until then, do not dispatch a workflow, claim AWS availability, or substitute local cloud credentials. The next software-only work must be a separate readiness or verification contract that does not overlap the already validated workflow surface.
