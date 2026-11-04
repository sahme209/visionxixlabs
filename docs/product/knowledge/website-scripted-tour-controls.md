# Website scripted tour controls

INTERNAL DRAFT — source-only, unpublished, customer eligible: false. Editorial, authentic media, browser/assistive-technology, native, release and shipped-version acceptance: false. Owner: B4 documentation workstream; no editorial approver assigned. Last source inspection: 2026-11-03, repository HEAD `bd802078c58e59058209c3296470c1c827383ee7`. Whole-file hashes and inclusive source anchors are in [source bindings](../../recovery/2026-11-03/website-scripted-tour-guide/source-bindings.json).

## Scope and preparation

This inventory covers the actually mounted `/demo` page, its shared navigation/footer and `CinematicAxiomDemo`, `useStoryPlayback`, `WorkflowStoryScene` and decorative `DesktopPreviewFrame`. It does not qualify the destinations reached by links or claim full website coverage. Bindings below use local evidence keys only; they are not help IDs, DOM IDs or installed retrieval/deep-link bindings. The existing actual fragment is `#product-tour`. [route, tour-shell, frame]

Open `/demo`, read the simulation label, then choose **Start the scripted tour** to follow the fragment to the tour. This link does not call Play or explicitly move focus. No account, connector consent, role, repository access, AI credit or cloud authority is needed for the tour. JavaScript enables local interactive state; static/first render starts at Code & review, first step, stopped, full text, with Play initially disabled while motion preference initializes. The page explicitly says recorded walkthroughs are unavailable. This is scripted sample data, not a native capture, recording, successful check, deployment, approval or provider receipt. [route, playback-initial, tour-state]

## Page entry and exit controls

For each link below, activate with pointer or normal keyboard link activation; the expected result is navigation to the literal destination only. Destination availability, authentication, downloads and underlying product behavior are outside this source review. Return using browser navigation or open `/demo` again if the destination fails; no tour action needs undoing. [route-links, tour-links]

| Location / control | Destination / purpose | Limits |
| --- | --- | --- |
| Hero: Start the scripted tour | `#product-tour`, locate tour | No explicit playback or focus handler |
| Hero: Check available downloads | `/download`, inspect downloads | Does not download a file directly |
| Tour: Read approval workflow | `/docs/approval-workflow`, read workflow scope | On navigation dispatches `axiom:documentation-navigation-intent`; no approval granted |
| Tour: Explore every safe demo | `/demo` | Self-link on this route; no reset handler; reset on same-route navigation is not guaranteed |
| Guides: Prepare a repository change | `/docs/approval-workflow` | Version-specific guide; tour does not establish production activation |
| Guides: Inspect an Airflow dependency | `/integrations` | Connector/operation requirements must be checked separately |
| Guides: Understand the AWS ECS workflow | `/docs/aws-setup` | Dispatch is separate from completion, health and recovery |
| Bottom boundary panel: Read the approval guide | `/docs/approval-workflow` | Reading does not grant action authority |

## Select a workflow and a step

Choose one of the three ordinary story buttons above the preview. The selected button has `aria-pressed`; selecting even the current story clears the sample decision and resets playback to stopped step 1. Repository, branch and environment selections survive story changes. These are buttons, not an arrow-key tab interface. [tour-state, story-controls]

Every title listed below is an individually selectable step button on the left. Activate a title to show that scene fully, stop playback and clear the sample decision. The current one has `aria-current="step"` and an accessible label `Step N: title`. Step changes do not explicitly move focus. All steps remain independently reachable even after rejecting a sample; there is no approval prerequisite. [step-controls, playback-actions, story-data]

| Story button | Ordered step buttons (exact titles) | Review/end behavior |
| --- | --- | --- |
| Code & review | 1. Choose the working context. / 2. Make a small, reviewable edit. / 3. Review the bounded check. / 4. Read the check output. / 5. Review before publishing. | Timed playback stops at end of 3 and 5 |
| Agent & approval | 1. Attach context to the request. / 2. Inspect the proposed change. / 3. Decide on the exact action. / 4. Keep the outcome honest. | Timed playback stops at end of 3 and final 4 |
| Terraform & cloud | 1. Start with a configuration preview. / 2. Inspect the evidence boundary. / 3. Keep the release on hold. | No review flag; timed playback stops at final 3 |

## Playback and keyboard controls

Controls are below the step list, in **Story playback**. Each enabled control can be reached with Tab/Shift+Tab and activated as a normal button. Shared buttons have focus-visible outlines and disabled opacity; step buttons/selects have their own focus-visible styles. No runtime focus/accessibility acceptance is implied. [playback-controls, scene-controls, context-controls]

