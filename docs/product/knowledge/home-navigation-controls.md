# Home and mounted workspace navigation

Internal source guide. Customer visibility: false. Snapshot: `58f2ddd4cb93f5f54a9642dbe08615b65371a2ee`, 2026-11-03. Proposed content IDs are documentation identifiers only, not runtime bindings. This finite source inventory is not runtime, media, editorial, release, accessibility or security acceptance.

## Entry and prerequisites (`home.entry`)

App shows the authenticated workspace only after credential verification supplies an identity with allowed access. Before that, it renders sign-in, access-required or loading surfaces. This guide does not document their controls or establish a currently valid session. After the workspace's local loading interval, Home is initially visible, with Agent as the stored initial destination and split mode off. The visible heading is “What are we working on?”. Home has no prompt field, submit action, account editor or task creation control.

## Four Home choices (`home.choices`)

Choose a button to open its destination:

| Home control | Destination | Purpose shown on Home |
| --- | --- | --- |
| Build with AI | Agent (`agent`) | Research, develop and work with code |
| Delegate a task | Axiom Bot (`axiom-bot`) | Saved tasks and AI responses; app changes require exact review |
| Deploy and Manage | Releases (`deployment-requests`) | Scope a release, review actions and follow delivery evidence |
| Automate Operations | Batches (`airflow-automation`) | Monitor batches and prepare operations; copy says an Airflow connection is required |

Each callback only selects a destination through App's navigation handler. Choosing one does not itself submit an AI request, create a task, execute a release or trigger an Airflow run. Navigation may mount destination components with their own reads and lifecycle effects; this guide does not claim that opening a section performs no network activity. Home has no disabled, busy, empty-result or error variant for these buttons. An Airflow connection is a destination workflow prerequisite, not a Home-button disabling condition. If the wrong destination opens, choose another sidebar item or Axiom home. Review the destination's own state and prerequisites before taking any subsequent action.

## Sidebar and destinations (`home.sidebar`)

The mounted shell passes `compact=false`: a full sidebar appears except while Settings is active. The logo/name button has accessible name **Axiom home**; activate it to show Home. It clears the special Bot-to-Apps return context, without changing the stored active destination. Home gets the current-page indication while displayed.

The **Workspace** group contains Agent, Axiom Bot and Releases. **Resources** contains Repositories, Batches and Apps & skills. The separate utilities region contains Documentation and Settings. Click a destination to hide Home and select that view; the active item receives a current-page indication. Group heading buttons collapse or expand their item lists, with expanded state and a controlled panel reference. Both non-utility groups initially expand because neither has a default-collapsed flag. Collapsing a group changes the visible menu, not the selected view. Reopen its heading to recover a hidden item. No sidebar search field is mounted.

The sidebar's **Workspace connected** footer is a static status label in this source. It is not a clickable reconnect control or evidence of a fresh provider-health check. Version text is display information. The reusable Sidebar has compact rendering logic, but App mounts the full version and exposes no compact-sidebar toggle here.

## Commands and search (`home.commands`)

Choose **Commands** in the top bar or press Command/Ctrl+Shift+P to toggle the command dialog. The shortcut ignores Alt-modified and composing events. It remains registered in the mounted workspace even when Settings hides the sidebar and top bar. Opening clears the previous query and selection and focuses the search input. Type a label or keyword; filtering is case-insensitive substring matching after trimming the query. An empty query lists all eight commands: Open Agent, Open Repositories, Open Releases, Open Batches, Open Apps & skills, Open documentation, Open Axiom Bot and Open settings. Home is reached through the sidebar logo, not a command result.

Use Up/Down to cycle results and Enter from the search field to open the selected destination, or click a result. Choosing a result navigates and closes the dialog. No result runs a destination operation. “No matching commands.” is the empty state; clear or change the query. Enter with no result performs no navigation. Close with Escape, the Esc button, outside-backdrop mouse-down or the shortcut. Tab/Shift+Tab wrap between the search field and close button; result buttons are outside the Tab order. Closing restores the previously focused element if it still exists. These are source-defined keyboard behaviors, not a claim of tested assistive-technology compatibility. No asynchronous search, provider search, error state or disabled-result state is implemented here.

## Top bar, workspace access and panes (`home.header`)

The top bar shows destination title and descriptive text; Home shows Axiom / Build, operate and deliver. The **Access active** or **Access needs attention** summary is a disclosure derived from `identity.access.allowed`. Open it to inspect Current workspace (organization ID), Paired desktop session or API key session, and the corresponding access description. It has no sign-in, sign-out, workspace switch, refresh-access or account-edit button. Authentication and configuration belong to other surfaces. Its text reflects supplied identity data, not an independent live health probe.

Escape closes an open disclosure and focuses its summary. Clicking outside or moving focus outside closes it. Changing destination, workspace, Home visibility or split visibility also closes it. The shared disclosure helper closes the menu without submitting or discarding child form state; this particular panel contains informational text only.

**Editor & Agent** appears only when Home is hidden and Agent or Repositories is selected. Activate it to show both engineering panes and the Engineering workspace title. The button becomes **Single pane** with pressed state; activate again to return to the selected destination's single pane. The toggle marks Repositories visited so its component can mount. Selecting Agent or Repositories through ordinary navigation resets split mode off. Returning Home hides the panes; visiting another non-engineering destination makes split mode invisible, without itself clearing the stored split flag. There is no split toggle on Home or in other destinations. Layout selection is not an execution control or a save action.

## Context, session and draft limits (`home.retention`)

Within the same authenticated workspace component lifetime, Agent and Repositories mount after either is visited and remain mounted in hidden containers when navigating away. Axiom Bot likewise stays mounted after its first visit. Their `active` props track whether the applicable view/pane is visible. This shell structure supports retaining component state across navigation; it does not establish that every child draft is saved, durable, synced or recoverable after failure, reload, sign-out, identity changes or process exit. Those persistence rules require the destination's own guide and source.

Other destinations are selected inside a boundary keyed by active view and are not kept mounted across destination changes. Home can hide the current non-engineering destination without switching its active-view key. Ordinary navigation clears the special Bot/Apps return context and Settings destination hint. The special Bot-to-Apps return association additionally checks desktop configuration object, context revision and serialized identity; it is invalidated when those differ. These checks do not prove all child state is reset on identity changes. Shell handoffs to Agent carry current configuration and organization context with their request, but receiving behavior and draft/session guarantees are outside this guide.

Settings hides this sidebar and top bar. App wires its close callback to the remembered previous destination (initial fallback Agent); command navigation can also leave Settings. This inventory does not expand Settings or account controls.

## Errors and safe recovery (`home.recovery`)

Destination render errors within WorkspaceViewBoundary show **This view could not be displayed**, **Retry** and **Return to Agent**. Retry clears the boundary failure and increments a key, remounting its children; Return to Agent also resets that boundary and navigates to Agent. Remounting may lose unsaved local child state. The notice says the session is still active, but the boundary does not reverify credentials or establish provider outcomes. These buttons recover rendering, not a failed external operation. Review any uncertain action in its destination before retrying it. The boundary does not wrap Home, Sidebar, TopBar or the command dialog and does not promise to catch asynchronous request errors there.

No runtime checks, tests, build, browser, provider, database, native-helper or security-scanner work was performed for this guide. Source bindings freeze exact whole-file and inclusive-range bytes for independent review. No mutable master hash, runtime registration, media asset or customer/release approval is created.
