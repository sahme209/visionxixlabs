# Native Documentation screen

**Internal source draft, customer eligible: false.** Source baseline42ad141a, November3,2026. Proposed content ID `desktop.documentation` is authoring metadata, not a mounted help/retrieval binding. Runtime/native/browser/accessibility, media/editorial, release and customer acceptance remain false. [Source bindings](../../recovery/2026-11-03/native-documentation-guide/source-bindings.json) identify the finite source inspected.

## Entry and prerequisites

Choose **Documentation** in the sidebar utility group or **Open documentation** in Commands. App mounts DocsView for its `docs` view inside the authenticated workspace. Parent identity/access checks do not establish current provider health or completion of the linked guides. This screen has no separate consent, provider connection or role editor.

The heading is Documentation. The introduction now says to check the installed version and stated availability before following a web guide. Its earlier wording called the documentation complete/authoritative; the local copy correction removes that unsupported completeness/version inference. At the42ad source checkpoint this copy change had not yet been rebuilt or accepted in the native app. The current-build supplement below distinguishes later compilation from still-pending native Documentation acceptance. No destination behavior or current website content was inspected here.

## Five in-app journey controls

Under **From code to governed deployment**, activate a normal button by pointer or keyboard. Each handler selects an App destination only. It does not send an AI prompt, create a release, execute a check, approve, schedule or dispatch work. Destination mounting may have its own reads/effects; navigation is not a promise of zero network activity. The availability paragraph explicitly says actions depend on installed version, workspace policy, connected credentials and validated adapters, and a guide is not end-to-end acceptance.

| Stage | Actual button | Destination and boundary |
| --- | --- | --- |
| Scope the repository | Open repository | Repositories; context does not authorize a cloud change |
| Prepare and verify code | Open Agent | Agent; a proposal is not applied code or proof a check passed |
| Review deployment authority | Open deployment requests | Releases; obtain exact required human decisions separately |
| Schedule with Airflow | Open Airflow | Batches; schedule is not approval or success |
| Validate and recover | Review deployment evidence | Releases; a recovery plan is not proof rollback ran |

No stage is disabled by a readiness check in this screen. There is no step completion indicator, timer, previous/next control or saved journey progress. The ordered cards explain the workflow, not a live run. Use ordinary shell navigation to return; destination operations have their own state and recovery.

## Seven web-guide links

Each entire card is an ExternalLink with a fixed HTTPS URL and an external-arrow marker. Enter on a focused link or a pointer click invokes the external-opening helper. These are documentation handoffs, not downloads, account mutations or execution commands.

| Group | Card title | Exact destination |
| --- | --- | --- |
| Getting started | Product documentation | https://visionxixlabs.com/docs |
| Getting started | Getting started | https://visionxixlabs.com/docs/getting-started |
| Getting started | Permissions model | https://visionxixlabs.com/docs/permissions-model |
| Deployment operations | Approval workflow | https://visionxixlabs.com/docs/approval-workflow |
| Deployment operations | Glossary | https://visionxixlabs.com/docs/glossary |
| Troubleshooting | Troubleshooting | https://visionxixlabs.com/docs/troubleshooting |
| Troubleshooting | Surfaces | https://visionxixlabs.com/docs/surfaces |

Inside Tauri, the helper attempts the shell plugin to open the OS default browser. If that throws, or outside Tauri, it falls back to window.open with a new target and noopener/noreferrer. The anchor also declares a blank target and noreferrer. Host/browser behavior determines whether a window or tab actually opens. The screen has no loading/result acknowledgement, link-health validation, popup-blocked message, dedicated retry or failure reconciliation. A click or open return is not evidence the remote guide loaded or matches this installed version. If the browser does not open, inspect the displayed fixed destination and use it deliberately; do not treat failure to open docs as permission to repeat an operational action.

## What is not a control

Titles, descriptions and availability text are explanatory. There is no embedded Markdown reader, search field, account menu, support chat, AI retrieval, recording/image viewer, transcript, download-recording or provider action on this page. Shell menus are separately described in [Home/navigation](home-navigation-controls.md). The view shell scrolls its content; no actual narrow-screen, keyboard/zoom or screen-reader acceptance was performed.

## Remaining qualification

This guide covers the actual DocsView, shared journey constants, parent mount and external-link call boundary only. Linked website articles, OS browser/shell implementation, auth/access flows, provider outcomes, current shipped-version/flag behavior and all destination workflows remain separately scoped. No external destination was visited, and no browser/native/Security/helper/provider/DB action, test or build ran for this unit. No genuine editorial/publication decision or customer support eligibility is created. B4/B3/B6 remain open.

## November4 current source and compiled-build supplement

The current983 preview was built from source5f208e0a. A fresh [six-file/seven-range source record](native-documentation-controls.sources.json) binds this guide to the current app-routing and direct handoff code. The original42ad receipt remains unchanged as historical evidence. Of those six whole files, only App differs from that historical manifest; current navigation and DocsView mounting were inspected at their new ranges. These selected ranges do not requalify all authentication or destination behavior.

The hash-verified compiled frontend contains the version/availability warning and all seven fixed web-guide URLs. Their presence proves a compiled source scope, not successful links or current web content. The five journey controls still navigate only; destination effects and execution requirements remain separate.

The attempted actual native visit stopped at the Mac lock before navigation. Native Documentation rendering/keyboard, browser destinations, media/editorial/customer and retrieval acceptance remain false. No unlock, external browser, web request, form or action was performed. Prior native Home/Releases checks do not substitute for this screen. [Observation and limits](../../recovery/2026-11-04/native-documentation-walkthrough/README.md).

## November4 resumed native observation

After manual unlock, the current983 native screen showed both version/availability notices, all five journey button labels and all seven external guide labels. The single tested internal button, **Open deployment requests**, opened Releases; Apps & skills was then restored. No external link, provider verification, form, skill, approval or execution control was used. [Exact resumed scope](../../recovery/2026-11-04/native-documentation-walkthrough/resume-observation.json).

The earlier lock report is historical. This bounded pointer/content observation leaves Documentation keyboard/AT, other destinations, external web content, full visual/media/customer/editorial/retrieval and end-to-end acceptance open. No screenshot was captured in this check.
