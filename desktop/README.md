# V19 desktop

The V19 desktop runtime is the **customer deployment-operations
workstation**. It captures governed deployment requests, receives signed
execution-plan handoffs from shared services, lets the user review local
artifacts under their custody, and initiates authorized provider operations
without making the public website a customer application.

The desktop app is not a way around governance. Approvals, policy decisions,
audit, idempotency, reconciliation, and rollback requirements are authoritative
in shared services and enforced again at the desktop action boundary. A system
browser may be used for secure authorization, but customers do not operate the
product through a hosted dashboard.

## Expand and collapse the workspace navigation

Use the **Workspace** and **Resources** group buttons to show or hide their
navigation entries. Each caret reflects whether its group is expanded and
uses the same neutral contrast as the group label in either theme.

## Open review for the selected release

In **Deployments → Overview**, choose **View release review** on a current
submitted release that requires pull-request review. Focus moves to the
selected release version’s **Merge review** and its saved operation plans.
Direct links to a review or evidence section focus that section after verification.
Opening the panel makes no provider request. The review controls still check
current permissions and evidence when used. The separate Agent Approval
Center is linked under **Recorded release details**.

## Review a recorded GitHub workflow attempt

In **Deployments**, select the saved release. Open **Evidence**, choose the
reviewed plan, and select **Read recorded workflow commit**. If V19 can verify
one recorded workflow attempt for that release version and plan, **Logs** offers a link to open the attempt in GitHub. Several attempts can report the
same commit. The link requires a single observed attempt. Access depends on
your GitHub permissions. Live logs and application health remain unavailable
in Studio. On wide windows the inspector scrolls on its own,
keeping the release list and section controls in view. On compact windows,
the release title and section controls stay visible while you scroll the details.

## Check saved Airflow dependencies

In **Batches → Release dependencies**, select a submitted release version
to see its saved workflow and run IDs as **Unverified**. Choose **Check
batches** to read current Airflow status. Provider timing and task inspection require an
observed run. In **Inspect tasks**, timestamps use UTC when the provider
supplies them. Previous, Refresh and Retry use the offsets for the pages you
actually visited. At narrow widths the run status column keeps space for its
labels while workflow IDs and timing still wrap. The progress strip separates the
saved request, the latest run check, and recorded approval prerequisites.
Production wave evidence remains unavailable in these records.

For a submitted dependency that requires pull-request review, choose
**Review approvals** to open the exact release version’s Merge review in
Deployments. Opening it sends no provider request. **Return to Batches**
keeps the search and restores focus to the originating control when that
version is still available. **Open release** opens the general Overview.

## Draft remediation for an open incident

In **Tickets**, search incidents by their recorded reference, application,
or environment. Studio shows application and environment names when the
linked release and saved catalogue entries resolve in the current workspace.
Select an open or mitigated deployment incident with a current
linked release. **Prepare remediation plan** verifies the linked release and
loads a draft in Agent with the incident ID, state and its recorded ReleaseOps
release, tag, and commit when available. The Overview evidence row opens the
selected ticket’s Evidence tab. **Review linked release evidence**
shows the same recorded facts and links to the browser release record. When
a saved evidence pack matches the release and commit, Studio also displays
its generated time, stored counts and saved readiness evaluation. Historical
packs may show an unverified evaluation time. In **Linked items**, choose
**View linked release** to inspect its recorded rollback reference. Studio
shows the prior release and commit when it can verify the same workspace,
application, and environment. The browser link opens that saved record. Use **Activity → View transition
history** to read saved mitigation, reopening, and closure events alongside
the incident's current timestamps. The history shows up to 20 saved events.
In **Investigation → View saved triage**, read the latest saved recommendation
and its recorded operator decision. Suggested priority and team are shown
alongside any operator priority override.
The draft requires an explicit send. Any existing Agent draft stays
in the composer. **Return to Tickets** restores the search and originating
action if the incident and link still match.

## Narrow the Tickets list

**Filters** lets you apply the recorded status, application, and environment
from loaded tickets. These filters work alongside search, priority, and
owner. **Reset filters** clears the filter panel's draft selections. Choose
**Apply filters** to update the list and the visible CSV export.

## Read the incident response target

**Tickets → Overview** shows the target saved by triage for the linked
incident. It identifies suggestions, accepted priorities, and reviewed
overrides. An override uses the original triage time with the new priority's
response window. For an open incident, Studio shows the remaining time and
the exact deadline. Incidents without a matching saved triage target show
that it is unavailable. The target comes from triage guidance.

## Assign an incident owner

