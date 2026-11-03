# Slack notification: review, prepare and send once

Help ID: `bot.slack-reviewed-action-controls` · **Local documentation draft** · Source `f0312f54a08eed23fa672981889c6e7846ad713e`, November 3, 2026.

Customer eligible: **false**. Publication approved: **false**. This article inventories the actual local task-linked Slack controls. It is not a shipped-version, current-connection, native-accessibility or live-send acceptance receipt. Current native screenshots and independent editorial/backend review remain required before customer publication.

A Slack notification is separate from Bot's AI **Send** button. Here, you save one exact channel/message, a different eligible person approves it, then the requester prepares and explicitly sends that approved message once. Approval alone does not send anything.

## Access and exact binding

Open **Axiom Bot → App actions → Slack notification** with a clean saved task. The launcher disables provider-change entries for unsaved/edited tasks. The server binds the saved task's organization, creator, version and content hash; later changes invalidate action eligibility rather than silently updating the reviewed message.

The current paired desktop session and accepted workspace membership are required. Reading requires `workspace:read`; requesting/preparing/executing requires `connections:manage`; a genuine separate reviewer needs `agent:approve`. The requester is also the named executor in this workflow. A reviewer must be neither requester nor executor. Current original requester, executing and reviewer sessions/permissions are checked again where required; signing into another account or checking a box is not authority by itself.

The current Slack connection must match the saved connection ID/revision and Slack workspace, remain active/not revoked, contain `channels:read` and `chat:write`, and have been consented by the requester. The channel must be the verified public, unarchived channel with Axiom as a member. Do not grant broader scopes, reconnect or invite an app merely because this article mentions a requirement; those are separate authorized setup actions.

Sources: `desktop/src/components/BotAppActionLauncher.tsx:4–13`; `BotConnectedActionsPanel.tsx:7–14`; `lib/axiom/bot/actionTaskBinding.ts:7–14`; `lib/desktop/slackNotificationsHttp.ts:36–58`.

## Choose the channel and save the message

| Visible control or record | Purpose and effect | Availability / next step |
| --- | --- | --- |
| **Load Slack channels** | Reads the currently authorized channel choices; does not send a message. | Offered to the current management-capable user. A loading/error result is not a connected/successful-send status. |
| **Slack channel / More channels** | Selects one returned channel or loads another bounded page. | A nonmember channel is disabled and labeled “invite Axiom first.” Selection alone creates no provider message. |
| **Message** (`Slack message`) | Edits the exact notification text locally. | Requires nonblank valid text, no unsupported control/surrogate characters and at most4,000 UTF-8 bytes. This byte limit differs from the Bot instruction's character limit. |
| **Save for independent review** | Saves the exact workspace/channel/text and optional exact task binding to a durable requested review. | Requires valid member channel, available task-linked history, no busy/unresolved hold and current request authority. This is not a provider send. A successful request clears the message editor. |
| **Reload notification history** | Reads saved approvals/operations, including recovery of an unresolved original draft request. | Use after an unconfirmed response before another action. It does not resend a message or renew expiry. |
| **Task-linked reviews** | In the non-task-specific review view, loads saved task-linked records rather than ordinary unlinked notifications. | This is a bounded historical view, not a search of every provider message or a grant to execute another user's operation. |
| **Close** | Closes this Slack workflow panel. | Does not cancel a saved approval/operation, undo a send or prove an unknown result absent. |

The **Governed notification** area displays the Slack workspace and channel, exact message, saved task version when present and expiry. Read those values before every decision. A task title alone is insufficient. The list may state **Only the latest saved records are shown**; missing from that list is not evidence that no operation exists.

Sources: `BotConnectedActionsPanel.tsx:11–14`; `SlackNotificationPanel.tsx:6–19`; `lib/integrations/slack/slackNotificationContract.ts:8`; `lib/desktop/slackNotificationsHttp.ts:56,66`.

## Review, then prepare, then send

