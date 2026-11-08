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

## Pipe-flow kit (calm v4, 2D), 2026-11-08 — replaces the 3D page kit
**User decision (2026-11-08):** 3D page models looked flashy and were hard to read ("cant even read"). Pages explain the product as **data moving through pipes** in clean 2D. The homepage keeps its 3D model as the one showpiece.

`components/marketing/pipeKit/PipeFlow.tsx` + `pipeFlow.module.css`, fed by a tested data file in `lib/marketing/`:
- Stages stacked top to bottom. Each stage has a number, title and one-line summary, plus **titled steps with a one-line explanation each**.
- Data bits flow through a pipe behind each stage's steps. A **labelled packet** travels down the pipe to the next stage, and the text says what is passed on and why.
- Clicking a stage opens a detail panel with its guarantee, what happens if it fails, and what it passes on.
- One calm, muted tone per stage (sky, teal, violet, amber, emerald), used only for the left edge, the numbers and the moving data. Text stays the brightest thing on screen.
- Readable: 14–18 px Inter at regular weight, soft off-white, monospace only for numbers and packet names.
- Calm: 3–4 s per pass, no flashing, a Pause control, and reduced motion shows the packets standing still. Plain HTML and CSS: no GPU, sharp on every screen, keyboard and screen-reader friendly, stacks on phones.

**Adding a page:**
1. Write `lib/marketing/<page>Model.ts` with tests: title, summary, titled and explained parts, guarantee, onFailure, passesOn, tone.
2. Render `<PipeFlow stages={…} label="…" />` inside the page section.
3. Add a jsdom test.

The Product page `ControlPlaneModel` is the reference.
