# Interactive workflow stories

Reviewed 2026-10-18 against main bd44b180. This is a scoped replacement of the existing CinematicAxiomDemo, already embedded on home, product, demo and support pages. It changes no page layout, support workflow or production setting.

## Evidence and reuse

| Story | Existing source | Registry reference | Deliberate boundary |
| --- | --- | --- | --- |
| Code & review | desktop/src/views/RepositoryWorkspaceView.tsx | desktop_app_pairing / 3 | Explorer, editor, explicit save and Git review; only an approved bounded check, no general PTY or autonomous local Agent |
| Agent & approval | desktop/src/views/AgentChatView.tsx | desktop_app_pairing / 21 | Repository/branch/environment context, Engineer proposal and sample review; no real model request or GitHub mutation |
| Terraform & cloud | desktop/src/components/TerraformPlanReview.tsx; desktop/src/views/RemediationView.tsx | desktop_app_pairing / 24; cloud_operations / 4 | Configuration preview and unavailable authority; no producer, apply approval or execution control |

The prior CinematicAxiomDemo supplied the existing dark/orange footprint and controls. HomepageInteractiveDemo already used demoScenarios and StepVisual; the new story metadata uses the same public registry. StepVisual's generic mock-card renderer is retained for full scenario pages, while the cinematic embed needs timed code/output and genuine sample decision controls. Public story links use devops_pipeline steps 4/5 and cloud_operations step 4. The internal-only desktop scenario is an engineering reference in this document only; it is never linked from the embed. Existing framer-motion and heroicons are reused; no dependencies added. DeploymentLifecycleDemo and HomepageMediaShowcase remain unchanged. Available landscape PNGs are branding illustrations, not product captures. No media capture exists in public/media at this baseline.

## Playback contract

Initial render is static, including SSR. Play or Replay starts a single 60ms clock for typing, cursor and progress. Manual steps pause, review stops automatic progression, and all decisions are explicitly samples. Changing story or context resets both progression and decisions. Previous/next and chapter buttons remain available with reduced motion. Arrow/Home/End shortcuts apply only within playback controls; native selects retain their keys. Live reduced-motion changes stop playback. IntersectionObserver and document visibility stop timers offscreen and in background tabs; returning resumes elapsed state without a catch-up jump. Cleanup removes listeners and timers.

The terminal-like panel is labeled bounded check output and scripted; it has no input or command execution. Check limits match the native confirmation: credentials removed, 5-minute timeout, 1 MB output ceiling. GitHub review grants no merge or cloud action. Terraform ends held. The general terminal, local Agent execution, native acceptance, production sign-in and cloud end-to-end limits stay visible. Example filenames and code are invented sample content, not claims of customer evidence. Source file mapping is documented here, not placed in marketing UI.

## Validation

Focused DOM tests cover manual review, context invalidation, offscreen/hidden-tab pause, reduced-motion preference changes, keyboard/replay, blocked Terraform and absence of service calls. Existing scenario contracts and marketing inclusion/disclosure checks run alongside them. Browser layout checks require a coordinator-owned local server/Chromium window; no preview or production deployment is authorized. Before visual verification, all observations here are source review only.
