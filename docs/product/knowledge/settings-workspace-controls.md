# Settings and workspace controls

**INTERNAL DRAFT — unpublished. Customer eligible: false. Publication approved: false. Editorial accepted: false. Media accepted: false. Native/runtime accepted: false. Shipped/release accepted: false.** Static source baseline: `58f2ddd4`, November 3, 2026. Current connection health, permissions, credentials, allowance and successful operation are unverified. This guide is a finite source inventory, not B4 completion or customer publication approval.

The [source bindings](../../recovery/2026-11-03/settings-workspace-guide/source-bindings.json) record exact whole-file and inclusive line-range SHA256 values. Proposed content IDs in that manifest are documentation identifiers only: they are not installed help IDs or runtime bindings. Source identity proves neither implementation correctness nor acceptance. No mutable master document hash is used.

## Open and navigate Settings

The mounted desktop App renders Settings for its `settings` view, hiding the usual Sidebar and TopBar. **Back to workspace** returns to the recorded originating view. Agent navigation can initially select Models, Agents, Plan & usage or Integrations; Apps & skills opens Integrations. **Open repository workspaces** routes to the repository workspace. This guide does not establish which entry points a currently installed build exposes.

**Search settings** filters section labels and fixed keywords, not every field or nested panel. A selection clears search. **No matching settings.** means the section filter found nothing; it is not a missing-permission diagnosis. The signed-in workspace identifier and **Service verified** label are presentation, not a current provider-health receipt.

| Category | Exact section names |
| --- | --- |
| Account & preferences | General; Profile; Appearance; Plan & usage |
| Agent & security | Agents; Models; Permissions; Identity |
| Development & connections | Git & PRs; Environments; Worktrees; Integrations |

These twelve sections are mounted conditionally by selection. Read-only notices, labels and locked rows are not editable controls. UI statements about enforcement, least privilege, vaults, credentials or safety are not independent security verification in this guide.

## Preferences and device session

**General** exposes **Axiom account → Open** (`/account`) and **Organization governance → Open governance** (`/control/governance`) as browser handoffs. **Workspace access** is a status row directing readers to Plan & usage, not a grant. **System notifications** saves a local boolean; **Test** calls the desktop notification helper and is disabled when notifications are off. It is not a successful notification-delivery receipt. **Resume observation after restart** is locked copy.

**Governance evidence preview → Inspect saved Governance** and **Execution limits preview → Review execution limits preview** exist only under `import.meta.env.DEV`. The preview component is returned only in DEV when selected. They are prototype inspection/preview mounts, not completed Governance authoring, enforcement, execution or provider access. Their availability in a production install is not established.

**Profile** displays Name, Email, Workspace and Authentication from the passed verified identity. Missing values show **Not provided** or **Not available**; API-key identity can show **Administrator credential**. **Hide email address** changes local display masking, not the account email or credentials. **Log out** opens **Log out?** with **Cancel** and **Log out**. Confirm calls `signOutDesktopCredentials`, then reloads on success. The handler clears the active client session, writes signed-out selection metadata and attempts legacy secret cleanup. A cleanup failure reports an error; externally running workflows are not canceled. No credential values were read for this documentation.

**Appearance** offers **Theme** (Dark, Light, System), **Interface density** (Comfortable, Compact), **Reduce motion**, and **High contrast**. **Agents → Conversation** offers **Submit with ⌘ / Ctrl + Enter** and **Messages sent while an agent is working** (Queue, Interrupt). These save local preferences through `set_preferences`; reads use `get_preferences`. Appearance applies document theme/density/motion/contrast attributes after the native save. This does not verify visual or accessibility acceptance.

Preferences are disabled until loaded. A save reports **Saving on this computer…**, then **Saved on this computer.** after resolution. Concurrent saves are guarded. Failure restores the prior displayed value, marks the result unconfirmed, and directs the reader to reopen Settings before another change; General, Profile, Appearance and Agents then remain disabled. A load failure likewise directs reopening. Local preferences do not grant workspace execution authority.

Agents also shows locked **Confirm consequential actions** and **External-file protection** rows, read-only **Specialized Agent profiles**, **Workspace Agent policy → Open Agent governance**, and **Manage workspace tool permissions**. Both browser actions target `/control/ai-agents`. Profile descriptions/locked copy do not independently prove runtime policy enforcement or background workers.

