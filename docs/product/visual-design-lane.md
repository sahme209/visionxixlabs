# Axiom visual design lane

November 5, 2026; initial source baseline `159f4fc9d3d17b09895ebc54ceeb99abff912d29`. Dedicated design ownership alongside the core work. Scope now: source/local audit and agreed presentation fixes; preserve open apps, drafts, permissions, approvals, readiness and historical artifacts. The specialist source audit made no app relaunch, provider call, library installation, build or deployment. After that audit, root opened a read-only local style comparison using the actual app CSS and source-derived inert markup, saved a screenshot and showed it in chat. This is local style-preview evidence, not signed-in native-product or complete rendered-accessibility acceptance.

Read the full B2 and B6 requirements and adjacent B1 references in the master, [interface clarity](interface-clarity.md), [website architecture](axiom-website-information-architecture.md), and the [earlier tooling inventory](../recovery/2026-11-03/web-quality-tooling/README.md). Applied `design:design-critique` from `/Users/samirahmed/.codex/plugins/cache/claude-cowork/design/1.1.0/skills/design-critique/SKILL.md`: purpose, usability, hierarchy, consistency and accessibility. Security, premium restraint and understandable next steps remain acceptance criteria; tests or a prettier screen cannot establish runtime authority.

## Current working rule

The latest user instruction supersedes the former per-change preview gate: conserve credits and show local previews at meaningful coherent milestones, not after every small adjustment. Keep one dedicated visual agent; batch related safe presentation work, preserve drafts/authority and perform focused verification. No automatic screenshots, new dependencies, network/provider actions, relaunch, build or deployment. Changes01–03 remain historical local showings, not native acceptance.

## Two highest-value findings

1. **Light-theme section labels bypass the shared color system — narrow fix applied.** Reachable Releases is `DeploymentRequestsView.tsx`, not dormant `ReleasesView.tsx` (`App.tsx` routing). Its “Governed revision history” label uses `text-sky-100` at line719, beside “Execution controls” using theme-normalized cyan at line743. Shared CSS normalized cyan/amber/violet and other semantic families but omitted Sky, leaving the very pale dark-theme foreground in light mode. Added only the same light-only50–400 mapping pattern using Sky#0369a1 in `desktop/src/styles.css`; dark colors, text, handlers and state are unchanged.

   Source-pair calculation for original#e0f2fe versus new#0369a1 over declared Sky500/5% backgrounds on the three existing warm canvas/elevation/panel candidates yields **1.04–1.08:1 →4.88–5.59:1**. These are literal sRGB/alpha-composition calculations, not measured final rendered contrast or complete accessibility acceptance. Actual inherited backgrounds, zoom and all states still need authorized visual checks.

2. **Essential limitations are styled like tiny metadata — proposal, deferred.** Reachable Releases uses10px for the closure limitation at line696 and durable-operation limitation at lines744–745. Apps & skills uses10px for “Service connection unavailable” at `PluginsSkillsView.tsx:216`, while its task introduction is14px; Bot's current task status also includes10px (`SavedBotTaskWorkspace.tsx:123`). This makes decision-relevant meaning compete at a weaker reading level than decorative headings/primary content. It is a hierarchy/readability candidate, not a claimed font-size accessibility violation. After an actual screen audit, pilot one semantic operational-note role at12px/comfortable line height for required limitations/recovery text. Retain exact text, all warning/status distinctions and source/evidence disclosures; do not enlarge every timestamp/code line or hide notes in a disclosure. **No typography sweep or UI behavior edit made.**

Existing strengths preserved: warm-paper theme tokens; quiet navigation/current state; shared focus and reduced-motion rules; unboxed Agent responses; separate Bot draft/AI/action meaning; one primary Releases action; task-led Apps grouping; website's original workflow rail and explicit conceptual label. The site shell intentionally has acquisition/documentation hierarchy rather than matching the dashboard's density mechanically.

## Master-named tool and skill coverage

“Evaluate” here means a source/local decision, not tool execution or adoption. Current manifests show existing Framer Motion/Motion; scoped manifest searches found no React Bits/GSAP/Lenis/Playwright declaration. Local skill-name discovery found Image-to-Code; it did not find exact Taste/Web Design Guidelines/Awesome Design packages. Earlier inventory is historical, not proof of current remote availability or license terms.

