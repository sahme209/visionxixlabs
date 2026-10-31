# Axiom interface clarity

Axiom borrows familiar interaction principles from modern developer and assistant workspaces: a stable navigation rail, a clear central task, readable conversation, focused composition, and supporting context on demand. Preserve Axiom's own brand and governed execution model.

## Screen responsibilities

- Agent: code, local files, research and reviewed engineering work.
- Axiom Bot: saved instructions, AI responses and separately reviewed app actions. Sending an AI request never implies tool or computer execution.
- Releases: scope, current prerequisites, exact plans, approvals and recorded provider outcomes.
- Repositories: repository context, local changes and supported sync controls.
- Batches: Airflow workflows and separately governed batch operations.
- Apps & skills: provider connections, fixed app workflows and reusable guidance; installation is not tool authority.
- Settings: current identity, preferences and supported configuration; governance and billing retain their server authority.

## Layout and language

Show one primary goal and next step, with its responsible person. Group controls by user intent, particularly Read context versus Prepare a change. Supporting schema facts, IDs, input limits and access details belong in named disclosures; exact target/content remains available in its review. Avoid unexplained terms such as Library for a workspace report. Use visible text and keyboard-accessible controls, not icon-only surprises or color-only status.

Keep failures, unconfirmed outcomes, consumed attempts, unsaved-work warnings and irreversible effects visible. Never put a required approval checkbox or a warning solely behind a cosmetic disclosure. Expanders must not initiate network or provider operations by themselves. Existing dirty-task, owner, active-panel, session and execution guards remain intact.

## Evidence and authority

A status shown in a summary is not an execution grant. A closed Axiom request is not deployment proof; a simulation is not a live provider effect; a successful workflow is not application-health verification. Exact actions retain their own current-source checks, independent review, deadlines and single-attempt records. Unknown outcomes lead to saved history and supported reconciliation, never a resend shortcut.

## Branding

Use one verified canonical logo source across web and desktop. The canonical replacement is the user-supplied white triangular mark in assets/brand/axiom-white-source.png. scripts/generate-axiom-brand.mjs turns its luminance into transparency without redrawing; the original black background is not displayed. Do not substitute a generated lookalike or reuse the rejected purple/cyan mark. Platform icon derivatives should be reproducible and legible. Published immutable installers are versioned artifacts and must never be silently overwritten.

## Verification

Test navigation and controlled-state retention, explicit-only execution, disabled prerequisites, expiry/uncertainty handling and keyboard navigation. Builds and jsdom checks do not substitute for visual/native acceptance. Batch production and installer changes through their existing release protections.

Settings navigation uses three purpose groups: Account & preferences; Agent & security; Development & connections. Grouping is presentation only; search filters existing section labels/keywords and never writes a preference. Preserve stable internal section IDs when changing visible labels.

## Product quality bar

The user's reference products are Cursor, Claude, Codex and ChatGPT. Carry the
interaction principles through Axiom's own identity: a focused conversation and
work surface; clear separation of asking, planning, reviewing and acting; direct
navigation back to the relevant file, task, source or outcome; readable progress;
and durable recovery when an operation is uncertain. Reference names are design
inspiration, not claims of integration or copied branding.

Prefer selecting an existing task, source or baseline over pasting internal IDs.
Keep exact evidence and version bindings available in disclosures. State who
must act next, what their decision authorizes, and what remains unavailable.
Use the same status words across views. A successful read, a recorded approval,
a policy activation and a verified provider change are distinct outcomes.

## Releases refinement priority

The user finds Releases specifically confusing despite its useful evidence.
After the current enforcement work, prioritize orientation over adding panels:
show the selected release, its current stage, the next responsible person/action,
and the last verified outcome first. Present scope, review, execution, evidence,
tickets and activity as a coherent progression. Retain technical facts in named
supporting sections, and preserve every approval, uncertain-result and recovery
guard. Carry this hierarchy consistently across the rest of Axiom.

First local Releases refinement: show each release's next-step/owner guidance
before its action toolbar. Keep unrelated recorded workflow observations in a
read-only disclosure, with the warning that they are not release evidence still
visible. This preserves mounted ticket/approval controls and all form/session
state; it does not execute or fetch anything when the disclosure is opened.
Actual native visual acceptance remains separate from source/type verification.