| Visible control | Who / what it does | What it does **not** mean |
| --- | --- | --- |
| **Review exact Slack message** checkbox | Eligible reviewer or preparing requester confirms the displayed exact workspace/channel/message. The checked value is bound to that record's ID, version and intent digest; starting a request clears it. | It does not approve, prepare or send by itself. No agent may make a required human independent decision on someone's behalf. |
| **Approve exact message** | A distinct currently eligible reviewer records approval of the requested version0 after exact review; server result must be approved version1. | Approval alone does not send. A requested card saying “Waiting for another workspace member with approval access” must not be bypassed. |
| **Prepare approved message** | The requester/executor, after reviewing that approved exact record, creates the session-bound prepared operation. It rechecks current approval, task, connection/channel evidence, credentials and service availability. | Preparation is not a send. An existing prepared operation is not a reusable permission for repeated messages. |
| **Confirm approved Slack send** checkbox | The requester confirms “Send this exact approved message once” on the prepared version0 operation. | Does not dispatch until the separate Send button is clicked; changing channel/connection prevents the shown send controls from matching. |
| **Send approved message** | Claims and attempts the exact prepared operation once, consuming the independent approval. Requires enabled sending, current write access, matching workspace/channel/connection revision and server checks. | Does not promise delivery, human reading, a retry on timeout or permission for another message. |
| **Cancel unused message** | The original requester cancels an unused requested/approved review when the saved state/version permits. | Cannot undo an already sent message. |
| **Cancel prepared notification** | Cancels an unused prepared operation, subject to the server's original session/authority and expected version. | Cannot cancel/replay a dispatching or consumed attempt, retract a message or clear uncertainty. |

The request initially sets a15-minute expiry; preparation does not extend it. Approval, preparation and dispatch recheck the saved deadline and current authority. History loading never renews an expired record. The local UI displays the exact expiry even when a stale historical state still reads requested/approved. Do not reuse an expired approval or create duplicates to work around an unknown result.

Sources: `SlackNotificationPanel.tsx:14–19`; `lib/integrations/slack/slackNotificationApprovalStore.ts:17–48`; `slackNotificationStore.ts:39–49`; `lib/desktop/slackNotificationsHttp.ts:56–62`.

## Read states and recover uncertainty

Review states are **requested**, **approved**, **consumed** and **cancelled**. They describe the approval record. Notification states describe the separate operation:

- **prepared**: an exact unused operation exists; it is not yet a provider acknowledgement.
- **dispatching**: the single attempt is claimed/in progress; no second attempt is available.
- **sent**: a saved Slack acknowledgement contains its exact channel and message timestamp. The UI says **“Slack acknowledged message … Delivery or reading by a person is not verified.”**
- **unknown**: the result cannot be established. A message may already exist. Do not resend.
- **refused**: the recorded attempt was refused; it is not a reusable attempt slot.
- **cancelled**: the unused operation was cancelled; no delivery claim follows.

**Recover saved notification**, offered for dispatching/unknown operations, reads the same durable operation and can mark an elapsed dispatch lease unknown. It does **not** query Slack to prove absence, submit again, reset the attempt, renew the original deadline or guarantee whether a message exists. The UI explicitly says **Outcome unconfirmed. Do not resend this message.** Provider/claim history must remain intact.

If a save/mutation response is unconfirmed, the editor is held and other mutation controls are blocked until **Reload notification history** resolves the saved state. An unresolved *draft request* retains its original channel/text/task/version and request identity; the client looks up that original request rather than inventing another. This recovery holder is tied to the current in-memory desktop context; it is not a documented restart-persistent operation locator or permission to retry an unknown execution. Changing workspace invalidates the panel; reopen it under the correct current identity. A reloaded list alone never authorizes a second provider send.

Sources: `lib/integrations/slack/slackNotificationContract.ts:15–18`; `slackNotificationStore.ts:41–48,70–72`; `SlackNotificationPanel.tsx:12–19`; `desktop/src/lib/desktopClient.ts:1115–1133`; `slackNotificationsTransport.ts:26–37`.

## When sending is unavailable

The panel distinguishes service-disabled sending, a connection needing current consent/validation and insufficient current access. Draft/review history remains separate from executable availability. Return to the relevant workspace administrator/setup workflow instead of assuming an old successful test or saved approval means current access. Capability, source/task/connection/session checks and exact one-attempt records remain mandatory even when a send button is visible.

Keyboard semantics use native button, select, textarea and checkbox controls with explicit labels. The Slack message textarea has no Enter-to-send shortcut; use the deliberate reviewed controls. No current native Tab order, screen-reader, light/dark layout or full accessibility acceptance is asserted by source inspection. Required follow-up: exact shipped-version/flag check, independent editorial/backend review, redacted native images and keyboard/failure-state walkthrough without repeating consumed provider actions.
