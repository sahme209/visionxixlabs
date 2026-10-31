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