In **Tickets → Overview**, use **Assign owner** or **Change owner** to select
an eligible accepted workspace owner, admin, or operator. Save explicitly.
In an incident’s Overview, the recorded release and its on-demand review sit
under the ticket title. The facts row groups application, environment, owner
and response target when present. The recorded report time appears in the
timeline. Refresh and Open Deployments have named toolbar buttons with tooltips.

The **Owner** filter uses the loaded assignments. **My work** shows the open
and mitigated incidents assigned to your account. A removed or ineligible
member is shown as an unavailable recorded owner until someone reassigns the
incident. Assignment has its own revision and leaves incident status and
existing evidence alone.

## Review repository evidence

In **Tickets → Evidence**, review the linked release. With paired GitHub read
access, Studio offers links to synced workflow runs for the release commit and
a GitHub comparison against its recorded rollback reference when both releases
share the repository, application, and environment. GitHub separately checks
browser access. The workflow list describes saved observations. Service
recovery validation requires its own evidence.

After collecting logs from a completed run and reviewing the comparison,
choose that run and confirm **Record evidence collection**. An authorized
paired operator's record is tied to the incident revision, run observation,
and compared commits. The incident checklist identifies it as an operator
record. Raw logs and the contents of the compare page stay with GitHub.

## Inspect a recorded repository workflow

In Repositories, choose **Inspect** for the selected registry row. The
inspector displays the full recorded workflow commit when available. At
compact widths, Inspect stays visible while you scroll the table horizontally.
Closing the inspector returns keyboard focus to that row.

## Recover a Saved Tasks version conflict

Use **Review saved version** to compare recorded history with your current
edits. **Open latest saved draft** asks before replacing unsent text. Choose
**Keep editing** or press Escape to retain the draft and return focus to the
control that opened the prompt.

## Copy a Documentation section link

Choose a section under **On this page**, then use **Copy guide link**. The
reader toolbar stays visible as you read. The version next to the guide title
identifies the desktop build that includes this guide.
If the clipboard is unavailable, Tab to **Guide link** to select the exact
section URL for manual copying.

## Copy the current workspace ID

In **Settings → General**, use **Copy workspace ID** beside the verified
identifier. If clipboard access is unavailable, Tab to the read-only field
to select the full identifier for manual copying.

## View the audit log

Settings → **View audit log** opens the website’s **Audit & Security** page for
the workspace selected in the browser. A current workspace owner or administrator
can review organization audit evidence. If the browser cannot open, retry from
Settings.

## Review a saved plan in Agent

In Deployments, use **Review saved plans in Agent** for the selected release
version. At wide window sizes, the plan and its recorded review scroll
independently. **Open exact release** returns to that version in Deployments.
Use the evidence rail to inspect history for the selected plan. When space is limited, scroll the conversation pane to reach the saved
transcript and composer. The transcript itself can receive keyboard focus for scrolling.

## Change incident status

Use the **Incident status actions** button on a current incident to choose and
confirm an available status change. A paired workspace owner, admin, or
operator can record the choice. If the response is interrupted, retry the same
request. If the record changed, review the refreshed ticket before choosing an
action. Status changes appear in Activity and leave release execution and
provider tickets separate.

## Review an incident resolution

The **Resolution checklist** in Tickets Overview reports saved facts for the
selected incident. The first step uses the recorded environment on its linked
release. Closure and evidence are recorded together in the checklist when the
incident is closed and an evidence snapshot appears in its updates. A closure
without a fix is labeled separately. Log and diff collection, remediation
review, and service recovery remain unconfirmed until their own evidence is
available. Choose **Review remediation plan** to inspect the latest saved proposal.
A decision is marked recorded when its stored incident revision and release
scope still match. Older proposals can appear as history. The checklist is
read-only. Use the existing incident and release workflows for changes.

## Add an investigation update

Open an incident in **Tickets** and choose **Add update** after entering a
note. Studio saves it against the selected incident and its recorded release.
If the response is interrupted, retry the same update. Ticket readers can
review the 20 most recent saved updates.

Use **Review release evidence** beside the note when the linked release has
verified evidence. Check the commit and digest, then choose **Attach reviewed
evidence**. A saved update retains those details and the recorded counts even
if the pack is later regenerated. If the pack changes before the update saves,
Studio keeps your note and lets you review the refreshed evidence.

## Start a release draft from a change ticket

Select a recorded Jira or ServiceNow change in **Tickets**, then choose
**Start release draft**. Enter the application and requested work. Studio
verifies and records the source ticket when you save. **Open saved release
draft** opens the exact saved version in Deployments for completion and review.

