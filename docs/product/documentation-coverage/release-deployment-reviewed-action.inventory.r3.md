# Deployment review control mapping — draft revision 3

Internal source-review queue for `axiom.help.release.deployment-reviewed-action@3`, based on `4fb99c78e9eec08e343f69347f72eb95feae4ec2` plus the exact hash-bound files. Proposed help IDs below are documentation identifiers, not runtime authority or proof of supported shipped controls. No candidate is promoted from `needs_runtime_and_documentation_review`.

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

Revision 3 supersedes article revision 2 for this local source-review queue; revision 1 and revision 2 article, evaluation and mapping bytes remain immutable. Source drift quarantines earlier revisions rather than silently rebinding its historical assertions.

Current source distinguishes admission before approval consumption/attempt claim from final dispatch checks after the last database clock and after transaction-result delivery. Numeric policy/approval/evidence expiry and the actual private provider-proof window remain bounded; no DTO or displayed digest renews them. Failure before claim rolls back consumption and attempt together; uncertainty or refusal after a committed claim preserves the original consumed attempt, with no reset/resend.

The runtime now retains private original executor/reviewer session-expiry checks from the audited approval and current locked session rows. Claim and final dispatch recheck those original bounds after later database awaits and transaction delivery. Governed and positively absent legacy wrappers require the private publisher; the actual fixed transport invokes the retained synchronous proof immediately before its sole provider POST, after its last scheduled promise callback and request preparation. This is source-qualified local behavior, not a client permission marker or atomic external-provider control. Complete mutation coverage, enrollment activation, mixed-runtime/drain and legacy credential qualification, live/provider/native/human acceptance, safe media, shipped-version verification and editorial approval remain separate missing gates. This control map grants no permission and supplies no activation route.


Source-qualified revision-3 evidence (test definitions and fixed transports; paired identity/provider and coverage fixtures remain simulated):

- [Original-session authority](../../../lib/desktop/releaseDeploymentAuthority.ts), [service wiring](../../../lib/desktop/releaseDeploymentServices.ts) and [coherent store](../../../lib/tauri/releaseDeploymentExecutionStore.ts) retain exact original sessions and private expiry closures.
- [Governed wrapper](../../../lib/governance/intelligence/governedReleaseDeployment.ts), [legacy coordinator](../../../lib/desktop/releaseDeploymentGovernanceCoordinator.ts) and [fixed dispatch transport](../../../lib/tauri/releaseDeploymentTransportGithub.ts) retain the published proof across final awaits without serializing it.
- [Actual PostgreSQL admission definitions](../../../lib/governance/intelligence/__tests__/deploymentRequestAdmission.pg.test.ts) include original executor/reviewer expiry while provider proof remains fresh, delayed commit/result delivery, and delayed final helper return. [Transport tests](../../../lib/tauri/__tests__/releaseDeploymentTransportGithub.test.ts) cover final scheduling/request-preparation expiry and malformed serialized authority refusal.
- [Actual HTTP/services composition definitions](../../../lib/desktop/__tests__/releaseDeploymentGovernanceComposition.pg.test.ts) cover exact approval plus one dispatch/no resend, positively absent custom scope, revoked reviewer and unavailable metadata. These are local fixtures, not production enrollment or real human acceptance.

No tests or retrieval runs are performed by this document. Revision-3 offline schema/hash validation is recorded separately; the evaluation cases remain proposed, not executed.
