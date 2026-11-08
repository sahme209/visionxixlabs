# Axiom 3D visual language — v4 (locked 2026-11-08 by the user)

The shared system for every major page's 3D model (see the master plan's "one 3D model per major page" directive). Docs pages use real recorded demos instead.

## Look
- **Space:** near-black void (`#03050a`), exponential fog, reflective dark floor, animated fine grid with soft rings rippling outward. No props, no industrial textures.
- **Forms:** clean geometric frosted-glass solids (physical transmission material) with thin glowing edges. One distinct shape per role (pillar, crystal, ring, posts with barrier, octahedron, panel, tube, cylinder).
- **Zones:** thin outlined glass platforms per trust zone; translucent light walls labeled "TRUST BOUNDARY".
- **Light and color:** one cool accent `#6fc3ff`. State colors: passed `#6ff2c0`, blocked `#ff5468`, unknown/rollback `#ffb347`, never-reached `#26303e`, current = white. Filmic tone mapping plus restrained bloom.
- **Typography:** thin sans labels on stations; monospace uppercase for HUD, zones and system nodes.

## Elements
- **Flow:** a hairline rail with a light pulse and fading trail. Its color shows the outcome.
- **Gates:** scan-line light barriers that dissolve only when the real condition is met.
- **External systems:** small glass octahedron nodes with dashed links; data particles stream only while that link is active.
- **Holo panel:** a camera-facing panel above the selected element showing that step's real fields.
- **HUD:** corner telemetry (stage, key counters, decision, outcome). A streaming audit log beneath the scene.

## Explanation (required for every element)
Inspector with: summary, numbered internal steps, data in → out, systems, guarantee, failure branch. Scenario switcher covering the success path and every failure/unknown/recovery path. A plain-language caption per scenario.

## Truth and accessibility (non-negotiable)
- Every name, connection and limit is verified against the codebase. Sample values are labeled illustrative. A visible "illustrative, not live" label is always shown.
- Element buttons are the full 2D alternative. Keyboard and touch work; screen-reader text; `prefers-reduced-motion` → static scene, no camera flights; no-WebGL → static poster plus the same 2D content.
- Performance budget agreed before adding to a page. All assets are self-hosted, with no external calls at runtime.

## Implementation stack (pending source review before adding)
three.js, React Three Fiber, drei, react-postprocessing, GSAP for camera choreography, glTF-Transform for any modeled assets, self-hosted Poly Haven CC0 HDRI if needed. The in-chat concept used three.js r160 with built-in RoomEnvironment, UnrealBloom and OrbitControls.

## Shared visual kit (calm v4), 2026-11-08
Every new page model is built on `components/marketing/visualKit/`. The homepage model predates the kit and keeps its locked engine; it shares only `webglSupport.ts`.

- `theme.ts` (pure, tested): every colour, the type, bloom, exposure, glass recipe, motion speeds and the frame-guard decision. **Change the look here once, not per page.**
- `stage.ts`: renderer, void, studio sheen, floor, grid, low bloom, resize, visibility pause, frame guard, click-to-pick, `glass()`, titled `label()` and full disposal. A model only adds its own objects and an `update(dt)`.
- `useLazyScene.ts`: the client lifecycle. 2D unless WebGL runs on a real GPU; loads only near view; pauses off-screen; falls back to 2D on import failure or a slow frame budget.

**Rules the kit enforces (user, 2026-11-08):**
- Inter at regular weight in soft off-white (`#dde6f0`), never pure white on black. Monospace only for short numbers and codes.
- **Every element has a visible title** (`label()`), and the same titles appear in the 2D fallback and the inspector.
- Calm: one full pulse pass takes ≥ 8 s, bloom strength ≤ 0.6, one accent colour, no flashing.
- Honest: each model is labelled illustrative, and its text comes from one tested data file in `lib/marketing/`.

**Adding a page model:**
1. Write `lib/marketing/<page>Model.ts` and its tests (titles, parts, guarantees).
2. Write `components/marketing/<page>Scene/create<Page>Scene.ts` on `createStage`.
3. Write the section component with `useLazyScene`, a 2D list fallback and an inspector.
4. Add a jsdom test for the 2D fallback.

The Product page `ControlPlaneModel` is the reference implementation.