## Report a deployment incident

Select **New ticket** with a workspace role that can report incidents.
Choose a recent release or enter its recorded Release ID, then submit the
incident. After V19 confirms the report, Tickets opens the saved case.
If the response is interrupted, retry the same report from the open draft.

## Export the visible ticket list

Choose **Export** in Tickets and select a new local CSV file in the native
save dialog. The export uses the visible rows and current filters. It includes
the displayed case fields without summaries, evidence, or provider URLs.
Canceling the dialog leaves the filesystem unchanged.

## Review a change ticket’s linked release records

In **Tickets → Changes → Evidence**, choose **View linked releases** to
verify the saved associations. Each returned release opens its web companion.
If the associations change during the read, refresh the links to verify the
current records. Evidence attachments remain separate.

## Review observed batch timing

In **Deployments**, use **Inspect release dependencies** on a submitted
release with declared runs to open that saved version in Batches. If the
version advances, reselect deliberately from the current dependency list.
**Open release** returns to the same version for review. In **Batches →
Release dependencies**, choose **Check batches** to observe runs. Each observed Airflow run can show its recorded start and
end in UTC. Missing timing stays unavailable. Choose **Inspect tasks** below
its run row to review task state for that exact release dependency. The task
section names both the workflow and run, since workflows can share a run ID.
Use **Next task page** and **Previous task page** to browse results. Keyboard
focus returns to the task control when the page changes. **Retry tasks**
requests the same page after a read failure. The **Batches** workflow map in
**Documentation** also shows where task inspection fits into release review.
These observations do not approve or start a release.

## Refresh unavailable connection status

At compact widths, the Apps & Skills table keeps **Inspect** in view as the
table scrolls horizontally. The inspector keeps its close control available
when reviewing a long skill or provider record. Escape returns focus to the
original control without resetting the table position.

In **Apps & Skills → Inspect GitHub**, a recorded installation shows
**GitHub App** as its authentication method. Workspace administrators can
choose **Verify read access**. The drawer shows the outcome and refreshes
the recorded check time when verified. This checks repository read access
for the existing installation.

If a provider shows **Status unavailable** in **Apps & Skills**, use
**Refresh capabilities** to recheck its saved connection. In **Settings →
Integrations**, use **Refresh verified status**. Consent remains unavailable
until the saved status can be checked. The Apache Airflow row and inspector
show the recorded validation time for an active connection, when available.

## Review Outlook mailbox context

Open **Apps & Skills → Outlook**. **Read mailbox context** appears when the
current user has a connected mailbox. A workspace switch clears the inbox and
calendar display. If the Outlook connection changes, use **Refresh status**
before reading again.

## Restart verification after switching services

If the configured V19 service changes during sign-in or recovery, start
sign-in again against the current service. V19 only accepts a credential
verification for the configuration that requested it.

## Sign out during credential recovery

Sign-out locks the current workspace immediately. If the credential vault
is finishing an earlier save, wait for sign-out to finish before closing
V19. If secure-storage cleanup fails, use **Retry saved credential cleanup**.

## Stack decision: Tauri (locked)

| Concern                           | Tauri                                 | Electron                          |
| --------------------------------- | ------------------------------------- | --------------------------------- |
| Bundle size                       | 5–15 MB (uses OS webview)             | 80–150 MB (bundles Chromium)      |
| Memory footprint                  | ~80–150 MB                            | ~250–400 MB                       |
| Security posture                  | Capability-based, Rust core           | Node + remote module surface area |
| Native OS integration             | Keychain / keyring / notifications    | Possible via add-ons              |
| Code signing / notarization story | First-class CLI (`tauri signer`)      | Mature but more moving parts      |
| Auto-update                       | Built-in `tauri-plugin-updater`       | Squirrel / electron-updater       |
| Enterprise workstation fit        | Better — smaller attack surface       | Heavier, more dependencies        |

**Decision:** Tauri 2 with React 19 + Vite for the frontend, Rust for the
backend (`src-tauri`). Confirmed by:

- The existing scaffold at `desktop/src-tauri` (Cargo + tauri.conf.json
  already present) — the choice has been the working assumption for
  several phases already.
- Smaller binaries materially improve the enterprise download story (one
  of the trust signals we measure in the Security Center).
- The Rust core gives us a path to local Terraform CLI execution that
  Node-based Electron would have to shell out for anyway.

Electron is **not** an option going forward. If a feature genuinely
needs it (e.g. a vendor SDK that only ships Node bindings), that's a
single-PR conversation — not a stack switch.

