# Outlook: connection, bounded reads and exact action reviews

**INTERNAL DRAFT — unpublished. Customer eligible: false. Publication approved: false. Editorial accepted: false. Media accepted: false. Native accepted: false. Shipped/release accepted: false.** Static source inspection at `ad8efae1c600ad8504d9c47544505370b09b1002`, November 3, 2026. Current access, activation and successful use are **not verified**. Historical live acceptance is not current evidence. [Exact source bindings](outlook-controls.sources.json) identify the inspected files, inclusive ranges, hashes and literal anchors.

This finite guide describes the mounted Outlook card and its nested action panel. It creates no help IDs, runtime bindings, UI, backend capability, permissions or activation. It does not complete B4 or authorize customer publication.

## Find the Outlook connection

From **Apps & skills**, use All or Apps (the source filter value is `plugins`); Outlook is hidden by other filters or a nonmatching search. Search terms are matched against `outlook microsoft email mail calendar collaboration`. **Open Outlook** expands the embedded connection card; **Close Outlook** collapses it. The same card is mounted in **Settings → Integrations**, beneath **Integration Center**. App navigation mounts these views; the catalogue does not install a different Outlook implementation. Opening either card checks status automatically. Closing it is not a disconnect or revocation control.

## Connect and inspect status

**Connect**, or **Manage** while connected, verifies the current desktop credential and `connections:manage`, then opens the Axiom Outlook account setup page in the browser with the expected workspace and user. It does not itself grant Microsoft consent. A failed check reports that an administrator must open setup from the current workspace. Browser setup requires the matching signed-in Axiom user/workspace and server authorization; browser authority does not become desktop action authority.

On that page, **Connect Outlook** begins the read-consent flow. **Optional action access → Review action permissions** starts a separate action-consent flow requiring an active previously verified connection owned by the same user and the same mailbox. Microsoft sign-in alone is insufficient: the callback exchanges the code, validates reported scopes, verifies profile and fixed mailbox/calendar reads, and attempts to persist the checked connection. Return to the desktop and choose **Refresh status**. Do not replay a callback after an uncertain exchange/save; inspect current status before beginning another setup. The browser's configuration and callback notices describe setup outcomes, not a current successful desktop read.

The source requests `openid`, `offline_access`, `User.Read`, `Mail.ReadBasic`, `Calendars.Read` for reads; action consent additionally requests `Mail.Send` and `Calendars.ReadWrite`. **Calendars.Read can authorize broader calendar data than the limited selected fields used by this read implementation.** Limited fetching is not a permission guarantee excluding bodies or attachments across Microsoft. The bounded read path below selects no bodies or attachments; the action path deliberately handles exact plain-text content and event readback includes its body. Connecting does not itself send mail or create an event.

| Card state | Meaning and next control |
| --- | --- |
| Status not loaded | No status loaded in this card; use Refresh status after resolving errors. |
| Awaiting service activation | `not_configured`; Connect is disabled. No activation is established by this guide. |
| Not connected | No stored connection; an authorized user can open Connect. |
| Available to the mailbox owner | Another user consented; reads are restricted to that user. |
| Reconnect required | Stored credential approaches expiry; review setup with the consenting user. |
| Needs attention | Connection/read needs attention; inspect the alert and refresh current status before proceeding. |
| Connected | Stored active connection/credential passed the status checks; not proof of a just-completed provider read. |

The account line shows email or display name and either **Read access only** or **Action consent recorded; exact approval still required**. Refresh status clears the displayed read data. Checking disables connection/read/refresh controls; there is no explicit cancel-check button. The read route requires a desktop session, `workspace:read`, workspace membership and accepted Outlook provider access; API-key authority is excluded. Runtime reads also bind workspace, connection revision, account and consenting user. Current role mapping gives `connections:manage` to owner/admin and `agent:approve` to owner/admin/security reviewer; actual server capability and current authority checks remain decisive.

## Read mailbox context and clear the display

Only Connected exposes **Read mailbox context**. It requests the current instant through seven days later. The fixed reader selects up to ten recent inbox metadata records and twenty calendar records, does not follow next-page links, and verifies mailbox identity before and after reads. The UI displays observed time, inbox subject/sender, event subject/start in local time and Cancelled when present. It is a bounded view, not the entire mailbox or calendar. Empty states describe this view/window only; truncation notices explain the limits. The server allows a bounded range up to 31 days, but this card has no editable range control.

**Clear local view** clears the card's displayed data only. It does not delete provider data, revoke consent, erase stored connection credentials or cancel an action. The read implementation does not upload this context to AI. Its displayed copy about no bodies/attachments/AI sharing describes this bounded read, not the full Microsoft consent grant or the separate action workflow.

A failed read clears local data and sets Needs attention. Alerts distinguish changed connection, expired/renewal-needed access, refused permissions, owner restriction, inaccessible mailbox and unverified reads. Refresh current status, confirm the current user/workspace and review setup/access as appropriate. Do not interpret a blank list or stale Connected label as verified access. The client binds configuration/revision, aborts on context change/unmount and bounds responses; cancellation of a client request is not proof that a submitted provider operation was undone.

