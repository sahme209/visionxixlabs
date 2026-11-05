# Axiom visual design lane

November 5, 2026; initial source baseline `159f4fc9d3d17b09895ebc54ceeb99abff912d29`. Dedicated design ownership alongside the core work. Scope now: source/local audit and agreed presentation fixes; preserve open apps, drafts, permissions, approvals, readiness and historical artifacts. The specialist source audit made no app relaunch, provider call, library installation, build or deployment. After that audit, root opened a read-only local style comparison using the actual app CSS and source-derived inert markup, saved a screenshot and showed it in chat. This is local style-preview evidence, not signed-in native-product or complete rendered-accessibility acceptance.

Read the full B2 and B6 requirements and adjacent B1 references in the master, [interface clarity](interface-clarity.md), [website architecture](axiom-website-information-architecture.md), and the [earlier tooling inventory](../recovery/2026-11-03/web-quality-tooling/README.md). Applied `design:design-critique` from `/Users/samirahmed/.codex/plugins/cache/claude-cowork/design/1.1.0/skills/design-critique/SKILL.md`: purpose, usability, hierarchy, consistency and accessibility. Security, premium restraint and understandable next steps remain acceptance criteria; tests or a prettier screen cannot establish runtime authority.

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
- [x] **One change at a time:** root showed this exact frozen Sky fix locally before any next visual change begins. Use the isolated inert source-derived revision-history style comparison with actual desktop CSS, labeled STYLE PREVIEW / not a live account. Do not restart a signed session or touch drafts; no backend controls/calls. Existing ticket-review preview is a different surface, not evidence for this label.
- [x] Root source-reviewed the narrow CSS diff and visually inspected the isolated comparison. No signed app relaunch, production build or deployment occurred.
- [ ] When authorized without disturbing drafts/open apps: inspect both themes, relevant release-history state, Apps unavailable state, Agent review and Bot draft at actual supported sizes/zoom/compact settings. Reuse existing screenshots only with exact source/state/capture context; none substituted here.
- [ ] Decide the operational-note typography pilot after that actual audit; no global sweep yet.
- [ ] Preserve B6 open gates: desktop/mobile visual baselines, actual contrast/focus/keyboard, AT/media/transcripts, reduced motion/scrolling, performance, links/CTA/readiness accuracy and separately approved publication.

This lane owns ongoing visual consistency and review proposals across the product, not only Releases. It does not pause core enforcement, replace B1–B6 acceptance, qualify all21 parent requirements or introduce provider/customer action.

## First change shown locally

Root opened `http://127.0.0.1:5349/local-preview/visual-change.html` in the visible in-app browser; the page imports actual `desktop/src/styles.css`. Before uses the explicitly labeled former Sky100 foreground; after uses the current class without an override. The screenshot at `/Users/samirahmed/Documents/Codex/2026-10-22/referenced-chatgpt-conversation-this-is-an/outputs/axiom-visual-change-01.png` was captured through the supported browser and embedded in chat before any next visual implementation. The fixture has no backend, sign-in, ticket data or action controls. Root-owned Vite session64430 serves loopback only. All browser-size/native/theme-state acceptance outside this isolated comparison remains open.
