# Marketing keyboard bypass implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let keyboard users bypass repeated marketing navigation and reach the current main content.

**Architecture:** Extend only the existing client Navigation with an explicit focus action. Keep its current layout, menu behavior and permission boundaries; do not invent global target IDs.

**Tech Stack:** Existing React/Next, Tailwind, Vitest/jsdom; no new dependency.

- [x] Observe focused behavior-test RED before source changes.
- [x] Implement the minimal shared-control repair; focused GREEN and affected navigation checks.
- [x] Independently review the frozen source and exact verification evidence.
- [ ] Build once for changed source and expose a guarded local preview; keep browser/AT acceptance separate.

# Marketing keyboard bypass: bounded local repair

Existing approved B2/B6 website design requires keyboard access, visible focus, restrained visuals and clear navigation. User explicitly opted out of routine design checkpoints; this is a local accessibility repair, not a new provider capability or authority boundary. All permissions/production gates stay unchanged.

Finding: actual shared components/Navigation.tsx mounts on public Product/Docs/Integrations pages but has no bypass mechanism; Cockpit has its own unrelated skip link. WorkflowEvidenceMap already has deliberate keyboard selection; do not redo it or modify dormant DeploymentLifecycleDemo.

Chosen design: one native type=button 'Skip to content' control as the first focusable Navigation control, visually hidden until focused, with clear high-contrast focus styling. Preserve the current first noninteractive backdrop child (its isolation prevents mobile-dialog containing-block regression). Activation closes navigation disclosures, finds the current main landmark, adds tabindex=-1 only when no tabindex exists, and focuses it using normal native focus/scroll behavior. Do not invent hash targets/global page IDs, force animation, override existing main IDs/tabindex, issue network/route/consent requests or mutate provider state. Missing main must be harmless. Do not restart native apps.

Implementation plan:
1. Write focused jsdom behavior tests BEFORE implementation; run and record actual missing-control/focus RED. Existing test setup mocks Next and Heroicons; use it without new deps.
2. Minimal Navigation change; focused GREEN covers first-focusable control, real activeElement main, preservation of preexisting ID/tabindex, disclosure closing and missing-main safety. Test the outcome, not source-string copies.
3. Run relevant existing Navigation tests once because component changed, scoped TypeScript as feasible (no broad old suites).
4. Freeze source + report/logs, independent task review, then root exact one offline full build and guarded local preview if source changed. No production deployment or claim of actual browser/screen-reader acceptance.

Constraints: no external/provider/customer/OAuth/DB/Security API/native experiment, no new dependencies/npm install, credentials/grants/flags/schema/paidCI/push/publication. Pending Govpacket909cbd48 must never run/touch. Use verified cache /private/tmp/axiom-bootstrap-preparation-build-4087adb5-l0z31yy2/stage/node_modules via local worktree symlink only; never modify cache. Node /Users/samirahmed/.nvm/versions/node/v24.21.0/bin/node; kernel network denial for tests. Existing full build remains useful until this changed-source build is authorized locally after review. No fake browser or compliance result.