## Plan & usage: reads, cost and browser billing

The section heading is **Access & usage**. It reads `usageSummary` and refreshes on window focus/context updates or **Refresh plan and usage**. Loading/verifying, unavailable and legacy-service states are distinct: failure does not establish a zero allowance or a current subscription. Identity access labels may remain visible while billing is unverified. A legacy response explicitly directs the reader to the cockpit for current plan/allowance.

The view can show Workspace plan/Desktop access (or legacy Access model/Access state), **AI allowance remaining**, **Applied paid top-ups**, **AI invocations**, **Tokens**, and **Attributed cost**. Attributed cost is labeled VisionXIXLabs cost, not necessarily the amount billed to the customer. Held credits describe unresolved requests; a balance is not permission to execute or bypass approval.

**View billing in cockpit** opens `/control/usage-billing`. **Open billing** requests a server-created portal session and opens an HTTPS Stripe host; opening/failure states are visible. In the current snapshot branch the control requires an available plan, customer record, `canManageBilling`, and owner/admin role. Legacy paid access uses an owner/admin disabled gate; no-plan/no-charge branches differ. This guide performs no checkout, payment, portal creation, plan change or billing verification. A browser return alone is not access acceptance.

## Models: catalog browsing versus policy writes

The section reads `aiProviderStatus` and normalizes provider/policy data. **Add or search model** searches label, ID and provider; **All models** / **Approved models** filter locally. **Previous models** / **Next models** paginate fifty rows while search includes the full catalog. Loading, no available service-configured models, no matching search and unsupported/error states differ; **Retry models** reloads.

Each model has an enable/disable switch; available approved Gateway models can expose **Make default**. **Remove unavailable approvals** appears for concrete Gateway approvals absent from the current catalog. These call `updateAiProviderPolicy` (a server PUT), not a local preference save. The helper supports up to 32 concrete Gateway approvals; other providers retain one active model. Removing the default promotes a remaining approval; removing the last disables Gateway. Unavailable entries are removal-only, and a disabled legacy managed route cannot be newly enabled by its switch.

Saving disables the relevant mutation controls. Missing policy disables switches. A context mismatch clears stale policy and asks for a reload; an administrator-required response is surfaced. This UI contains no model credential entry. Model labels, catalog availability and successful policy persistence are not proof of credentials, usable inference, execution authority or an approved action.

## Permissions: current membership and role writes

The section reads `listWorkspaceMembers`; **Refresh members** reloads current membership and focus/context changes also refresh. Until verified, Your role is **unverified** and member loading is explicit. Errors remove the usable read rather than supplying guessed authority. **Manage in cockpit** requires `members:manage` and accepted/updated own membership, re-reads membership, constructs a short-lived advisory navigation intent, then opens the browser. Browser authentication and selected workspace still need their own checks.

Member role selectors offer Admin, Operator, Security reviewer, Finance viewer and Read only. Owner is a badge. The own member, owner rows and rows without `members:manage` are locked; a saving row is disabled. Selection calls `updateWorkspaceMemberRole` (PATCH), then reloads. Errors ask for refresh before retry. The read-only Authority model describes Read, Write, Execute and Production bypass; those summaries are not independent verification of every server permission or immediate revocation. No invitation, owner transfer, removal or credential management control is mounted here.

## Git & PRs: consequential actions inside Settings

This section embeds four panels; these are not cosmetic preferences.

