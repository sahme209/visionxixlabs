# ServiceNow: deployment evidence, written-note observation and closure

Help ID: `tickets.servicenow-evidence-closure` · **Unpublished local documentation draft** · Source `b6e569e0454bf29472b37decd10803c3ad3fe31b` (November 3, 2026).

Customer eligible: **false**. Publication approved: **false**. Source inspection only; no ticket/customer read, provider action, database/test run or UI interaction was performed to author this guide. Current shipped-version/flags, redacted native images, keyboard/assistive-technology checks and actual lifecycle acceptance remain pending. The existing project note is already written under a consumed **UNKNOWN** attempt: **never resend, reset, renew or create a descendant of that attempt**. This guide records the observation/closure route, not permission to execute it.

## Start in the release's Tickets workspace

In the selected release's **Tickets** section, choose **ServiceNow**. This release-bound workspace is distinct from the separate **Change tickets** browser handoff. That browser destination uses its own authenticated session and does not turn these native controls into a ticket inbox or transfer desktop credentials. ServiceNow history and connection readiness must be loaded explicitly; an old successful test does not establish current access.

**Reload saved ServiceNow actions** reads saved actions. **Connect ServiceNow / Review ServiceNow connection**, when offered, checks current owner/admin plus connection-management access and opens the separate browser setup page; opening it is not consent or a provider write. **Prepare ServiceNow ticket** reads supported native-process metadata. Its **Change process**, **Short description**, optional **Description** and **Save exact change draft** controls create an Axiom draft only. Unsupported mandatory fields prevent submission. This is not ServiceNow's complete native form. Updating an **unused** action requires the displayed expected version and clears prior approval; it cannot recover a consumed attempt.

Sources: `desktop/src/components/ReleaseTicketWorkspace.tsx:8–26`; `ServiceNowTicketLifecycle.tsx:8–38`; `desktop/src/views/ChangeTicketsView.tsx:7–49`.

## 1. Associate the existing ticket with the actual deployment

The association preserves the original ticket request/action and the deployed request/version as different records. A successful deployment belonging to another request is not silently treated as the original ticket's deployment.

| Control | Meaning / effect |
| --- | --- |
| **Original published action ID** | Identifies the saved action that created or independently recovered the existing ticket. It is not the consumed note-action ID. |
| **Saved successful deployment evidence ID** | Selects the genuine saved successful run evidence to associate. A URL/text assertion alone is insufficient. |
| **Current deployed release head version** | Supplies the expected current head of the selected deployment; it may differ from the ticket workspace's displayed version. |
| **Prepare association for independent review** | Rechecks saved original history, ticket, deployment evidence and current head, then saves an exact provenance review. It sends no provider note and closes nothing. |
| **Saved ticket review ID / Reload exact ticket review** | Reads that exact saved review and its current-source assessment. A historical-only review cannot be approved. Loading never extends its deadline. |
| **Technical provenance and integrity bindings** | Expands exact IDs, connection revisions, evidence/plan/intake digests and source bindings. Expansion is not approval. |
| Exact-evidence checkbox → **Approve exact ticket association or policy** | A different eligible human personally records the exact provenance/policy decision. The checkbox alone is not the decision; wait for the saved approved status/version. |
| **Cancel or revoke review** | Cancels/revokes the exact review when current authority/state permit; it does not retract a provider write. |

Read the ticket number/sys_id, instance, original request, deployed request/head, repository/ref/source SHA, run/attempt and expiry. Association reviews use a maximum30-minute window; later provider actions have their own fresh, bounded windows. None of these windows restores an expired approval or authorizes execution. Current accepted membership and paired identity are required; review requires `agent:approve` and a person distinct from requester/executor. Preparing as requester requires current `deploy:execute`; policy administration is separately restricted to owner/admin with `connections:manage`.

Sources: `TicketGovernancePanel.tsx:12–68`; `lib/desktop/ticketAssociationProposal.ts:20–41`; `ticketGovernanceAuthority.ts:8–18`; `lib/releaseops/ticketGovernanceReviewStore.ts`; `desktop/src/lib/desktopClient.ts:1690–1700`.

## 2. Observe the already-written UNKNOWN note, without sending it again

