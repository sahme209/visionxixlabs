# Axiom Bot: drafts, AI responses and separately reviewed actions

Help ID: `bot.workspace-controls` · **Local documentation draft** · Source `21f4351f9e54ed6e9c121d6dba4eaac9b8b57563`, November 3, 2026.

Customer eligible: **false**. Publication approved: **false**. This source-inspected article describes the local desktop implementation; it does not establish that every control is in the public installer, enabled for your workspace or accepted in a current native walkthrough. No screenshot, recording, live provider test or complete accessibility qualification is attached. Nested Slack/Teams/Linear review forms require their own detailed articles.

Axiom Bot keeps three different operations separate: **edit a draft**, **request an AI response**, and **prepare a reviewed app change**. Sending an AI instruction does not send a Slack/Teams message, create a Linear issue, merge a pull request or deploy anything.

## Before you start

The editor needs a verified paired desktop workspace session. If identity, organization, session configuration or context changes, reopen Bot in that current workspace. A configured connection or old successful test is not current action permission. **Connect apps** opens integration management; it grants no Bot action authority. The host passes the current `connections:manage` capability separately to relevant action panels.

Source: `desktop/src/views/AxiomBotView.tsx:6–21`.

## Write and save

| Control | Purpose and effect | What to check |
| --- | --- | --- |
| **What should Axiom Bot help with?** | Edits the instruction locally; editing itself does not upload. The first nonempty line supplies an automatic title until you edit that title. | Instruction/context each allow 4,000 characters; title allows 200; combined serialized data is limited to16 KiB. Oversized text is retained for correction. Never include passwords, API keys, tokens or other secrets. |
| **Task details → Details: Bot task title / Context to include** | Edits optional context and title separately from the instruction. | Context is part of the draft and may be sent with an explicitly requested AI response. Opening details is not a send. |
| **Save task draft** | Explicitly uploads the draft to the signed-in workspace; updates an opened task against its expected saved version. | “Task draft saved. No execution started.” is a save result, not an execution outcome. Both title and instruction are required. |
| **Tasks / Refresh saved tasks / More saved tasks** | Opens and reads bounded saved-task lists. **Filter loaded tasks** searches loaded rows, not the entire server history. | A row marked “Draft · version …” represents saved content. Loading a row does not execute it. |
| **Open saved task / New draft** | Replaces the current editor or starts a new unsaved draft. | When edits would be replaced, **Keep editing** cancels; **Open saved draft / Start new draft** confirms replacement. Saved history is preserved. |
| **History / Older history** | Reads recorded draft versions and their contents. | “Recorded drafts only; this is not execution evidence.” A history timestamp is not proof that an AI/provider action ran. |
| **Retry same save** | Retries the retained draft content. Creating a task reuses its original `clientRequestId`; updating an existing task resubmits its original `expectedVersion`. These are different persistence controls, not a universal save-ID lookup. | If an update committed but its response was lost, retry can report a version conflict. Use **Review saved version** to inspect the stored content before deciding what to retain. This is draft persistence recovery, **not** permission to retry an AI call or provider effect. |
| **Review saved version / Keep edits as new draft** | Resolves an expected-version conflict by reading the stored version or retaining edits as a distinct unsaved draft. | Do not overwrite newer saved content blindly. No action approval transfers to the new draft. |

Source: `desktop/src/components/BotTaskComposer.tsx:13–47`; `SavedBotTaskWorkspace.tsx:47–102,109–155`.

## Ask for an AI response

1. Check the AI setup and selected model. **Refresh AI setup** reads current availability; the selector offers verified permitted choices. The current Bot hook filters its choices to approved Vercel Gateway model entries; the existence of other providers elsewhere does not make them available here.
2. Choose **Send**, or press **Enter** in the instruction field. **Shift + Enter** inserts a new line. IME composition is not sent; Alt + Enter is not treated as Send. Disabled/busy/invalid state prevents submission. Send first saves and verifies the exact instruction if necessary, then starts the explicit AI request for that task version.
3. Read the saved result under that task. A response records its model/time and says **No tools used**. It is text, not proof of a provider change.

**Selected AI evidence** is optional. **Use in next AI response** on a completed exact task-version GitHub read selects that recorded snapshot; Send shares it with the approved AI provider. Source may have changed. **Clear selected evidence** removes that opt-in. Editing the task or changing its owner/version clears the old selection; selection never authorizes a merge or deployment.

### AI status and recovery

| Displayed status/control | Meaning / next action |
| --- | --- |
| **Waiting to prepare / Preparing saved instruction / Waiting for AI response** | A recorded request is pending or dispatched; inspect that request rather than starting another. |
| **Response saved / More information needed** | Read the saved response or requested information for the displayed task version. |
| **Stopped before dispatch / Canceled before dispatch** | The recorded attempt did not proceed to model dispatch according to its saved state. Retained instruction/history remains distinct from another request. |
| **Cancellation requested / Cancel task** | Requests stopping the recorded run when eligible. Dispatch may already have happened; cancellation does not guarantee a refund. |
| **Outcome unconfirmed / Check task** | The call may have been dispatched. Check the same request; there is no automatic resend. Unconfirmed task IDs remain blocked from another send. |
| **Recent AI task activity / recorded run / Open associated task** | Reads saved activity or navigates to the actual task owning the response; does not send again. |
| **Keep record and start another task** | Acknowledges an unknown record and opens a distinct draft; it does not clear the old task's unknown history, prove no charge or permit replay. Use distinct work, not a duplicate instruction to bypass uncertainty. |