Outlook presentation follow-up from actual native screenshots: use one catalog
identity header and an embedded Connection section, keep connection/uncertainty
status visible, and place new email/event draft fields in an explicit preparation
disclosure. Draft values remain mounted across toggles; opening it starts no
network operation. Saving a new draft requires a currently connected mailbox.
Existing review, cancellation, recovery and exact approval controls remain
outside that disclosure and retain server-derived authority.

Apps & skills separates primary browsing (All, Apps, Skills, Developer tools)
from saved-status filters. App connections are grouped by their existing purpose
categories; available providers are not labelled as already connected. Skills
are presented as reusable guidance, not app permissions. Search has an explicit
accessible label. Filtering does not invoke connection/setup/install actions or
unmount the independently displayed action/recovery workspaces.

## Shared visual refinement — October31 local preview

The shared workspace now uses tighter, responsive content spacing, consistent control sizing and a quiet filled current-navigation state. The canonical mark has more breathing room. Top-bar identity remains available while its secondary description yields at narrow widths. Light theme, compact density, keyboard focus and reduced-motion preferences retain their existing mechanisms.

The reachable Releases workspace (DeploymentRequestsView, not the dormant legacy ReleasesView) uses one clear heading, stronger request titles, neutral record-status badges and a separated action toolbar. Request data, warnings, owner/next-step guidance, review controls, mounted forms and provider handlers are unchanged. This is a presentation pass, not a change in security authority or a claim that any release is ready.

Verification: desktop TypeScript/frontend build and37 existing navigation/journey/catalog checks passed. Offline native build and strict Developer ID signature verification passed. The first native command used an absent package feature; corrected to the existing tauri/custom-protocol dependency feature. No installer rebuild/publication, provider mutation or production rollout. Local visual acceptance is recorded separately.

## Focused Releases workspace — structural follow-up

The user clarified that premium quality means a coherent work experience, not just visual styling. The reachable Releases view now separates release selection from the active workspace. A compact navigator shows the saved request status, derived next step, current parent-level attention and working signals. One request is visible at a time; keyed workspaces remain mounted so switching does not discard drafts, review context or in-flight state. At narrower widths selection becomes a horizontal strip. Selection itself makes no provider call, records no approval and changes no execution authority.

Existing exact action warnings/recovery remain inside their original selected release context. Parent-level failures remain signalled in the navigator; the list is guidance, not verified execution status. Loading requests, current native/policy checks and provider action lifecycles retain their original behavior. Tenant context changes reset the selection container. Additional future refinement should group the selected release's tools by intent without concealing uncertainty or discarding review state.

Desktop types/frontend build, offline native build and strict signature verification passed. Thirty-five existing journey/catalog checks passed; three new focused-selection checks verify retained unsaved drafts, ID-stable reorder/removal behavior, accessible panel bindings and no execution controls. The first attempt used a .test.tsx filename outside the existing test glob and was not counted; corrected .test.ts checks all passed. These results do not establish live Governance or ticket closure acceptance.

## Cohesive launch and conversation pass — October31

Apply the focus model across the app rather than treating Releases as the product. Home now offers one primary Agent entry and three lighter navigation rows for tasks, releases and batches; no pretend prompt/composer or automatic execution. Existing entry callbacks and consent boundaries are preserved. Agent gives the conversation title and New chat prominence, moves rename/history controls into a keyboard-dismissable Chat options disclosure, uses quieter user messages and unboxed assistant responses with readable line spacing. Rename forms remain mounted; original sending/renaming/recovery guards remain. Bot uses a calmer contextual strip and current-task treatment. Apps replaces its unconditional security-sounding badge with a neutral Permissions & approvals label, and Settings uses the shared workspace surface.

This is a broader interaction/visual pass, not complete visual acceptance of every operating-system size/theme or a claim of premium quality by test count. Final Agent/catalog tests:133 passed. Earlier standalone welcome/navigation/rename checks passed; two initial integrated failures referenced the intentionally replaced home heading, then passed after updating that expected copy. Frontend types/build, offline native build and strict DeveloperID signing passed. No paid AI call, provider write, new permissions, production deployment or immutable installer replacement. Prepared local bundle: /private/tmp/axiom-cohesive-workspace-local/Axiom Agent Local Preview.app. Preserve user work when opening future previews.
