# Desktop Exact Composition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the actual desktop composition visibly reflect Exact, replacing the rejected palette-only preview while retaining Axiom's workflow and authority.

**Architecture:** Recompose the shared shell and Welcome first, then apply a common operational page hierarchy to the eight existing destinations. Keep current handlers and data ownership intact. Use existing components/libraries and original artwork; no provider or native behavior changes.

**Tech Stack:** Existing React, TypeScript, Vite, Tailwind, CSS and icons.

**Spec:** `docs/superpowers/specs/2026-11-15-desktop-exact-composition-design.md`.

## Global constraints

- Warm black #0a0908, raised charcoal #171615, white/neutral controls; actual status meanings retained.
- No vortex, player controls, new packages, fake live activity or changed permissions.
- Existing eight destinations, callbacks, help identifiers and keyboard controls survive.
- No frozen-source mutation until current website preview closes.
- Preserve all master/release/Governance requirements; no unsupported release or security claims.

## Review focus

- Short height and enlarged text: content scrolls and controls remain reachable.
- Agent/editor split: editor keeps useful width and operational context remains visible.
- Unavailable/unknown service state: warnings and recovery controls remain truthful.
- Authentication/access-required state: redesigned chrome never grants or implies access.
- Dark/light: contrast, focus, artwork boundaries and logo remain legible.

### Task 1: Finish the running website pointer verification

**Files:** existing `homepage-pointer-render-validation` receipt directory.

- [x] Reuse the accepted website build; start only its approved bounded preview.
- [x] At1280x900, verify stack mode, link-center hit target and actual click to `/product#deployment-model`; also check keyboard and fallback modes.
- [x] Save evidence, restore overrides, close owned tab/listener and verify cleanup. Preserve failures.

### Task 2: Recompose shell and Welcome

**Files:** `desktop/src/App.tsx`, `desktop/src/components/Sidebar.tsx`, `desktop/src/components/TopBar.tsx`, `desktop/src/views/WelcomeView.tsx`, `desktop/src/styles.css`, new original-art copy under `desktop/public/images/`.

**Interfaces:** `WelcomeView({onBuild,onBot,onAutomate,onDeploy})` remains navigation-only; existing Sidebar/TopBar callbacks and identity props remain unchanged.

- [x] Back up current touched source before edits.
- [x] Implement200px navigation/60px toolbar and inset working surface without changing conditional mounting or callbacks.
- [x] Build asymmetric Welcome introduction, original painted frame, white Open Agent button and three destination cards. No fake activity.
- [x] Verify each callback fires only for its own action; update actual-App navigation/access tests for intentionally changed copy.

### Task 3: Apply the system to actual workspaces

**Files:** shared `Primitives.tsx` ViewShell and desktop styles; presentation roots/headers in Agent, Bot, Repositories, Releases, Batches, Apps, Docs and Settings.

- [x] Introduce explicit shared heading/panel classes and apply them to actual view roots.
- [x] Keep editor/conversation space dominant; avoid gratuitous heading inflation or decorative backgrounds on working screens.
- [x] Preserve status colors, disabled states, help IDs, handlers and service/error/recovery content.
- [x] Run relevant mounted view/navigation tests and strict root/desktop types. Inspect diff for authority or data changes.

### Task 4: Show and verify the changed product

**Files:** isolated synthetic capture tests, current visual evidence, Desktop Pairing internal demo/help records.

- [x] Capture representative actual frontend compositions with clearly synthetic/isolated data, including workspaces beyond Welcome.
- [x] Review dark/light at normal/short sizes, keyboard focus, split editor, unavailable and access-required states. Label static versus interactive/native evidence accurately.
- [x] Show the owner visibly different representative screens; record their feedback without calling compilation visual acceptance.
- [x] Update demo/documentation/source bindings and obtain independent actual-source review. Complete appropriate builds/rendered checks before calling this ready.

### Task 5: Assemble the authorized release, then return to Governance

- [ ] Select only intended product/tests/docs/evidence; exclude bulk recovery/cache/source inventories. Use one PR.
- [ ] Run required repository checks; merge only a fully green PR with no bypass.
- [ ] Verify production compatibility/release requirements and make the one authorized Vercel deployment through the applicable procedure.
- [ ] Report desktop distribution/install/version limits separately from website deployment.
- [ ] Resume remaining master items beginning with Governance, preserving all runtime, human, custody, provider and enablement gates.

Self-review: all spec surfaces and five review-focus conditions map to Tasks2–4. Release ordering and Governance are Task5, not substituted by a visual checkpoint. The owner has explicitly asked to execute; no new routine planning checkpoint is introduced.
