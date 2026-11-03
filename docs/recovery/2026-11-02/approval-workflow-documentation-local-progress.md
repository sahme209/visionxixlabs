# Approval workflow reference: local factual correction

2026-11-02. Existing authorized local documentation work only. Current source page `app/docs/approval-workflow/page.tsx` had a “released boundary” label, administrator-only approval descriptions and a scoped responder described as executing after approval. These conflict with the locally qualified review-only approval route, capability-based independent reviewer authority and separate requester execution. The correction follows the existing permissions-reference pattern without asserting shipped or production availability.

Changes: explicit local-preview/not-production callout, installed-version Execute caveat, registered-Agent-tool scope for approval claims, independent current approval permission, and original-requester separate execution. Approval remains required for medium/high-risk Agent tools. Existing risk-escalation, current target checks, tenant-owned AWS workflow, independent provider result/validation and rollback limits remain. Approval alone is described as one prerequisite, not execution evidence or universal authority.

No layout/style/navigation/runtime changes, new capability, provider action, browser/live read, build, deployment or installer-version qualification. Historical `agent-reviewed-action.r1/r2.json` documentation drafts and all media were preserved. No separately routed public Agent action guide was found in the narrow source search; root was asked for an exact path rather than editing historical drafts or inventing a public guide.

Evidence:

- `/private/tmp/axiom-approval-doc-preview-red.log`: actual static-render page **2 failed** before copy change.
- `/private/tmp/axiom-approval-doc-preview-green.log`: **2 passed**, preserving approval/risk/provider-evidence caveats and verifying preview/current-reviewer/requester distinctions.
- `/private/tmp/axiom-approval-doc-preview-types.log`: scoped TypeScript **exit0 / empty output**, using `work/website-claim-check/tsconfig.approval.json` under Node24.21.0.

The earlier permissions-page tests were not repeated. This is proportional documentation validation, not live rendering, physical provider execution, complete Governance enforcement or production enablement. Independent focused source review completed with no material findings and no duplicate test or external call. Root owns commits and publication.