## Folder layout

```
desktop/
├── src/                  # React 19 + Vite frontend
│   ├── App.tsx           # Shell + view switcher
│   ├── components/       # Sidebar, status panels, etc.
│   ├── views/            # Dashboard / Connectors / Scans / Settings / Handoffs
│   └── styles.css        # Tailwind + V19 tokens
├── src-tauri/            # Rust backend
│   ├── src/              # Tauri command handlers
│   ├── Cargo.toml
│   ├── tauri.conf.json   # Window, security, identifier
│   └── icons/
├── package.json
├── tsconfig.json
└── vite.config.ts
```

The shared TypeScript domain layer (`/lib/domain`, `/lib/desktop`,
`/lib/errors`, `/lib/security/redaction`) lives in the parent Next.js
project. The desktop imports those types directly — there is no
duplicated taxonomy.

## Packaging roadmap

### macOS

- Target: `.dmg` (universal binary — arm64 + x86_64)
- Signing: Apple Developer ID Application certificate (planned)
- Notarization: `notarytool` in CI (planned)
- Secret storage: macOS Keychain via `keyring` crate (planned)

### Windows

- Target: `.msi` (preferred) + `.exe` (NSIS fallback)
- Signing: EV Code Signing certificate (planned)
- Secret storage: Windows Credential Manager via `keyring` crate (planned)

### Linux

- Target: AppImage (primary) + `.deb` (Ubuntu/Debian) + `.rpm` (Fedora)
- Signing: GPG-signed AppImage + repo signing for `.deb`/`.rpm` (planned)
- Secret storage: Secret Service API (libsecret / GNOME Keyring) (planned)

### Cross-platform

- Auto-update: `tauri-plugin-updater` (built-in). Update manifest signed;
  client refuses unsigned updates.
- Release channels: `stable` (default), `beta`, `preview`.
- Crash reporting: TBD — *not* shipping a third-party telemetry SDK
  until the data-flow is privacy-reviewed.
- Local log redaction: every log line passes through
  `lib/security/redaction` before write.
- Enterprise deployment: macOS PKG installer + Windows MSI Group Policy
  template (planned, post-1.0).

## Honest current state

| Capability                       | Status     |
| -------------------------------- | ---------- |
| Tauri shell + React frontend     | Live       |
| Governed deployment intake UI/API | Implemented; packaged/live DB verification pending |
| Durable consequential-operation ledger | Implemented; migration/provider wiring verification pending |
| Sidebar nav + Dashboard view     | Live       |
| Connectors/Scans/Settings stubs  | Live       |
| Handoff inbox UI                 | Preview    |
| Local Terraform review           | Preview    |
| Local CLI preview                | Preview    |
| Local execution (apply)          | **Blocked by design** until approval architecture lands |
| Audit sync to web                | Preview    |
| OS keychain integration          | Planned    |
| Code signing / notarization      | Planned    |
| Auto-update channel              | Planned    |
| Crash reporting                  | Planned    |

The download page reflects this state honestly — there are no fake
download buttons for binaries that don't exist yet.

## Security guarantees

1. No local execution bypasses web approval.
2. No local execution bypasses governance policy.
3. No secrets in desktop logs (canonical redaction runs on every log line).
4. Handoff payloads are redacted before display.
5. No unsigned production claims until signing is implemented.
6. Offline execution is disabled by default; enable per-tenant via policy.
7. Local Terraform `apply` is blocked until the approval architecture
   ships.
8. Every desktop action is captured in the local audit log and synced to
   the web audit store.

## Development

```bash
cd desktop
npm install
npm run tauri dev
```

`npm run tauri build` produces an unsigned binary for the host platform.
Signed-release builds are produced by CI only.

### Azure read-only source candidate

Settings → Integrations includes an Azure candidate for a browser-paired accepted owner/admin to submit an **existing** service principal. Explicit tenant/subscription/client UUIDs and secret go only to the backend's canonical, tenant-bound encrypted account vault. The password field clears on submission and workspace change; desktop settings do not persist it. API keys cannot enroll. Current workspace readers may request a separate first resource-group page (at most 100, always incomplete); unavailable/denied responses do not become empty successful inventory. Generic Agent scans and all Azure mutations remain disabled.

Disconnect zeroizes the stored credential and advances its version without calling Azure or requiring paid access. It does not revoke the Azure principal, grants or issued tokens. Reconnect validates fresh credentials against the current version. Source and owned-fixture checks do not establish real Azure IAM, production deployment or native release acceptance.