| Named candidate | Decision now | Security, provenance/license and acceptance condition |
| --- | --- | --- |
| Web Design Guidelines | Evaluate first; apply the approved Axiom architecture checklist now | Exact local package/revision not found. Do not substitute a similarly named tool or claim branded execution. Review source/scripts/dependencies/network/license before use. |
| Playwright | Evaluate as B6 verification priority; defer invocation | No browser/test action under current lane. Later use exact authorized browser fixture, viewport/source metadata, desktop/mobile baselines, keyboard/focus, responsive/reduced-motion and performance checks; separate automated from AT acceptance. |
| Taste Skill | Defer execution; retain one `/product` workflow pilot | Missing pinned package/instructions/license. No fake Taste pass. Compare the existing conceptual rail before/after only when actually observed. |
| Awesome Design | Evaluate as inspiration only | Exact identity/package/license unresolved; no copied layouts/assets, remote lookup or installation now. |
| Image-to-Code | Evaluate availability; defer execution | Local skill exists; no approved original input image and no need for a prototype rewrite. Read its complete workflow/license/dependency side effects before future use. Never turn a synthetic mockup into an authentic screenshot. |
| React Bits | Defer adoption | Need selected component/version, full license including possible Commons Clause/commercial restrictions, provenance and code audit. Only a useful original Axiom adaptation could justify a pilot. |
| GSAP | Defer adoption | No demonstrated coordination beyond CSS/existing Motion for these fixes. Exact version/license/skill review, input latency/reduced-motion/performance proof required before adding complexity. |
| Lenis | Defer; retain native scrolling | No benefit shown. Any future marketing-only trial must preserve keyboard/anchor/focus/native-scroll expectations and reduced motion; no dashboard scroll interception. |
| GetLayers AI / MCP | Evaluate reference/optional accelerator, no connection | No site read/account/MCP install/purchase. Exact output/template/commercial provenance and security/performance/maintainability audit before any isolated original pilot; no decorative3D or template identity copying. |
| Prompt Motion | Evaluate reference, no external read | Original product-explanation concepts only. Example code/assets need exact license/provenance; motion must preserve content, input and reduced-motion alternatives. |
| Figma editable workflow | Evaluate only when an original design artifact needs it | No file/plugin/account action. Inspect instructions/permissions and avoid uploading sensitive product/customer data; an export is not implementation or accessibility proof. |
| CSS | Apply for the agreed theme correction | Existing framework/tokens, no dependencies/assets/requests. No motion needed; check source scope and later actual theme rendering. |
| Motion for React / Framer Motion | Evaluate existing use before adding effects | Already declared locally; not a new adoption approval or current license audit. Prefer no animation for static readability fixes, retain reduced-motion behavior and bounded performance. |

No blind invocation of every available plugin or library. The applied critique skill is sufficient for this bounded audit; third-party tools are not a substitute for source grounding or customer controls.

## Reference coverage and original design decisions

These rows cover the master B1/B2 design-reference set. No reference site was opened in this lane, no authenticated product flow was observed, and no vendor UI/media/code was copied. Existing historical Cursor research remains partial; the full six-site journey requirement is open.

| Reference | Apply/evaluate/defer decision for Axiom |
| --- | --- |
| Cursor | Apply the principle of focused working hierarchy; evaluate exact public/authenticated journeys later. Preserve Axiom navigation, source/evidence and safety controls, not vendor layout or branding. |
| Claude | Apply Axiom's already selected warm-paper/light-mode restraint; no claim these are Claude's exact colors. Evaluate current product behavior only through authorized observation. |
| ChatGPT / OpenAI | Apply conversation reading order and a clear next action; keep tool/action/review meanings explicit. Public and authenticated behavior not newly observed. |
| Codex | Apply task/context/evidence separation; a visible task or tool result is never approval authority. Evaluate authentic workflow only when access/scope permits. |
| Grok / Grokbot | Evaluate interaction clarity and information density later; do not infer functionality from screenshots/marketing or copy its visual identity. |
| Apple | Apply consistent controls, typography, focus and platform care already selected by Axiom. No Apple parity/endorsement claim; native/AT acceptance remains unobserved. |
| Harness.io | Evaluate workflow explanation and operational evidence hierarchy later; do not import badges, customer claims or deployment/recovery guarantees. |
| GetLayers AI | Evaluate original composition possibilities only, subject to the tool/license constraints above. |
| Prompt Motion | Evaluate purposeful storytelling only, subject to the motion/license constraints above. |

