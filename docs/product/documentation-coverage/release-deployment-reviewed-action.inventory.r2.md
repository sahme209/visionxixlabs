# Deployment review control mapping — draft revision 2

Internal source-review queue for `axiom.help.release.deployment-reviewed-action@2`, based on `b9011c472f26c26d679cca5dcf6b519a9a952fa1` plus the exact hash-bound files. Proposed help IDs below are documentation identifiers, not runtime authority or proof of supported shipped controls. No candidate is promoted from `needs_runtime_and_documentation_review`.

The original candidate IDs refer to the preserved `source-control-candidates.json` inventory snapshot; offsets/hashes in that snapshot may predate the current component. The current component hashes below bind this draft. Source-only inspection is not native visual, keyboard or customer acceptance. Dynamic workflow-input fields and expandable details need a later runtime inventory; this mapping does not claim every release control is documented.

| Proposed help ID | Exact accessible control label | Historical inventory candidate | Current source |
| --- | --- | --- | --- |
| `axiom.control.release.deployment.load-review` | Load verified deployment review | `control_candidate_552b0a73bd7c1780cb86_1` | `desktop/src/components/ReleaseDeploymentApproval.tsx` |
| `axiom.control.release.deployment.review-exact-approval` | Review exact deployment approval | `control_candidate_25289e2ec5233e6f2924_1` | `desktop/src/components/ReleaseDeploymentApproval.tsx` |
| `axiom.control.release.deployment.approve-exact-action` | Approve exact deployment action | `control_candidate_18ba8c2d29b2702d405b_1` | `desktop/src/components/ReleaseDeploymentApproval.tsx` |
| `axiom.control.release.deployment.load-execution` | Load deployment execution | `control_candidate_25fd9a9c2b16a51c61d8_1` | `desktop/src/components/ReleaseDeploymentExecution.tsx` |
| `axiom.control.release.deployment.recover-record` | Recover saved deployment record | `control_candidate_e97ef0ae553a00926829_1` | `desktop/src/components/ReleaseDeploymentExecution.tsx` |
| `axiom.control.release.deployment.open-acknowledged-run` | Open acknowledged GitHub run | `control_candidate_e9c8cce2a27808e42a7c_1` | `desktop/src/components/ReleaseDeploymentExecution.tsx` |
| `axiom.control.release.deployment.confirm-execution` | Confirm exact deployment execution | `control_candidate_47780ea31ae8660664ea_1` | `desktop/src/components/ReleaseDeploymentExecution.tsx` |
| `axiom.control.release.deployment.execute-reviewed` | Execute reviewed deployment | `control_candidate_4a4e957904ac99508619_1` | `desktop/src/components/ReleaseDeploymentExecution.tsx` |
| `axiom.control.release.deployment.cancel-prepared` | Cancel prepared deployment | `control_candidate_2f8ae51d6ea52d7003e3_1` | `desktop/src/components/ReleaseDeploymentExecution.tsx` |
| `axiom.control.release.deployment.prepare-provider` | Prepare provider deployment | `control_candidate_7bdfb9803962e9d02731_1` | `desktop/src/components/ReleaseDeploymentExecution.tsx` |

Current source SHA-256:

- `desktop/src/components/ReleaseDeploymentApproval.tsx`: `b784746e5e21fd78efe184d6f31f5ad45225a2b07e2ad0899fd5e742c1c4bd38`
- `desktop/src/components/ReleaseDeploymentExecution.tsx`: `67af41937f2c00519e276b3d1e0e4feb61bbafaa36dfa3f2e89b79402a96d5f4`

The optional Governance baseline digest is display evidence before the exact approval checkbox, not an interactive permission grant. Its absence must not be silently replaced with the active digest. Record normal, missing/stale baseline, denied/self-review, expired source/approval, disabled execution, lost acknowledgment, uncertain/consumed outcome and workspace-change states during genuine future acceptance. Screenshots, demos, captions/transcripts, shipped version verification and editorial sign-off remain missing.

Revision 2 supersedes article revision 1 for this local source-review queue; the original article, evaluation and mapping bytes remain immutable. Source drift quarantines revision 1 rather than silently rebinding its historical assertions.

Current source distinguishes admission before approval consumption/attempt claim from final dispatch checks after the last database clock and after transaction-result delivery. Numeric policy/approval/evidence expiry and the actual private provider-proof window remain bounded; no DTO or displayed digest renews them. Failure before claim rolls back consumption and attempt together; uncertainty or refusal after a committed claim preserves the original consumed attempt, with no reset/resend.

The deployment-specific original reviewer/executor session-expiry freshness port remains unqualified. Existing authority checks do not establish that this original-session bound is retained through every final awaited boundary. Complete coverage, enrollment/live authority and genuine native/human acceptance remain separate missing gates. This control map grants no permission and supplies no activation route.