| Panel and controls | Direct operation and recovery boundary |
| --- | --- |
| **Clone a repository locally**: Repository, Destination folder, **Clone repository** | Requests `mintGithubCloneToken`, then native `clone_repository` into a repo-named child folder. Default destination uses native `default_repos_directory`. Requires a slash-containing repository and destination; disabled while Cloning. Done shows the path; errors are shown. This is a server credential handoff plus local filesystem operation, not provider consent or a registered-repository receipt. |
| **Create a pull request**: Repository, Base branch, New branch name, File path, File content, Commit message, Pull request title, Pull request description, **Create pull request** | Sequential `createGithubBranch`, `commitGithubFile`, `openGithubPullRequest`; required fields and busy state gate submission. Progress distinguishes branch/commit/PR. **View pull request on GitHub** appears after a returned URL. Partial/uncertain failures say which prior step succeeded and which later request was not sent. Inspect the original repository before retry: a last request may already have completed. Context change stops further writes, not an already submitted operation. |
| **Repositories**: Provider (GitHub, GitLab, Azure DevOps, Other), Owner / org, Repo name, **Register repository** | Reads `listRepositories`, posts `registerRepository`, then reloads; missing owner/name or busy disables registration. Existing rows are read-only; registration is not proof of live provider access. |
| **Branch policies (enforced before deploy)**: Repository, Environment, Branch pattern, five requirement checkboxes, **Promote only after a successful deploy in**, **Add policy** | Reads policies/repositories/environments; posts `createBranchPolicy`. Requirements are linked merged PR, passing tests, release tag, CODEOWNERS and CHG/INC/REQ ticket. Production locks PR/tests on and requires a prior environment. Missing selection/pattern/prior production environment or busy disables Add policy. Saved rows summarize configured requirements; this inventory does not validate all enforcement paths. |

Repository/branch-policy comments and visible copy differ in their enforcement descriptions. This guide records mounted controls and direct calls without resolving that discrepancy into a security guarantee. Do not treat an empty list, failed load or successful configuration write as tested provider operation.

## Environments: records, target configuration and workflow dispatch

The section reads configured environments. **Create dev/test/prod** (or the missing-standard-environments action) sequentially posts missing Development/Testing/Production rows. A partial failure can leave earlier rows created. **New environment** has Slug, Display name, Tier (`dev`, `test`, `qa`, `uat`, `stage`, `preprod`, `prod`) and **Create environment**; blank slug/name and busy disable it. Errors and temporary Created feedback are visible. A record is not proof of an attached working deployment target.

Each environment's **AWS deploy** / **Hide** expands a target panel. It reads target, executions and repositories. Role ARN, Region, ECS cluster and ECS service feed **Save deploy target** (server write); all four fields are required, and save invalidates readiness. This is configuration, not a cloud permission grant.

Workflow controls include GitHub repository, **Workflow source branch or tag**, source kind Branch/Tag, **PR number**, **Check readiness**, and **Dispatch workflow**. Non-development targets expose **Prior workflow receipt (not verified artifact promotion)**. Production with `deploy:production_bypass` can expose **Emergency production bypass** and a reason requiring at least 20 characters. Changing source/PR/prior receipt/bypass input clears readiness. Readiness is a preflight POST, not dispatch; dispatch is a separate POST with an operation idempotency key. It requires returned readiness and valid basic fields, with busy/error feedback. These local gates do not establish that current server policy will permit dispatch.

The bundled AWS ECS workflow requests a service restart; it does not release a new source artifact. Custom installed workflow behavior is unverified. The UI explicitly says a successful workflow is not source-artifact promotion evidence and promotion remains blocked pending artifact identity/provenance. Do not infer a completed release from policy/readiness labels.

Returned execution data can expose **Refresh status**, **View evidence ↗** and a verified-pull-request browser link. Refresh observes a recorded execution and does not dispatch/retry. Eligible executions poll every five seconds; observation errors retain the recorded outcome. An unknown deployment outcome warns the provider may have accepted it and the hold is retained; in-progress state blocks another dispatch. Dispatched-without-saved-tracking asks for GitHub Actions inspection. Review external outcome before retrying. No dispatch, cloud setup, billing cost or receipt was exercised here.

## Identity: pending metadata and SCIM preview

Identity is explicitly **design-only** in this source: no sign-in path reads this configuration yet. It lists providers with protocol, issuer, status, domains, MFA flag and revoked state. **Revoke** posts a revocation for an unrevoked provider and reloads; it is disabled while revoking.

**Connect an identity provider** has Protocol (OIDC/SAML), Issuer URL / entity ID, Metadata document, Managed domains, Claim key/value, Maps to role and Require MFA claim at sign-in (once live). **Save (pending)** posts configuration, requires issuer/metadata/domains/claim value and disables while busy; successful feedback remains pending. No live SSO, MFA enforcement or access grant is established.

