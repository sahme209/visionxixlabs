# Agent branch review to requester execution — local increment

Shared pure branch source parsing now drives server validation and native/browser display. Both review cards show the proposal-time exact commit before expanding details, distinguish review from execution, and disable approval when captured source is missing or mismatched. Rejection stays available. The pure data parser is not execution permission.

The public requester readiness/service now qualifies captured branch proposals through the existing real reviewed-source/current-authority store and fixed coordinator. Old symbolic branch proposals still refuse. PR creation and AWS dispatch remain explicitly unavailable at this public entry until their source-binding work is complete. The original eight-tool scope and wider Governance scope are unchanged. Production execution switch remains OFF/unset; no enablement occurred.

## Verification

- Five new native/browser/readiness failures reproduced missing display, missing approval disablement and the temporary branch-only gate.61 final focused checks in five suites pass, including the actual rendered native ProposalCard and browser Governance page with simulated data. Existing ECS review test label corrected from obsolete approve-and-execute wording to Record approval.
- Two actual isolated PostgreSQL HTTP journeys pass: current readiness → prepare → refreshed readiness → one confirmed branch POST at reviewed SHA; and the same flow with changed base → one consumed refusal and zero POST. Both refuse a second execution, preserve original proposal/review rows and return no raw source through readiness.34 unrelated tests filtered/skipped. Authentication, human decisions, token issuance and provider replies simulated; real database source/roles/session/installation/locks/CAS, HTTP/service/guard and fixed client. Owned xz4jwq22 fixture stopped.
- Scoped server types, actual desktop types and Vite6.4.2 frontend build pass. Existing bundle-size warning remains. Full exact2880c6a6 root production build/Next TypeScript now pass from a clean Git archive (5,794 regular source files verified; no live credentials; fake local-only database endpoint). See agent-branch-exact-production-build.json. No signed native rebuild, app relaunch, visual acceptance or live approval/provider claim.
- Automated independent source review found no important issue in shared parser, displayed source, public qualification or React text rendering. It is not genuine human approval.

No production/settings/schema/grant/provider write/paid CI action occurred. Full Agent PR/AWS source work, conversation/outcome recovery, broad Governance admission/catalog/coverage/enrollment and all remaining master-plan work remain open.