The B2 economic references (Vercel Gateway pricing/BYOK docs, Stripe billing/blog, Harness pricing, Spacelift pricing and env0 pricing) remain in the separate A7/B2 economics decision. They are not visual evidence or a source of approved Axiom prices; no reads or business-model changes occurred here.

## Ongoing action list

- [x] Audit exact B2/B6 and candidate/reference inventory; preserve the user's master additions and all parent scope.
- [x] Inspect shared desktop theme/App, current Agent/Bot/Releases/Apps source and website shell/architecture; distinguish dormant views from mounted surfaces.
- [x] Apply agreed missing light-theme Sky mapping; calculate declared color pairs. UI change is limited to CSS.
- [x] **Historical first-change showing:** root showed the Sky fix using actual CSS/inert markup. Preserve that evidence; the former per-change gate is now superseded by meaningful milestone previews. No signed-session/draft interruption or backend calls.
- [x] Root source-reviewed the narrow CSS diff and visually inspected the isolated comparison. No signed app relaunch, production build or deployment occurred.
- [ ] When authorized without disturbing drafts/open apps: inspect both themes, relevant release-history state, Apps unavailable state, Agent review and Bot draft at actual supported sizes/zoom/compact settings. Reuse existing screenshots only with exact source/state/capture context; none substituted here.
- [ ] Decide the operational-note typography pilot after that actual audit; no global sweep yet.
- [ ] Preserve B6 open gates: desktop/mobile visual baselines, actual contrast/focus/keyboard, AT/media/transcripts, reduced motion/scrolling, performance, links/CTA/readiness accuracy and separately approved publication.

This lane owns ongoing visual consistency and review proposals across the product, not only Releases. It does not pause core enforcement, replace B1–B6 acceptance, qualify all21 parent requirements or introduce provider/customer action.

## First change shown locally

Root opened `http://127.0.0.1:5349/local-preview/visual-change.html` in the visible in-app browser; the page imports actual `desktop/src/styles.css`. Before uses the explicitly labeled former Sky100 foreground; after uses the current class without an override. The screenshot at `/Users/samirahmed/Documents/Codex/2026-10-22/referenced-chatgpt-conversation-this-is-an/outputs/axiom-visual-change-01.png` was captured through the supported browser and embedded in chat before any next visual implementation. The fixture has no backend, sign-in, ticket data or action controls. Root-owned Vite session64430 serves loopback only. All browser-size/native/theme-state acceptance outside this isolated comparison remains open.

## Change02 — one explanatory paragraph, applied and awaiting local showing

The design lane has now inspected that saved screenshot using the local image viewer. The repaired heading is visibly distinct; the privacy explanation immediately below remains compressed at10px/16px, while the label uses12px and surrounding explanatory context is larger. This supports a narrow reading-hierarchy proposal for the shown block, not a whole-app typography conclusion or native-screen audit.

**Agreed single change, now applied:** `desktop/src/views/DeploymentRequestsView.tsx:720`, only the paragraph beginning “This view lists only safe field categories”: replaced `text-[10px] leading-4` with `text-xs leading-5` (12px/20px). Retained `text-zinc-500`, wording, disclosures, revision data, handlers, layout containment and all authority/availability states. Timestamps, raw IDs, the neighboring execution ledger, Agent/Bot and Apps are unchanged. No new dependency or motion.

Why this next: the just-shown local screenshot provides direct evidence of this particular paragraph's hierarchy, so the proposal no longer relies solely on guessing from source. It improves the legibility of a privacy limitation without adding a decorative asset, copying vendor UI, or obscuring meaning. The broader operational-note role remains a candidate requiring actual screen observations on the other surfaces.