Unavailable/corrupt local recovery storage prevents sending. Restore/review the recorded activity through supported recovery; do not delete a marker to unblock an uncertain call.

Source: `SavedBotTaskWorkspace.tsx:86–96,133–144`; `BotAiTaskActivity.tsx:2–16`; `desktop/src/lib/useBotAiTask.ts:54–122`; `BotPullRequestEvidencePanel.tsx:85`.

## App actions: read context before preparing a change

**App actions** opens separate workflows. Opening a panel does not execute it. Saved clean task-version requirements are applied to action drafts; editing the task requires reviewing its current version.

| Entry and controls | Effect and prerequisites |
| --- | --- |
| **Open workspace report → Create readiness report** | Uses recorded workspace metadata, not a fresh provider scan or an AI response. Save a clean task, load current capability and explicitly confirm the recorded-metadata checkbox. **Refresh reports / Check report / recent report** read the stored run. **Cancel report** requests cancellation of a pending run. An unconfirmed report offers **Retry same report** with its original request identifier; this is not a provider retry. |
| **Open GitHub evidence → Submitted release / Stored pull request / Read evidence** | Reads a stored submitted-release target using current GitHub read access after the explicit read-only checkbox. No merge or deployment. **Refresh evidence / Check saved read / recent read** retrieve the original records; **Cancel read** requests stopping the read. Unknown/pending reads block a new start. |
| **Explore Jira form / Close Jira form** | Reads supported live form choices for exploration. The UI explicitly says those choices are not saved task execution evidence and do not publish a ticket. |
| **Slack notification / Teams message / Linear issue** | Opens the existing separately governed provider workflow, bound to the exact saved task/version and connection. A different authorized person must genuinely approve the exact target/content before the requester executes. Bot Send is unrelated to those provider effects. |
| **Load Slack channels / More channels / Slack channel** | Reads authorized channels when current management access permits. Nonmember channels are disabled and labeled “invite Axiom first.” Selecting a channel prepares the separate Slack panel; it sends nothing by itself. |
| **Workflow access and evidence details** | Explains recorded metadata, source targets, current access and task-version binding; it does not grant capability. |

Report states include **Queued**, **Reading recorded metadata**, **Report saved**, **Report could not finish**, **Canceled**, **Stop requested**, **Start deadline expired** and **Interrupted — outcome unconfirmed**. GitHub read states include **Preparing read**, **Reading pull request evidence**, **Stop requested**, **Evidence saved**, **Read could not finish**, **Canceled** and **Read interrupted — check its outcome**. “Saved” means a recorded artifact, not fresh authority or provider-mutation success.

Sources: `BotAppActionLauncher.tsx:4–13`; `BotReadinessReportPanel.tsx:8–86`; `BotPullRequestEvidencePanel.tsx:10–86`; `BotConnectedActionsPanel.tsx:7–14`; `SavedBotTaskWorkspace.tsx:128–130,157`.

## Computer: local observation and one exact edit are separate

In **Task details → Computer**, **Select window** invokes the macOS system picker. Supported native macOS15.2+ and current local capability are required. **Capture once** captures only the selected session once; the snapshot stays in app memory and is not saved or sent to AI. **Stop** ends observation. A paused/expired session must be revalidated or selected again; changing task/workspace or leaving the panel stops observation. A screenshot is not action approval.

**Act once** requires a saved unchanged task, current verified recovery identity, selected window and available native input capability. Enter **Exact replacement text** in Axiom, then **Prepare one text edit**. Inspect the displayed target, current text, replacement and expiry. **Confirm one action** opens a separate native confirmation; it is not general computer control. The native path must still validate the exact ordinary TextEdit field and foreground. Normal edits require the explicit foreground handoff within10seconds. Only the separately confirmed disposable acceptance-test fixture has the bounded selected-window activation exception; macOS may auto-save it. Saved documents otherwise refuse. Browser/password/file/mouse actions and AI sharing are unavailable in this panel.

**Stop action** stops the current preparation/confirmation. For **Outcome unconfirmed**, choose **Check saved outcome**, never repeat the action. **Saved outcome: confirmed** with one verified input is different from a refusal with `inputPerformed:false` or an unknown result where input may have occurred. No new execution is authorized by this article.

Sources: `BotComputerObservationPanel.tsx:10–32`; `BotComputerInputPanel.tsx:10–30`; `SavedBotTaskWorkspace.tsx:158`.

## Navigation and qualification limits

Opening **Tasks** focuses its loaded-task filter; **Close task list** returns focus to Tasks. Opening **Task details** focuses the selected inspector tab; **Close task details** returns focus to its trigger. Inspector tabs support Left/Right arrows, Home and End. The visible **Workspace report** tab is internally named Library; it is not a catalog of all app plugins. No Escape/focus-trap behavior is asserted for these side panels without a current native test.

This article is an authoring draft derived from actual source, not a customer-approved retrieval entry or complete control-by-control help binding. Before publication: independently review the wording against backend effects, confirm the shipped version/flags and actual permissions, capture redacted current-source images, test keyboard and light/dark native flows, and document every nested provider-form control and recovery outcome separately. Do not use historical acceptance of one test as evidence of current connection health or full autonomous computer control.
