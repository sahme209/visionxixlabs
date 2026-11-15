# Whole-branch product source review

2026-11-15. Independent read-only review against base `93302541e4d02ff06f5daedb3a19fdd993ac005f`, including current tracked product changes and actual new components, assets and focused tests. No product edits, test/build/browser/account/cloud/native execution, Git mutation or network access. Reviewed current handoff/CLAUDE operating rules and Exact desktop spec/plan/ledger. Historical bulk work packets were excluded from product review.

## Findings

### Critical

None identified in the reviewed source.

### Important

None identified after reconciling the owner's explicit neutral-only public palette with the actual status text and icon shapes. See the palette observation below; it is not a release-blocking finding.

### Palette observation — public statuses remain understandable without status hue

`app/orbit-public.css:213` remaps rose/red/amber/emerald scales to neutral grays; line215 applies grayscale to public main SVG/canvas. The newly Navigation-wrapped `/status` activates this palette (`app/status/page.tsx:55`), so operational and down share neutral foreground/border roles. However, the state meanings are independently preserved: the ICON map at lines35–39 uses a check circle, warning triangle, cross circle and minus circle; the LABEL map at lines42–46 states operational/degradation/outage/unknown explicitly. Each component also renders its exact verdict string at lines89–90 and detail at line93. No status builder, verdict calculation or data changed. Given the owner's explicit Exact-neutral palette selection, loss of the old status hue alone is not a defect. Readability and quick recognition still need rendered review; source inspection does not establish contrast or visual acceptance.

### Minor — internal desktop demo description contradicts the new version candidate

`lib/demo/demoScenarios.ts:249` still says the visual source changes do not change “release versions”, while the new step at line266 explicitly records local source candidate0.1.23 and the five desktop identity records now change to0.1.23. Clarify that the source candidate changed while no installer was published/installed. This is a documentation consistency issue, not a runtime version mismatch.

## Product and behavior assessment

- The desktop is structurally recomposed, not merely recolored: App adds an inset main frame; Sidebar is200px with the boxed code/lowercase vxix path asset; TopBar becomes a60px location/action bar; Welcome now has an asymmetric introduction, original painted frame, primary Open Agent action and three substantial navigation cards. Workspace headers/panels and entry panels share the same hierarchy. Operational workspaces remain opaque.
- The App diff is precisely two class-name changes at `desktop/src/App.tsx:204,206`. Auth ownership, coordinator verification, access-required branching, private workspace mounting, navigation destinations, split state and callbacks are unchanged. The Sidebar/TopBar changes preserve existing navigation callbacks, details handlers and service-derived access state. Reviewed view diffs retain action handlers, disabled predicates and ownership checks; Batches replaces the unconditional audit guarantee with neutral review guidance while retaining real unavailable-state warnings.
- `desktop/src/views/DesktopSignInView.tsx:106–107` and `DesktopAccessRequiredView.tsx:90–91` replace non-scrolling centered overflow-hidden roots with vertical scrolling flex roots and nonshrinking auto-margin panels. Welcome has `min-height:0;flex:1;overflow-y:auto` at `desktop/src/styles.css:577`; shared ViewShell remains overflow-y-auto. These are appropriate source provisions for short windows, not proof every disclosure/overlay/control remains reachable.
- Split-editor ownership/layout logic is unchanged. Existing row/stack breakpoints and min-height constraints remain; the new compact composer override is explicit at `desktop/src/styles.css:761`. The Tauri source minimum remains960x600. Actual narrow/short/enlarged-text, expanded history/recovery and split-editor reachability need rendered verification; this review did not run it.
- Website navigation retains its menu/focus logic; the changed source adds current-page semantics and swaps the brand asset. The new public hero is static original artwork and explicitly labelled sample source/no connected account. `OrbitalBackdrop` and its scene remain unreferenced by product roots: source presence is not evidence that a vortex mounts. Scripted walkthrough/model playback controls and autonomous playback were removed while manual story/scenario/stage controls remain.
- PublicFeatureSection uses native scrolling, one coalesced animation-frame update per relevant event, resize observation and proper effect cleanup. Stacking is conditional on desktop/height/motion and every panel fitting. Oversized/short/reduced-motion cases retain normal flow. Focus-within raises the focused panel and removes its transform. The scenario follow-up link is outside the sticky section. Actual pointer/keyboard behavior remains a browser acceptance question.
- Compare now uses an evidence checklist rather than unsupported rankings/cost/recall claims. Its horizontal region is focusable, labelled, bounded and ignores vertical, modified, nested and composing events. Public Manifesto/Enterprise wording now distinguishes source implementation, configured workflow, provider outcomes, credential persistence, audit limits and unfinished Governance. No new proof of universal enforcement is inferred from these pages.
- Candidate0.1.23 is synchronized in `desktop/package.json:4`, both desktop lockfile root identity fields, `desktop/src-tauri/Cargo.toml:3`, the axiom-desktop Cargo.lock package record and `desktop/src-tauri/tauri.conf.json:4`. The lock diffs change only those identity versions; dependency selections are unchanged. `desktop/src/lib/desktopMetadata.ts:3` derives the displayed version from package.json. This does not establish native compilation, signing, installer publication or installation.
- New mounted tests exercise actual App destination body states with synthetic identity and forbidden write ports, plus access-denied private unmounting; Welcome checks callbacks individually. New public tests cover static hero labelling, scroll-helper fallback/cleanup, Compare keyboard behavior and status labels. These tests were read, not executed by this reviewer. Static synthetic captures cannot establish native/account/provider acceptance or visual quality.

## Disposition

No Critical or Important source defect identified; one Minor living-document inconsistency is noted. Public neutral status presentation preserves explicit text and distinct icon shapes and is consistent with the clarified owner palette requirement. No authority/handler/version regression identified. This report supplies source review only. Full green repository/PR checks, current coherent builds, rendered dark/light/short/text/split/overlay evidence and release/production requirements remain separate. Governance remains incomplete/disabled; no claim of visual/native/security acceptance or deployment readiness is made here.
