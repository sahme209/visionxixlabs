# Teams and Linear action controls

INTERNAL DRAFT — source-only, unpublished. Customer eligible: false. Editorial, media, native, release and shipped acceptance: false. Historical live acceptance evidence is not current provider status. This guide makes no current connection, execution or security certification claim.

The mounted control is `ConnectedActionsPanel`, shared by Teams and Linear. Apps & skills mounts it from the connected provider's **Actions** control. `SavedBotTaskWorkspace` mounts `BotConnectedActionsPanel` for the selected saved task only when clean and unlocked; that wrapper delegates Teams/Linear to the same generic panel. Slack and Outlook have separate guides and approval paths; their approvals do not authorize either provider here.

## Prepare a task-linked review

Open actions for the saved task. Task history must load before a new draft is allowed. The server binds the task ID and saved version; a historical version warning requires a new action for the current saved version. Outside a task, **Task-linked reviews** selects linked history; ordinary history excludes linked reviews. History is bounded to twenty displayed records and can be truncated.

**Review action permissions ↗** checks the current desktop session, owner/admin role and connections:manage capability before opening provider-specific browser action access for the expected user/workspace. Opening the page is not consent. Teams action scopes are openid, offline_access, User.Read, Team.ReadBasic.All, Channel.ReadBasic.All and ChannelMessage.Send. Linear action consent requests read and write. Legacy issue-create scope does not imply update/close access. Consent, provider target access and exact independent approval are distinct requirements.

Choose **Load authorized targets**, then Team. The selected team must match the returned verified snapshot. Archived teams are disabled; a bounded target notice does not promise a full directory.

| Provider/action | Exact inputs |
| --- | --- |
| Teams channel message | Standard Channel and Message; nonstandard channels disabled. Message limited to 4000 bytes by server intent validation. Messaging permission required. |
| Linear create | Team, Issue title, optional Description. Title limited to 240 bytes and description to 16000 bytes in the intent. |
| Linear update | Team, Issue, Issue title, optional Description; update permission required. |
| Linear close | Team, Issue, Completed state; only completed states offered; update permission required. |

**Save exact action for review** stores the plan, not a provider write. The server re-reads authorized targets, requires the consenting owner and binds provider, connection revision, workspace, team, exact fields, target evidence and optional task version. Plans expire after fifteen minutes. A connected account alone does not enable execution. The disabled-execution notice reflects returned activation state; this inspection did not read runtime flags.

## Requester, reviewer and execution

The requester is also the executor. A separate authorized human reviewer must inspect the saved provider, target IDs, content, task version, digest and expiry. AI cannot supply genuine human approval. The **I reviewed this exact target and content** checkbox is local acknowledgement; it clears after successful requests and does not itself approve.

| Control | Source conditions and effect |
| --- | --- |
| Approve exact action | agent:approve, requested and unexpired, actor different from requester/executor, current task binding; records approval for this exact plan only. |
| Execute approved action once | connections:manage, enabled provider, approved/unexpired, current executor and task; current authority, target/connection freshness and outbound guards still decide server acceptance. |
| Cancel action | Requester, requested/approved state; cancels review before dispatch, not provider work already submitted. |
| Reconcile expired attempt | Executor, dispatching record; before lease expiry returns current record, after expiry records unknown. Does not resend or undo. |

Saved cards show state, attempt count /1, target IDs, title/content or completed-state ID, digest, expiry, task version and recorded approver. A recorded verified result can expose **Open verified provider result**. A receipt is specific to that operation; it is not proof of unrelated delivery or present provider health.

## Uncertainty and recovery

**Reload history** becomes **Recover same saved action** while a mutation is pending. Pending work blocks further mutations. **Retry saving same draft** is limited to pending draft creation and preserves the same intent; it is not a provider execution retry. Reconcile the saved state before considering another action. Unknown explicitly requires checking the provider before any new action and says this action will not be resent. One dispatch attempt is stored; there is no automatic resend. A client abort, panel Close or workspace change is not proof that provider work was undone.

## Evidence boundary

The adjacent manifest pins whole files and exact inclusive ranges with newline bytes retained. This is static source identity, not a walkthrough or behavior test. No provider call, status/OAuth/credential read, database action, grant, experiment, build, old test rerun, backend/runtime/UI change or external publication was performed. Native walkthrough, visual/accessibility checks, media, editorial and customer publication remain unaccepted.
