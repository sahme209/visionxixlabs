# Guided customer journey local implementation

User moved this work ahead while the Mac is locked; Windows remains after Guided Journey and Governance. Branch codex/guided-customer-journey preserves prior ServiceNow/Jira/Bot receipts.

Shared read-only journey guidance now appears in desktop release requests, exact Jira/ServiceNow action cards and Teams/Linear action cards. The web Control overview provides matching fixed navigation to existing connection, Agent-review, audit and help destinations, and explicitly distinguishes desktop release/ticket reviews from Agent approvals. There is no new aggregate inbox or approval authority.

The model presents responsible actor and readiness → human review → verified outcome → recovery. Recorded approval never grants execution; request closure never proves deployment or application health; a simulation never claims a live provider effect. Unknown/dispatching outcomes and consumed attempts retain their history and never recommend resend. Expired unused plans require a fresh review. Stale observations request refresh. Existing controls and server guards remain unchanged.

Verification:26 focused model/rendered/regression checks pass; desktop types/frontend build pass. Exact final reviewed production build and Next TypeScript checks passed. Reviewer found closed records incorrectly directed to active controls; a RED test reproduced this and the fix directs closed records to saved outcomes/history. Follow-up review reports no important findings. Native visual/session acceptance is pending Mac unlock, not inferred from jsdom or builds. No live provider write, new permission, schema, paid CI or deployment occurred.

Branding blocker: user describes white triangular logo with a transparent background and rejected the old purple/cyan node mark. No verified replacement asset was found in the bounded available local/history search. The user was asked to reattach the exact source. No guessed new mark or old-logo replacement was applied. Once supplied, use one source consistently for web/app/platform derivatives; do not overwrite immutable v0.1.21 installers.
