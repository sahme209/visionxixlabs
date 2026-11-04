# Desktop Apps & skills: top-level controls

Internal source draft. Source-code snapshotbe276403f07d888383af5ef442c7bf7239aed99d; exact bound code remains unchanged in this authoring tree. Customer, editorial, media, runtime, native and release acceptance are false. Proposed IDs below are documentation labels, not runtime help bindings. This is the mounted desktop view, not the public website /integrations catalog. No account, credential, provider status or runtime flag was read.

## Entry, ownership and loading

App.tsx134–187 mounts PluginsSkillsView for plugins-skills. Only owner/admin receives canManage=true. Bot-origin navigation initially selects Apps and offers Back to Axiom Bot while its original context/revision/identity remains owned. Other entry starts All. Connection settings navigates to Settings integrations; Airflow Open navigates to Batches. These navigation callbacks do not execute a provider action.

The session keys on desktop context revision. On mount/focus it requests skills, integration status and Airflow connection concurrently; stale request/context results are discarded. Status labels describe returned state, not independently verified present access or provider health. Failed skill loading shows an empty catalog with an issue; storage unavailable may still show curated skills as not installed. No installed state is fabricated by that fallback.

## Top-level controls

| Proposed ID | Control | Effect and limits |
| --- | --- | --- |
| desktop.apps.return | Back to Axiom Bot | Conditional Bot-origin callback; ownership checked. No provider action. |
| desktop.apps.refresh | Refresh capabilities / Retry | Reloads lists/status through existing client endpoints. It does not itself clear every unknown validation hold or grant access. |
| desktop.apps.search | Search apps and skills | Local trimmed case-insensitive search over skill name/description/category and provider name/detail/category. Outlook has separate keyword matching. No server search or AI request. |
| desktop.apps.browse | All / Apps / Skills / Developer tools (MCP) | Sets the single filter value. Browse and Status groups are alternatives, not independently intersected filters. MCP displays only the microsoft-learn-docs skill plus its tools section. |
| desktop.apps.status | Installed / Enabled / Disabled | Local saved-state filters. Installed skills means status not not_installed. Provider Installed excludes not_connected/checking/unavailable, so it is not a connected/healthy-only filter. Enabled/Disabled apply to skills and hide provider rows. |
| desktop.apps.settings | Connection settings | Opens Settings integrations. No consent or privilege follows from navigation. |
| desktop.apps.provider | Provider row Connect / Configure / Manage / Open | Airflow opens Batches; cloud setup routes to Settings. Other browser Connect needs current owned context, canManage, available status/configuration and no concurrent mutation. Service-unconfigured Connect is disabled. Rows are rendered from source catalog, not proof every advertised operation is currently available. |
| desktop.apps.validate | Verify access / Verifying… | Requests provider-specific validation, which may update saved connection state. This is not an approval to send a message or a health guarantee. GitHub uses its read-only validation endpoint; Teams notice distinguishes identity from message authority. |
| desktop.apps.validation-recovery | Reload status / Review consent | Shown for held Slack/Teams validation. Reload requests current status; Review consent navigates Settings. The client clears holds only under its matching new-receipt/pending-state rules, not merely because a refresh returned. Never replay unknown validation to bypass a hold. |
| desktop.apps.github | Revoked GitHub Connect / Reconnect verified installation / Dismiss review / Reload GitHub status | Existing-installation verification shows account type and repository selection, then explicit confirmation with unexpired challenge. Confirmation sets a reload hold before sending; unconfirmed outcome requires status reload. Dismiss clears the local review, not the provider installation. Other connection options exposes browser Connect. No actual installation or permissions were inspected here. |
| desktop.apps.slack | Manage / Close Slack manager; Notification reviews / Close reviews | Opens embedded controls for returned connected Slack; manager additionally requires canManage and active state. Reviews are not personal approval decisions. Nested setup/channel/review controls remain separate scope. |
| desktop.apps.connected-actions | Actions / Close actions | Opens Teams or Linear panel for a returned connected row; child receives canManage and enforces its own current checks. Opening a panel does not authorize its action. |
| desktop.apps.outlook | Open Outlook / Close Outlook | Mounts the existing card under All or Apps when separate keyword matching passes. It may load its own status. It is intentionally absent under Installed/Enabled/Disabled/MCP, so filtering can hide an existing connection. Nested reads, consent and actions remain separately governed. |
| desktop.skills.tools | Review skill tools | Local disclosure of workflow guidance/tool names, not a grant to those tools. |
| desktop.skills.change | Add / Enable / Disable / Remove | Changes workspace installation metadata through the paired admin route. Disabled without canManage, available storage or while working. Confirmed response reloads; failure reports unverified outcome and leaves changes unavailable until current state is refreshed. Do not assume failure means no record changed. |
| desktop.skills.use | Use in Agent | Only enabled skill with callback/current storage/no work. App passes a context/workspace-bound selection; Agent rechecks current enabled skills and inserts the skill invocation into its composer. It does not send the request or grant tool authority. |

