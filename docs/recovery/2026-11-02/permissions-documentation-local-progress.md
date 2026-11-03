# Permissions reference: local factual correction

2026-11-02. Authorized local website/documentation work only. No deployment, live read, browser inspection, provider action or production-availability claim.

The docs entry links `/docs/permissions-model`; that reference previously described approval as executing a write, universal human-approval gating for writes, and administrator-only Agent approval. Current source instead records an independent review in `app/api/desktop/agent/actions/[id]/approve/route.ts`; `lib/desktop/agentActionExecutionRequestService.ts` handles separate requester execution where enabled. Current capability mapping permits `agent:approve` for a security reviewer. Direct Airflow triggering has current capability/connection/session/unenrollment checks rather than a universal separately recorded human approval. These paths must not be collapsed into one marketing guarantee.

## Exact correction

- Added the existing-style “Preview workflow reference” callout: separate requester execution is a **local preview, not production-activated**; the installed release may lack Execute. No installer version or shipped eligibility is inferred.
- Replaced universal approval and administrator-only descriptions with workflow-specific capability and approval requirements.
- Described independent reviewer and original requester in the explicitly labeled separate-execution preview; an approval record is not evidence that a provider action ran.
- Removed “released” from metadata to avoid upgrading local source to shipped-installer evidence.
- Kept all existing section IDs, layout/styles/components/navigation, permission/runtime implementation and provider behavior unchanged.

Files: `app/docs/permissions-model/page.tsx` and its directly relevant `__tests__/page.test.ts`. The source-only audit and accepted exact-copy proposal remain at `work/website-claim-check/source-summary.md`. Engineering documentation skill applied for reader-focused scope and evidence limits.

## Proportional local evidence

- `/private/tmp/axiom-permissions-doc-preview-red.log`: **2 rendered-page assertions failed** against old copy before the correction. This tests actual React static rendering and metadata rather than a mocked page.
- `/private/tmp/axiom-permissions-doc-preview-green.log`: **2 tests passed**, confirming visible local-preview/not-production availability and capability/reviewer/requester distinctions; removed universal claims are absent.
- `/private/tmp/axiom-permissions-doc-preview-types.log`: **exit0, empty output**, scoped TypeScript over the page, tests and imported dependency closure using Node24.21.0 and `work/website-claim-check/tsconfig.json`.

No broader suite, production build, screenshot/layout acceptance or live production comparison is asserted. This is documentation correction, not new feature acceptance, full Governance coverage/activation, independent security certification or a published release. Independent focused source review completed with no material findings; the reviewer ran no duplicate tests or external calls. Root owns commits/publication decisions.