| Control | Exact operation / expected result | Prerequisite, limit and recovery |
| --- | --- | --- |
| Play / Pause (`Play story` / `Pause story`) | Toggles playing. Pause retains elapsed progress. Starting after a completed step resets elapsed to zero on that same step. | Disabled under reduced motion; no autoplay on load. Use step buttons if unavailable. Pause does not clear a sample decision. |
| Replay story (circular arrow) | Clears decision, returns to first step; starts playing only when reduced motion is off. | Remains enabled under reduced motion and gives static first step there. Keeps context and chosen story. |
| Previous step | Selects previous step fully, clears decision, stops. | Disabled at first step; choose another title or Next. |
| Next step | Selects next step fully, clears decision, stops. | Disabled at final step; choose another title or Replay. |
| ArrowRight / ArrowLeft | Choose next/previous, clamped at ends | Handler belongs only to Story playback group; not to entire tour or step/story groups. No wrapping or explicit focus movement. |
| Home / End | Choose first/final step, clearing decision and stopping | Same playback-group scope. Select/input targets are excluded by handler; selects are outside this group. |

One clock adds 60ms per interval toward a nominal 5400ms per step; this is timer state, not a wall-clock guarantee. At the end it advances automatically unless the step is review-marked or final, when it stops. Review stops after the timer completes, not immediately on entry. Play on a stopped completed review replays that review; it does not grant approval or automatically cross it. Use Next or a step title to continue. The concise polite/atomic **Current story step** status announces step number and title, not each animation frame. [playback-clock, playback-controls]

The clock runs only while playing, motion is allowed, the document is visible and the tour intersects the viewport (observer threshold 0.1). Hidden/out-of-view pauses elapsed updates while retaining the playing flag; returning resumes if still playing. The button can still say Pause; helper text says playback is paused while out of view (also used when the document is hidden). Without IntersectionObserver the visibility flag remains true. Pause manually to prevent resumption. Reduced-motion preference changes stop playing; turning it off does not itself resume. [playback-visibility, playback-clock, playback-controls]

Reduced motion shows full content, disables Play and removes the demo cursor; Replay remains static. Otherwise typed text and cursor use the shared fraction. Initial stopped elapsed zero also shows full content; manually selected steps show full content. The thin progress bar is decorative/aria-hidden, not a scrubber. Screen readers receive the full typed string through a separate span; visual typed characters/cursor are aria-hidden. The cursor is pointer-events-none and cannot click anything. [playback-actions, scene-display, tour-frame]

## Select sample context

Three labeled native selects sit above every scene. Choose an option using native pointer/keyboard interaction. Every actual change updates local context, clears decision and resets to stopped first step; the other context values remain. There are no empty placeholder options or disabled options, including Production · held. Selecting Production does not unlock execution. No account lookup, validation request or persisted setting is performed by these handlers. [context-controls, tour-state]

| Select | Options (first is initial value) | Visible effect |
| --- | --- | --- |
| Repository | `acme/customer-web`; `acme/payments-api` | Attached context and review target |
| Branch | `feature/timeout`; `review/retry-policy` | Attached context, edit footer and review target |
| Environment | `Development`; `Test`; `Production · held` | Attached context; not every scene displays this field |

To recover a confusing selection, choose the desired values and select a step again. Story/reset/replay preserve context. A fresh component mount resets all local state to defaults; the component has no persistence layer. Reload is a local reset, not reconciliation or recovery of real work. [tour-state, playback-actions]

## Try a sample decision

**Reject sample** and **Simulate approval** appear only in Code & review step 3 (check), Code & review step 5 (GitHub) and Agent & approval step 3 (GitHub). Select that step, read the sample target/command or recovery text, then activate either button. Both stay enabled, including after a decision, and can replace the previous choice. No acknowledgement box, actor identity, expiry or real permission check exists here. [review-scenes, scene-controls, story-data]

Either button selects the current step fully and stops playback, then sets local decision. Reject displays **Sample rejected · no action taken**; approve displays **Sample decision recorded**, in a status paragraph. Neither advances, executes a check, publishes a branch, creates a pull request, records a server approval or verifies an outcome. Decisions clear on story/context/step selection and Replay; Play/Pause alone retain them. Use Next to inspect later scripted scenes even after rejection. [tour-state, tour-frame, scene-controls]

The check scene describes approval, user-readable files/credentials, a five-minute timeout and separate 1 MB stdout/stderr limits as illustrative explanatory copy. This document does not verify installed command enforcement from that copy. The output scene contains a fixed sample successful `tsc` string, not a process result. File names, diff, Sample saved, Engineer badge and terminal-looking text are presentation only: no file explorer, editor, save button, prompt input or terminal command control is mounted in the scene. [scene-display, review-scenes]