Provider Connect accepts only HTTPS, no embedded credentials/port, and exact configured hosts github.com, slack.com, login.microsoftonline.com or linear.app before opening the browser. Final consent is a real separate access grant; this source inventory authorizes none. Source UI may offer a control that the server refuses.

## Skill persistence and uncertainty

The inspected skills GET route requires a paired desktop pipeline:read session and excludes API keys; POST additionally requires workspace administrator. Skill catalog membership/action is validated. Install/enable upserts enabled metadata, disable updates one existing row, remove deletes one installation row; audit follows the mutation. Audit failure can return503 after the metadata changed. Refresh current state before another deliberate change; UI rollback or a missing response is not proven storage rollback. This guide did not perform any request or database operation. A tool list or skill installation never substitutes for execution permission or an independent review.

## Developer tools (MCP) boundary

DesktopMcpTools exposes Check connection, Documentation topic, Search docs and result-title buttons. Check is available without enabled installation, disabled while busy; search needs enabled skill, nonempty trimmed query and idle state. Topic is limited to300characters by the input. The topic is sent to Microsoft’s public documentation service: use public technical terms, no secrets/private code/personal information. It is not a cloud-account scan. Returned results are filtered to at most10 safe HTTPS learn.microsoft.com origins before links open. No result/read/connection was exercised.

The paired MCP handler requires pipeline:read, bounds request JSON to2048bytes, validates action/keys, rate-limits and requires audit recording. Check availability is separate from installed search entitlement; unavailable/audit failure is not proof no documentation request occurred. This is a finite direct-handler reference, not full MCP transport, content safety or provider qualification.

## Recovery, exclusions and evidence

Keep current workspace/context and use the displayed status/consent recovery. Unknown skill/validation/reconnect outcomes are not permission for blind repeated mutations. Closing panels, changing workspace or aborting a client request cannot undo external consent or dispatched work. The no-matching-capabilities state is a local filter outcome, not proof the organization has no integrations or skills.

Nested Slack manager/reviews, Teams/Linear, Outlook and cloud setup are not fully inventoried here; use their finite source guides and preserve their omitted scopes. This guide excludes all provider login/MFA, actual grants/roles/tokens, backend-wide authorization, complete integration/skill catalog validation, source/server liveness, app-wide accessibility/native/keyboard/media and customer acceptance. Governance enrollment/issuer coverage remain unqualified. No browser/native/auth/provider/database/credential/AI/network/API/helper Security or Keychain operation, test or build occurred.

Related source drafts: [Outlook](outlook-controls.md), [Slack actions](slack-reviewed-action-controls.md), [Teams/Linear](teams-linear-controls.md), [cloud setup](guided-cloud-connection-controls.md), [Settings](settings-workspace-controls.md), [Agent](agent-workspace-controls.md). Exact source hashes/ranges: docs/recovery/2026-11-04/desktop-apps-skills-guide/source-bindings.json.