## Governed Outlook actions: exact available controls

The action panel mounts once status exists except `not_configured`, including disconnected/attention states so existing reviews can remain visible. It automatically loads saved actions. **Reload saved actions** reads current reviews; up to twenty most recent reviews are shown. **Execution is not activated. Saved reviews remain available.** reflects `enabled: false`, not permission to execute. Server activation depends on both existing Outlook connection/action flags; their actual values were not inspected or changed.

**Prepare an email or event draft** is shown only when the server returns `canRequest` (`connections:manage`). Its Action selector offers **Send one email** and **Create one calendar event**. Enter comma-separated To/Required attendees, Subject and **Exact plain-text content**. Events additionally require Start/End as local datetime inputs; saved review shows exact UTC. Invalid time conversion reports an error. The save button requires connection readiness, no busy/uncertain state and nonblank subject/content/recipients; server schema/authority validation still applies. **Save exact action for review** persists a proposed action with a fresh intent ID, bound mailbox/connection and a 15-minute expiry; it is not a Microsoft mail-folder draft and does not submit the provider action. Owner/admin capability alone is insufficient without mailbox ownership and separate action consent. There is no draft-form Cancel, edit-saved-plan or delete-review control here.

Each saved review displays kind, state, attempt count out of one, mailbox, subject, recipients/attendees, exact content, event UTC range when applicable, plan digest and expiry. Independent approval and provider receipt appear when recorded. Review all fields before checking **I reviewed this exact mailbox, recipients, content and time.** That checkbox is local review state, not approval; it appears only if Approve or Execute is available. Starting any request/reload clears it.

| Control | Exact source availability and effect |
| --- | --- |
| Approve exact action | Server `canApprove`: `agent:approve`, requested state, different requester, unexpired intent. Requires the local reviewed digest and no busy/uncertain state. Server rejects self-approval and rechecks authority/current intent. Records exact independent approval; does not submit. |
| Execute once | Server `canExecute`: execution enabled, `connections:manage`, approved state, current user is executor, unexpired intent. Requires the local reviewed digest and no busy/uncertain state. Server additionally validates current connection, membership/provider access, live sessions, exact approval, freshness and outbound guards before a single attempt. Button visibility is not proof those checks will pass. |
| Cancel | Server `canCancel`: requested/approved state and requester is current user; disabled busy/uncertain. Cancels the saved review before dispatch. Does not recall submitted mail or remove an event. |
| Resolve expired attempt | Server `canRecover`: dispatching state and current user is executor; disabled busy/uncertain. Before lease expiry the store returns the existing record; after expiry it records unknown. It does not resend, verify delivery or roll back provider work. |

After Microsoft mail submission is accepted, the receipt says **Microsoft accepted the submission. Delivery is not verified.** Event confirmation requires matching provider readback. **Unknown** says to check Outlook before any new action and that this attempt will not be resent. Refused/cancelled/confirmed/unknown records have no retry button. There is no attachment, CC/BCC, arbitrary send-as or bulk action control in this panel.

If a mutating request fails/unconfirms, the panel locks further mutations with its uncertain state. Use **Reload saved actions** to reconcile the saved record first. A pending draft save must be found by its intent ID; if missing, the panel keeps the warning and uncertainty rather than offering a replacement. Other mutation failures require checking the returned current review and any provider outcome before deliberately acting again. Changing workspace clears local form/review data and aborts client work; that is not provider cancellation or a recovery receipt.

## Evidence boundary

The manifest binds actual navigation/view mounts, card/panel, desktop transports/routes, read and action HTTP authority, current role mapping, browser page/consent/OAuth, scope contract, bounded reader/runtime, shared action store and provider action transport. Source hashes establish identity only. No current external/provider/status/customer/database/OAuth/native/UI read or action was performed, and no credential/Keychain/runtime configuration was accessed. No build, old suite, source experiment, new grant or retry was run. Native walkthrough, approved media, visual/keyboard/accessibility validation, editorial acceptance, release/shipped acceptance and approved customer retrieval/publication remain unaccepted.

## November4 local calendar draft-lock supplement

The original source bindings above remain historical and are not silently requalified. A later [two-field local repair](../../recovery/2026-11-04/outlook-event-draft-lock/README.md) makes calendar Start/End follow the other draft fields: they lock while saving or while its result is uncertain. Reloading without finding the original pending draft keeps them locked; confirmed readback restores editing. This is local source/component evidence only, not a shipped/native/provider acceptance or customer-approved article revision. No automatic replacement or resend is added.

## November4 local-time validation supplement

A later [local conversion repair](../../recovery/2026-11-04/outlook-exact-local-time/README.md) refuses nonexistent or normalized-invalid local times instead of silently shifting the draft. Valid UTC/seconds/milliseconds remain preserved. Fall-back overlaps retain the existing Date choice; no disambiguation is claimed. Original source pins remain historical. Local component evidence, including the interrupted ephemeral-config custody gap, is not shipped/native/provider or customer-editorial acceptance.