**Historical change02 gate (satisfied below):** the comparison was prepared at `/local-preview/visual-change-02.html`. The separate inert comparison imports actual CSS, keeps both headings on the corrected Sky style, and compares the exact unchanged paragraph at10px/16px versus12px/20px. Static literal/inert-page checks passed; no rendering, build or test suite was run for change02. Preserve page01/screenshot, open signed-app sessions and drafts; no backend/provider/native call or relaunch. The then-required showing happened before change03; it is not an ongoing per-change requirement. Normal/narrow wrapping, native states and accessibility acceptance remain open beyond the isolated showing.

### Change02 shown

Root opened the separate `http://127.0.0.1:5349/local-preview/visual-change-02.html` and inspected/captured the before10px/16px and after12px/20px comparison with actual app CSS. Screenshot `/Users/samirahmed/Documents/Codex/2026-10-22/referenced-chatgpt-conversation-this-is-an/outputs/axiom-visual-change-02.png` was embedded in chat before any third visual change. Source review confirmed the product diff is exactly one className line; text, color and handlers are unchanged. This does not update the running signed native app or establish broader native/accessibility acceptance. At that checkpoint change03 had not yet been implemented; its later source and showing are recorded below.

## Third-change decision — two whole-screen alternatives, no implementation

The next step should improve a screen's task order rather than repeat a paragraph-size sweep. Source-grounded alternatives:

| Alternative | Existing reading-order issue and one bounded proposal | Exact reachable source / preserved behavior |
| --- | --- | --- |
| **A — Releases: current request before unrelated run history** | When workflow runs exist, the full “Workflow execution evidence” card appears before service freshness/errors and the selected release workspace. Those runs explicitly are not verified for a particular release. Move that entire existing card below the selected-release workspace: heading/actions → existing intake/draft if open → freshness/errors → release navigation/detail → secondary workflow history. This prioritizes the operator's current scope/next step without making history look like readiness evidence. | `desktop/src/views/DeploymentRequestsView.tsx:542–574,577–597,832`; `FocusedReleaseWorkspace.tsx` and existing shared styles. Retain every history limitation, details/control/handler, loading/empty state, request key, mounted draft and status. No redesign of review or readiness. Requires verifying open-form/empty/stale states and scroll/focus; source order alone is not visual acceptance. |
| **B — Agent: request context before the composer (recommended)** | The visible operation-mode/model row currently comes AFTER the prompt/send controls, send hint and Agent-configuration disclosure. The complete request-configuration summary before the prompt is screen-reader-only. Move the existing mode/model row immediately above the prompt row, so the lower screen reads context → instruction → send → secondary configuration. The operator sees Inspect/Engineer/Operate and model availability before composing. Keep the advanced disclosure and exact controls; add no readiness badge or extra configuration panel. | `desktop/src/views/AgentChatView.tsx:1329–1389`, existing `.agent-composer`/`.agent-prompt-row` in `desktop/src/styles.css`, actual `AgentModelSelector.tsx`. Change only JSX placement of the existing controls; preserve labels, props, disabled guards, requestKey/queue behavior, Enter/IME rules, draft state, pending-review lock and current model/session authority. This is a hierarchy proposal, not a claim of a wrong submission observed. |

Recommend **B** for a higher-impact next pilot across the main working screen: the selected task context should precede text entry, while secondary settings remain subordinate. This applies the master/reference principles of clear purpose, focused conversation and platform consistency using Axiom's own components; no competitor layout or new animation/library is needed. Alternative A is useful but remains a separate later decision, not a bundled change.

### Showing the selected alternative honestly

For an agreed meaningful milestone, prepare a separate full-viewport local style preview with actual desktop CSS and the exact source layout/classes before/after, including the existing sidebar/topbar proportions and relevant surrounding content. Prefer actual pure presentation components where they have inert props; never mount the resource-loading full view against a real desktopClient. Otherwise label source-derived markup precisely rather than calling it the running app.

For B, use “Unsent local draft” and “No approved model” with Send disabled, no fabricated assistant response/account/provider status or approved action; use static named mode examples only. For A, use synthetic draft/stale request samples and explicitly unbound historical run examples; no green deployment/readiness/approval and no live workflow link. Keep limitations visible. The preview must have no backend/native/provider calls, forms with live effects, account loading or signed-app relaunch. Capture normal and narrow whole-screen wrapping and preserve pages/screenshots01/02. Isolated visual showing does not establish native state/focus/keyboard/AT acceptance.