An unknown transport result is not proof of absence. For the existing written note, use **Recover an already-written note from saved history**, enter its **Consumed unknown note action ID** and exact **Consumed note version**, then choose **Review the existing written note**. The same creator is offered on an eligible unknown link card. It prepares a separate evidence review only.

Axiom reads the narrowly scoped journal-proof endpoint using current read/journal-read authority. It binds the exact ticket, note digest/marker, original unknown action/version and current approved association. An empty `work_notes` field is never accepted as journal access or note absence. The proof identifies an exact journal entry/digest/time; it does not turn an old transport timeout into a successful acknowledgement.

In the written-note review, inspect **Written evidence note**, original attempts, journal-entry ID/creation time, exact-note digest, proof time, connection and approved association. A separate eligible human personally checks **I reviewed this exact ticket, original unknown attempt and journal proof** and selects **Approve exact written-note observation**. This observation expires within15minutes and no later than its association. The original attempt stays **unknown and consumed**; observation does not overwrite it, resend the note or approve closure.

After approval, **Continue to native closure checks** reloads and validates the associated provenance review. If preparation had an unconfirmed response, **Find this saved observation review** looks up the retained original request ID; it does not submit a replacement. A missing/unavailable result keeps the hold.

Sources: `ServiceNowWrittenObservationCreator.tsx:4–22`; `ServiceNowWrittenObservationFacts.tsx:3–13`; `TicketGovernancePanel.tsx:23–61`; `lib/desktop/serviceNowWrittenObservationProposal.ts`; `serviceNowWrittenObservationRead.ts:12–23`; `lib/releaseops/serviceNowWrittenLinkObservation.ts:12–20`.

## 3. Declare and independently review the real terminal-state policy

The **Declare ServiceNow closure policy** form is an explicit administrator declaration, not automatic discovery of what “closed” means. **Read current ServiceNow models** loads current active model choices. Choose **Native change model**, enter the **Administrator-declared closed state value**, **Closed state label**, **Approved runbook or policy reference** and **Source SHA256 digest** from genuine approved instance policy.

Optional field declarations are explicit: **Permit the native close_code field**, **Closure code is required**, **Allowed closure codes (one value | label per line)**; **Permit the native close_notes field**, **Closure notes are required**, **Maximum closure notes bytes** (1–8,192). Do not guess values from another instance or mark unsupported fields writable. Only the returned bounded active-model list is supported; truncated discovery does not imply unlisted models are valid.

**Save closure policy for independent review** saves the exact declaration for a different eligible human's **Approve exact ticket association or policy** decision. Saving/approving creates no provider permission and changes no native state. The policy's review window is15minutes; current source/connection/model must still match. **Unconfirmed policy request ID / Recover original saved policy review** reconciles the original saved request only; it does not create a policy again or grant authority from an old receipt.

In associated actions, enter **Approved terminal policy review ID** and choose **Load approved terminal policy**. Axiom requires the exact current approved policy and later rechecks its connection and transitions.

Sources: `ServiceNowTerminalPolicyCreator.tsx:5–28`; `AssociatedTicketActionsPanel.tsx:38–45`; `lib/desktop/serviceNowTerminalPolicyProposal.ts:4–8`; `serviceNowGovernedCloseReader.ts:18–40`.

## 4. Satisfy ServiceNow's native lifecycle, then prepare closure

**Check native closure for the observed note** uses the separately approved written-note observation plus association and policy. For an already confirmed link, **Read verified closure options** reads current options. Neither control closes the change.

Only an actual current ServiceNow transition whose conditions pass and whose target is declared terminal by the approved policy is offered. A Normal change still in New must follow that instance's genuine approval/lifecycle requirements; an Axiom association, observation or policy approval does not replace them. This panel does not provide a general control to advance every intermediate native stage or approve native requests on someone else's behalf. If no supported terminal transition is currently available, or a mandatory field is unsupported, the panel refuses closure; use the instance's authorized workflow, not a hardcoded state update.

Choose **Native terminal transition** and any supported **Close code / Close notes**. The metadata is short-lived (at most60seconds, capped by policy/credential/observation deadlines); reload current options if stale. **Save exact ServiceNow closure for independent review** saves one exact closure draft with the link version, policy, observation when applicable, transition and payload. An unused closure can be refreshed only under supported amendment rules, preserving history and clearing its prior approval. A consumed closure cannot be refreshed into another attempt.