**SCIM lifecycle preview (stage only — nothing executes)** accepts Directory employees (JSON) and Current grants (JSON). **Compute plan** parses JSON and posts `previewScimLifecycle`, displaying joiner/mover/leaver counts and staged actions. Invalid JSON or service errors appear; busy disables computation. It does not execute a lifecycle plan. Backend errors in these forms are displayed where handled; no general guaranteed recovery or automatic rollback is claimed.

## Worktrees

The main section shows read-only limits **Maximum checkouts per repository: 25** and **Combined file bytes per repository: 50 GB** and **Open repository workspaces** when the callback exists. There is no Settings worktree-create/remove/cleanup/limit editor. The notice directs readers to a repository's Workspaces; its refusal/preservation claims are not independently tested here. Nested repository worktree behavior is outside this guide.

## Integrations: mounting, consent, validation and unknown states

**Integration Center** mounts GitHub, Slack, Microsoft Teams, Outlook, Linear and an **AWS, Azure & Google Cloud** summary. It also embeds AWS/Azure/GCP guided cards and **Advanced cloud account connections** containing AWS/Azure read-only enrollment. **Connection diagnostics** expands a service health summary. **Manage connections** opens `/account/integrations`; **Refresh verified status** reloads status and diagnostics. Initial mount, window focus and context changes also load them. Status/health requests have a fifteen-second deadline; missing/failed data is not a disconnected/healthy receipt.

GitHub consent-recorded and overdue states expose **Finish connection** / **Revalidate now** for read-only validation. Slack/Teams/Linear awaiting-validation or needs-attention states expose **Finish connection**. Returned active/validated-read-only states expose browser **Manage**. Otherwise **Connect ↗** requests a consent URL then checks HTTPS/provider host before opening it; this does not itself complete consent. A false provider configuration disables Connect with **Service connection unavailable**. Missing status disables the action with Checking/Status unavailable. Validation/connect busy states disable their controls. A stale workspace/context cannot own the action result.

Slack/Teams unconfirmed validation records a recovery hold: **Reload status** and **Review consent** replace further validation. Reload is not an automatic resend or proof of resolution. Teams identity validation does not establish Teams message permission; Linear identity validation does not prove an issue was created. Cloud summary separates connected from read-only-connected, unavailable and not connected. Diagnostic healthy/degraded/preview counts are service-returned presentation, not a currently tested connection, operational release observation or complete monitoring setup.

Use the existing [Outlook controls](outlook-controls.md), [Slack reviewed action controls](slack-reviewed-action-controls.md), and [Teams and Linear controls](teams-linear-controls.md) for nested consent, exact action, approval and recovery details. Outlook's card is embedded here; it is not a separate Settings implementation. [ServiceNow evidence and closure controls](servicenow-evidence-and-closure-controls.md) describe that separate workflow; ServiceNow has no main Settings section/connection row in this source. These linked drafts retain their own source baselines and acceptance limits; this guide does not revalidate or supersede them.

## Finite scope and current readiness

Covered: App mount/return navigation, the twelve main sections, visible local/server/browser operations and directly embedded panel boundaries in SettingsView. Explicitly omitted: transitive backend authorization audits; provider/OAuth callbacks; cloud guided/enrollment subform internals; Outlook action internals already linked; repository Workspaces internals; Governance preview internals; full billing/payment workflows; all native implementations; credentials/storage contents; live deployment evidence; broader product surfaces. Embedded cloud/deployment/notification helper behavior is named only at the source call boundary. No claim covers all backend paths or all Settings-adjacent flows.

For loading/unavailable/read-only states, use the displayed refresh/reopen/browser review path and verify the correct workspace. For uncertain writes, inspect current saved/provider state before deliberately retrying; a timeout is not proof of no side effect. Some forms expose error feedback without a dedicated retry/reconciliation button. Do not substitute a disabled control, status label, source comment or prototype flag for current authority or an operation receipt.

**Frozen READY means ready for internal source-document review only.** No runtime edits, build, tests, browser, network/provider/DB/native operation, security scan, media capture, editorial approval, customer retrieval, release acceptance or publication occurred. Runtime readiness and installed behavior remain unverified; B4 and broader acceptance remain open.
