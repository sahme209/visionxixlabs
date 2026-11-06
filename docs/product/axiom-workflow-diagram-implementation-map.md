# Workflow diagram: existing implementation map

November 5, 2026 · source review only. Companion to [the brief](axiom-workflow-diagram-brief.md). **Evidence rail, Separated handoffs and Outcome lens remain unselected.** No component, preview or dependency changed; no tests, browser or build ran for this review.

## Reusable current behavior

| Boundary | Actual current source | Preserve in a selected implementation |
|---|---|---|
| Placement | Product imports `WorkflowEvidenceMap`; existing `ProductHierarchy.test.ts` describes one instance in the first section, before the scripted preview. | One teaching surface, not a second competing workflow or live dashboard. Retain surrounding qualifications and real guide/download destinations. |
| State | One component-local `selected` index, initially0. Clicking a stage changes only its explanation. No account state, persistence, requests, timers or operational handlers in this component. | This is explanation selection, never workflow progress, approval or execution state. Reload starts at context; no fake completed steps. |
| Content | Five ordered labels: Repository context; Exact proposal; Independent review; Separate requester execution; Recorded outcome and recovery. Each joins matching `WORKFLOW` and `RECORDS` entries by index. | Keep review distinct from requester intent and maintain the exact label→record association. Any future data refactor must keep each pair together rather than independently reordering parallel arrays. |
| Selection semantics | Native `button type="button"`, `aria-pressed`, shared `aria-controls`; associated `role="region"` is labelled by the selected button. `useId` supplies per-instance IDs. All five buttons retain normal tab stops. | Preserve the button model unless a separately justified complete semantic pattern replaces it. Do not partially relabel it as tabs or a progress indicator. Retain relationships across multiple instances. |
| Keyboard | Plain Left/Up and Right/Down wrap; Home/End select first/last and focus that button. Modified and composing keys are ignored; unrelated keys are not consumed. Enter/Space use native button activation. | Keep ordinary Tab/Shift+Tab and native activation. No global shortcut, hover-only selection or pointer requirement. Current Up/Down behavior also suits a stacked mobile list. |
| Static presentation | Ordered list, visible labels, selected border/background/arrow; decorative numbers/connectors/arrow are `aria-hidden`. One explanation is rendered at a time. No animation API or autoplay in component source. | Keep a meaningful rest state and text alternatives; no moving token implying an actual action. Essential meaning cannot require geometry or color. |
| Layout | One-column list/panel, switching at `lg` to a two-column composition; wrapping-friendly `min-w-0`, stage controls minimum60px high, visible focus outline. | Preserve usable targets and text wrapping. Source classes are not evidence of narrow-screen, zoom, contrast or focus-ring acceptance. |
| Truth labels | Conceptual/local explanation caption and installed-version/enabled-workflow + incomplete-Governance qualifications are always rendered. Confirmed/refused/unknown and recovery limits appear in the selected fifth record. | Keep all qualifications visible in every selection. No automatic confirmed outcome or invented policy/consent pass. |

## Concrete brief gaps, not implemented defects

1. The brief asks for an always-visible uncertainty boundary. Today outcome details appear only after choosing stage5. A selected future design must expose a short persistent confirmed/refused/unknown explanation without implying that any category is a current result. This is new explanatory content, not a status reader.
2. No explicit policy/prerequisite annotation exists inside the current proposal card. If selected, add scoped explanatory wording about current operation support and prerequisites; do not add a fabricated verdict, a sixth implemented stage, or new permission/schema claims.
3. Current component is client-driven and renders only one detailed explanation. Ordered labels and initial context exist in the rest state, but full detailed reading without interaction is not established. The selected design must decide how a concise static summary remains available; a new script-dependent tour cannot be its substitute.
4. The changing region is labelled, but it is not a live region and focus remains on the chosen button. Do not presume a screen reader announces all changed prose. Evaluate the actual reading journey before choosing whether any restrained announcement is needed; avoid duplicative live announcements or forced focus movement.

## Existing tests to retain, and their limits

- `components/marketing/__tests__/WorkflowEvidenceMap.focused.test.ts`: source defines ordered labels, click→pressed/region joins, visible qualifications across selections, arrow/Home/End focus behavior, per-instance unique IDs, no observed `fetch` or interval on interaction and no component links. Its fetch/interval spies are narrow assertions, not proof against every possible operational API.
- `components/marketing/__tests__/ModifiedNavigation.focused.test.ts`: source defines modified/composing-key refusal and plain navigation checks for this component (alongside separate playback tests).
- `components/marketing/__tests__/ProductHierarchy.test.ts`: source defines placement/single-instance and surrounding truth-label assertions; navigation/footer/scripted demo are mocked.

These test bodies were read, **not executed**. They describe useful regression coverage, not new passing results, actual browser behavior or customer acceptance. If implementation is later authorized, add focused coverage for persistent outcome categories, any selected prerequisite annotation and unchanged keyboard/ID/state behavior; do not run unrelated suites merely for this map.

## Evidence still required for a future selected pilot

First obtain explicit concept selection; then authorize a bounded implementation. A later actual supported-browser milestone must inspect complete static comprehension, keyboard and touch, screen-reader reading/selection feedback, reduced motion, focus visibility, narrow widths/zoom/reflow, measured contrast and performance. Any introduced motion needs cleanup and non-motion-equivalence evidence. Record source/version and inert boundaries; never substitute a jsdom result, source calculation or concept graphic for native/runtime/authority acceptance. No browser session needs opening for this source-only map.

Reviewed source SHA256: `WorkflowEvidenceMap.tsx` = `5cd40555b99a49708328db5511428b5e4bf87f3b380c512f9598f1f257898d4a`; Product = `c8802cc6cb5e3929ec621c4a0092561fd9e8a236eaee8fba63d8586619a2607a`; brief = `4552e2b0cdd2e2379535e321d3e4ebeb085256fa1a651c693c6e50bb2afc7cec`. These bind observations only, not a new approved release or acceptance receipt.