On the resulting **Ticket closure** card, a different eligible person personally checks **I reviewed this exact provider target and content** and selects **Approve exact provider action**. The authorized requester/executor separately reviews the same version/digest and chooses **Close approved ticket**. Closure preparation/execution additionally requires current owner/admin connection-management authority in the associated-action composition. Service write enablement, current credentials, native conditions, all exact source/deadline bindings and the single-attempt record remain mandatory.

Axiom's fixed transport allows at most one state mutation and then checks the exact record/state/declared closure fields. A confirmed result requires the expected readback; a dispatched write without a verified result remains unknown. A checkbox, successful HTTP dispatch, a plan or an existing note is not closure proof. Live closure of the project ticket is **not accepted by this draft**.

Sources: `AssociatedTicketActionsPanel.tsx:38–40,57–72`; `lib/desktop/associatedTicketActionsService.ts:184–199`; `associatedTicketRequestService.ts:37,59–78`; `lib/releaseops/serviceNowTicketTransport.ts:34–38,52–106`; `serviceNowAssociatedCloseProof.ts:18–28`.

## Status, recovery and controls that must not become retries

- **Saved provider action ID / Load saved action outcome**, **Check saved action outcome** and **Reload associated action history** read saved records. **Refresh pending action outcome** reconciles a dispatching record; no automatic provider replay follows.
- **awaiting approval / approved** identify unused decisions, not provider success. Read the exact review version, payload digest, displayed deadline and attempt0/1. Expired decisions cannot execute. Maximum provider-action review windows are15minutes, capped by their actual source/native deadlines; a fresh association is not an extension of a consumed action.
- **dispatching / unknown** may mean the provider changed. The attempt remains consumed. `providerWritePerformed:null` means unconfirmed; **No provider write confirmed** is not by itself proof of absence. **confirmed** with `providerWritePerformed:true` is distinct from the controlled local foundation, which explicitly has no provider write.
- **Cancel unused provider action** is available only when current state/authority permits. It cannot undo a provider note/closure. Unconfirmed mutations hold other changes; inspect original saved history instead of making another nonce, deleting records or reusing expired approval.
- **Check historical note proof / Check exact journal proof / Inspect current prerequisites (read only)** inspect exact current prerequisites or the narrow proof. Present observations are not a reconstruction of the original refusal or new execution authority. An exact note already present blocks preparation of another.
- The visible fresh-note/corrective sections apply only to separately validated definitive-refusal-and-absence cases. Their **Consumed ServiceNow note ID/version**, original/sole-child ID/version, **Check exact corrective note proof** and preparation buttons do **not** authorize a descendant of the existing written UNKNOWN attempt. Preserve that note and use observation. Short-lived absence UI proofs do not override server eligibility or independent approval.
- A separate **Recover an existing ticket** panel handles an UNKNOWN *create-change* attempt: exact number/sys_id → separate recovery-association approval → **Verify existing ticket with read-only access**. It preserves the original unknown create outcome; it is not the written-note observation or a permission to create the ticket again.

Sources: `AssociatedTicketActionsPanel.tsx:27–37,44–72`; `ServiceNowRecoveryPanel.tsx:3–14`; `ServiceNowTicketLifecycle.tsx:34–39`; `desktop/src/lib/associatedTicketActions.ts`; `lib/releaseops/serviceNowTicketLifecycleStore.ts:59–72`.

## Route and publication boundaries

The desktop uses paired request-bound `/api/desktop/ticket-governance` review/lookup/approval/cancel routes; associated actions use `/api/desktop/ticket-governance/[reviewId]/actions`. Original release actions use `/api/desktop/deployments/[requestId]/servicenow-actions/...`. Some POST operations prepare/read/reconcile local records, while deliberate dispatch invokes the fixed provider transport; HTTP method alone does not determine whether a provider write occurs. Server flags/current permissions can refuse a control even when a historical card is visible. Browser account setup is separate from provider action approval.

Before publishing: independent factual review against these actual routes/store checks; verify current shipped build/flags and exact native labels; capture authorized redacted examples; test keyboard/expiry/unknown recovery without replaying consumed operations; obtain genuine independent observation, native lifecycle, policy and exact closure/readback acceptance. No screenshot of an approved card alone proves that whole lifecycle.
