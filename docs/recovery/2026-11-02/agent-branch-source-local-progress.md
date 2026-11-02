# Agent branch source binding — local partial completion

New branch proposals discard model `_review` data and capture the exact tenant-scoped base commit before the existing proposal digest and human review are created. Invalid targets, unavailable reads and malformed SHA evidence refuse proposal creation. Existing symbolic proposals cannot execute through the new coordinator.

The fixed branch transport accepts a reviewed SHA, checks that the observed base still matches, and sends that exact SHA in its single creation request. If the branch moves during later authority validation, the payload still names only the approved commit; this is immutable payload binding, not an atomic promise that GitHub's symbolic branch cannot change. The coordinator requires matching captured base/destination names and confirms only the exact reviewed SHA and branch ref. A mismatched/lost response stays unknown and consumed, never retried.

The public readiness/prepare/execute service STILL blocks branch creation until review display and full customer composition are finished. PR creation and AWS dispatch also remain blocked for unfinished source binding. This does not narrow the original eight-tool completion requirement. Browser copy now correctly states that approval records a decision only; requester execution is separate.

## Evidence and limits

- Eight new RED failures in proposal/transport tests demonstrated missing capture/refusal. Three further coordinator RED checks demonstrated missing captured-source validation, drift refusal and exact-result confirmation. Final three suites:82 checks pass (simulated provider/authority).
- Five actual isolated PostgreSQL coordinator journeys pass: original reviewed branch success, changed base/zero POST/consumed refusal, lost response/no repeat, current reviewer revocation/zero POST, competing coordinators/one write. Six unrelated cases filtered/skipped. Source/review/role/session/installation/locks/CAS and fixed transport are real; request authentication, human review identity, token issuance and GitHub HTTP are simulated. Owned fixture w_d85iu2 stopped.
- First PostgreSQL run had a test-only attempt-versus-attemptCount assertion error; corrected to the actual strict DTO field and reran. No runtime weakening or record repair.
- Scoped requester HTTP/coordinator TypeScript passes. Full root production/native builds, signed app and visual acceptance were not repeated or claimed; broader suite completion remains open.
- Automated independent source review found no important source-binding loophole and identified the same corrected DTO assertion. This is code review, not human provider-action approval.

No deployment, feature switch, schema, grant, live provider write, paid CI or AI call occurred. Broader Governance admission/coverage/enrollment, all remaining Agent source/control gates and the complete two-workstream master plan remain unfinished.