At this proposal checkpoint no third UI change had begun. Root subsequently selected B, recorded below; the other alternative and broader typography candidate stay pending.

## Change03 — Agent context row moved and shown locally

Root selected alternative B. The existing `Agent controls` row and its `AgentModelSelector` are now immediately before `.agent-prompt-row` in the reachable `AgentChatSession`. The actual modes are **Inspect, Engineer, DeepOps**; “Operate” in the earlier conceptual proposal was not the source label and has not been introduced. Source comparison against HEAD confirms the moved row is byte-identical and the remainder of the product file is byte-identical after removing that row from each version. Values, handlers, guards, help IDs, disabled logic, queue/draft ownership, keyboard/IME rules and exact text are unchanged; Releases reordering is deferred.

Added one behavioral DOM-order regression in `lib/desktop/__tests__/agentModelReadiness.test.ts`: mode/model precede the prompt, switching mode retains the unsent text and conversation, and no request is sent. Genuine RED was the old DOM order (1failure); after the row move, that case plus five existing model-retry, command-enter/IME, keyboard-preference and queue compatibility cases passed (6focused checks,99unselected). The existing harness stubs desktop/native/provider clients; this is not live AI, backend or native acceptance. Logs: `/private/tmp/axiom-visual-03-red.log` and `/private/tmp/axiom-visual-03-green.log`. No full build or unrelated suite was run.

Prepared `/local-preview/visual-change-03.html`: two source-derived full-workspace layouts with actual CSS,224px desktop navigation proportion and responsive preview wrapping. They share the same prompt/configuration/model-unavailable content; only context-row placement differs. All preview mode/model/Send controls are disabled, the draft is read-only and labeled synthetic, and no response/account/approval/provider state is fabricated. The surrounding navigation/topbar are illustrative source-derived proportions, not the running native application. Static inert-page checks found no backend/native request code.

**Showing recorded:** root opened03 locally at the existing loopback URL. No new screenshot is required. Pages/screenshots01/02 remain preserved; no app relaunch, deployment, provider call or backend edit. Actual native viewport, keyboard/focus and accessibility validation remain open. Future previews occur at meaningful milestones under the latest user instruction.

## Catalogue view milestone — implemented, local preview prepared

Source finding: `PluginsSkillsView.tsx:194–196` presented “Browse capabilities” and “Filter by saved status” as separate groups, but both write the same `filter` state. Choosing Apps then Enabled replaces Apps with a skills-only view; it does not apply an additional status filter. The visual structure suggested two dimensions where the existing behavior has one exclusive selection.

Root agreed this bounded milestone: one explicit “Choose catalogue view” group, quiet “Browse”/“Saved views” subdivisions, consistent single-selection treatment, and the concise guidance “Select one view at a time. Enabled and Disabled show saved skills.” All seven button labels, `setFilter` handlers and filtering semantics are unchanged. Search, connection/consent controls, read-only notices, real status labels and permissions are preserved. No second filter state, readiness claim, dependency or backend change.

One new interaction regression failed on the old missing unified group, then the complete affected mocked lifecycle suite passed32 checks. It verifies Apps→Enabled replacement, one selected view, retained search, expected skill result and read-only mutation/consent guards. Updated one existing presentation assertion for the renamed saved-view group. Logs: `/private/tmp/axiom-visual-catalogue-red.log` and `/private/tmp/axiom-visual-catalogue-green.log`. Native shell/desktop clients are mocked; this is not a provider or native acceptance run. No build/relaunch occurred.

Prepared `/local-preview/visual-catalogue-views.html` using actual desktop CSS and inert source-derived before/after catalogue layouts. Seven selector labels are identical; the sample selection is explicitly a view example, not an enabled skill or connected account. Search/settings/selector controls are disabled, no workspace data is loaded, and no backend/native/provider calls are present. Root may show this coherent milestone when useful; the superseded per-change screenshot gate is not restored. Broader typography and Releases reorder remain deferred.