Terraform scenes show illustrative configuration, unavailable plan producer/current target authority and apply disabled. There is no Apply button to enable, no cloud connection control and no live plan artifact. Receipt scene says decision is not execution, GitHub write not performed, ECS health not observed and recovery not verified. Cards fading in are not selectable controls. [scene-boundaries]

## Shared page navigation and footer inventory

These controls are mounted by `/demo`; following their links leaves the bounded tour. Ordinary links have no prerequisite to activate; **Support (account required)** advertises a destination access requirement, which this source does not validate. No destination route behavior is accepted here. [navigation-links, footer-links]

| Surface | Every control / destination |
| --- | --- |
| Header | Skip to content (button); Vision XIX Labs home → `/`; Product → `/product`; Integrations → `/integrations`; Security → `/security`; Docs → `/docs`; Demo → `/demo`; More (button); Sign in → `/auth/signin`; Download → `/download`; Open navigation menu (button below xl) |
| More destinations (xl) | Pricing → `/plans`; Support (account required) → `/account/help`; Status → `/status`; Company → `/axiom` |
| Mobile dialog | Close navigation menu (button); all five primary links and four More destinations above; Founding Supporters → `/support`; Sign in → `/auth/signin`; Download → `/download` |
| Footer CTA/brand | Explore Axiom → `/product`; Founding Supporters → `/support`; Vision XIX Labs → `/` |
| Footer Product column | Product → `/product`; Demo → `/demo`; Docs → `/docs`; Download → `/download`; Integrations → `/integrations`; Pricing → `/plans`; Security → `/security` |
| Footer Company column | About → `/axiom`; Founding Supporters → `/support`; Support (account required) → `/account/help`; Contact → `/contact`; Service status → `/status` |
| Footer Legal column | Privacy → `/privacy`; Terms → `/terms`; Security → `/security` |

Skip to content closes menus, makes the first main focusable with tabindex -1 if needed and focuses it; missing main returns without focus. More toggles an expanded group; ArrowDown opens and focuses its first link, Escape closes and returns focus to More. Leaving the group by focus, outside pointer, pathname change or resize below 1280 closes it; no arrow-key cycling/trap is implemented. [navigation-more, navigation-skip]

Below xl, Open navigation menu opens a modal-labeled dialog, makes header bar inert/aria-hidden, locks body/root scrolling and schedules focus on Close. Tab/Shift+Tab wrap first/last focusables. Close or Escape closes and schedules focus back to opener. Outside pointer closes without explicit focus return; resize to at least 1280 closes and cleanup restores overflow. Link/pathname changes close menus; link closure does not explicitly restore opener focus. The dialog has its own scroll overflow. These are source intentions, not verified browser or modal accessibility behavior. Recover by Close/Escape or navigation; no tour/provider state is undone. [navigation-mobile, navigation-render]

The preview frame's desktop sidebar, title, window dots and illustrated Agent/Axiom Bot/Releases/Repositories/Batches/Apps & skills/Documentation/Settings labels are noninteractive text/list items, not working navigation. Sidebar is hidden below xl; files list below sm. No image/video player, volume, captions, fullscreen, speed, transcript, download-recording or recording retry controls exist in this mounted tour. [frame, scene-display, route]

## States, limits and remaining acceptance

The fixed story/option arrays have content, so no empty/loading/error/expired/uncertain request-state UI or backend retry is implemented. Initial no-decision state omits the status paragraph; it is not a failed request. The genuine disabled controls are Play for reduced motion and Previous/Next at their boundaries. Terraform apply disabled is explanatory text, not a disabled button. Missing trusted authority and unverified outcomes are scripted teaching states, not observed live incidents. If animation is unavailable, use static step controls; there is no service operation to resend or roll back. [story-data, playback-controls, scene-controls, scene-boundaries]

This finite inventory documents mounted source controls, not complete website/product coverage. Source inspection and hashes do not establish visual quality, responsive behavior, actual focus/scroll, assistive technology or runtime correctness. No tests, build, browser, provider, database, native action, Security helper, publication or recording was used for this unit. B2 browser/responsive/accessibility acceptance, B3 authentic version-bound screenshots/recordings and captions/transcripts/posters/redaction, B4 stable supported control IDs, numbered authentic images, genuine editorial review and shipped-version qualification remain open. No customer ingestion or support-answer eligibility is granted. [master-b2, master-b3-b4]
