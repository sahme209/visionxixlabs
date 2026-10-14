# Axiom Agent master-mission status

Updated 2026-10-14 from the current `main` checkout at `501254b6`.

## Evidence-based snapshot

| Capability | State | Evidence / gap |
| --- | --- | --- |
| Billing and AI-credit reservation lifecycle | CI verified and merged | PR #76 merged in `61b3fee5`; GitHub Test workflow run `38645130441` succeeded. Do not recreate this work. |
| Governed desktop agent | Partial, CI-tested | The desktop Agent has repository/environment selectors, Inspect/Engineer/DeepOps controls, read-only evidence tools, approval-gated proposals, audit rows, and governed AI calls in `desktop/src/views/AgentChatView.tsx` and `lib/axiom/agentRuntime/decisionLoop.ts`. |
| AWS/ECS operations | Partial | The registered agent tool set includes AWS deployment proposals. A real nonproduction account, target, and explicit authorization are still required for live validation. |
| Azure/GCP inventory | Source present; live status unknown | Do not represent write execution as available until a registered tool and authorized provider evidence exist. |
| Local dependency validation | Blocked in this environment | The local npm registry cannot be reached. Use GitHub Actions for TypeScript and Vitest validation; do not repeat local network diagnostics. |
| Desktop release build | CI verified | PR #78 restored the approved footer copy; PR #79 makes Desktop CI run when any release-gate input changes. GitHub Desktop CI run `38648628935` passed. |

## Active independent slice

**Bounded Agent effort budgets.** Acceptance criteria: Inspect has a small bounded read-only decision budget; Engineer retains the balanced default budget; DeepOps has a larger bounded budget; all modes retain the existing governed-AI, workspace-credit, and approval path; no mode claims a provider/model or customer price it cannot verify.

PR #77 merged the initial authority modes and passed GitHub `Test` run `38647204934`. The branch `codex/agent-effort-budgets` contains this follow-up slice. No deployment, merge, live billing change, or cloud operation is authorized.

## Next operational vertical slice

After the mode slice is CI-verified, select the existing AWS/ECS nonproduction deployment path only after confirming a connected authorized cloud account, an environment target, and a safe user-approved test operation. Otherwise, build the smallest contract-tested readiness/verification gap and record the exact access needed for live validation.