Final source-review copy refinement uses “Select one view at a time. Enabled and Disabled show saved skills.” in product and preview. Only that guidance and its focused test assertion changed; the catalogue milestone is frozen.

### Catalogue loading / empty-state correction — source prepared, tests blocked

Current `PluginsSkillsView.tsx` now renders a neutral “Loading skills…” status when an otherwise empty skills-relevant view still has `skills === null`. Apps-only view never receives that status. Settled catalogue failures retain their existing warning/Retry and do not also claim a no-match result; successful empty results retain the existing empty-state copy. Only the final rendering branch changed: fetches, handlers, query, focus, ownership and access checks are untouched.

Three deferred/mock regression cases were added to `lib/desktop/__tests__/pluginsSkillsLifecycle.test.ts`: pending→matching enabled result with retained query/focus and no mutation/consent; failed response→warning without false empty; successful empty response→true empty only after settlement. Both pre-fix attempts failed before collection with `ERR_INVALID_PACKAGE_CONFIG` for the existing Vitest package: defaultNode25 log `/private/tmp/axiom-catalogue-loading-red.log`, then established Node24 + wrapper log `/private/tmp/axiom-catalogue-loading-red-node24.log`. These are **startup failures, not behavior RED or passing tests**. No dependency/cache repair, install, build, browser or provider action occurred. Source whitespace check passed; behavioral verification remains blocked pending the existing runner being usable. No preview or acceptance claim follows.

Bounded catalogue-test follow-up: pinned Node24 ordinary Vitest package read/parse/hash succeeded; the one authorized three-case wrapper attempt then failed before collection on the different `node_modules/vite/package.json` path (`/private/tmp/axiom-catalogue-loading-final-attempt.log`, exit1). No case ran or passed; no repair/retry followed. See [startup diagnosis](catalogue-test-startup-diagnosis.md).

### Source-only help alignment

Audited the existing Apps & skills and Agent knowledge drafts after UI commit `6ff0a996`. The Apps draft already explicitly says the two view families are alternatives, not independent intersecting filters; the Agent guide does not promise the old composer order. Both are exact-version r1 evidence inputs, so their text/hash and false eligibility gates were preserved. Corrected only the living `interface-clarity.md` caption (previously ambiguous “browsing … from saved-status filters”) to describe one exclusive selector, and added the current Agent context-before-prompt placement with local-only limits. Ordinary checks confirmed both historical guide hashes still match their article source bindings and both UI files match the cited commit. No documentation reader/schema/retrieval, app build/relaunch, network or provider action was run; no new behavior or acceptance claimed.

### Hairline public-source evaluation

The new explicit B2 requirement received a bounded public GitHub review: repository metadata/tree plus six files at `37d2e78dcb333ab30c3338e28ed4a690364ea014`. See [evaluation](hairline-source-evaluation.md) and [file receipt](hairline-source-evaluation.json). Recommendation: adapt concept selection and honest verification workflow; defer skill/runtime installation. The create entrypoint explicitly describes an external `playwright-core` install, while referenced scripts/kernel/rules remain outside this six-file review. No upstream skill was applied, no command/install/prototype occurred, and no concept was selected. MIT notice retention, further executable-source review, specific operational authority and actual browser/B6 evidence remain conditions; A2 priority is preserved.

The [original workflow diagram brief](axiom-workflow-diagram-brief.md) now describes one Product-page comprehension problem and three alternatives: Evidence rail, Separated handoffs, Outcome lens. It preserves current five-stage/source labels, treats policy as prerequisites rather than a fabricated pass, and keeps refusal/unknown visible. Explicit future concept selection is required; no implementation or winner is selected. Static, keyboard/touch, reduced-motion, screen-reader and actual-browser conditions are recorded. This is documentation only, with A2 continuing independently.

### Catalogue loading — isolated local verification

The later isolated matching-lock test tree resolved the runner startup blockade without installing or altering original dependencies. ONE selected three-case invocation passed3/32skipped; root verified exact source hashes and reviewed the render-only diff. Earlier startup failures remain failures, not behavior RED. [Evidence](../recovery/2026-11-05/catalogue-loading-local/README.md). This is mocked DOM verification only; no signed-app build, native/browser/accessibility or production acceptance.
