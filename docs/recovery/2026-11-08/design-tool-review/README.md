# Design tool source review — 2026-11-08 (read-only; nothing installed or executed)

Each repo was shallow-cloned at the commit below into an isolated scratch folder. Only files were read: no scripts, installs or packages were run. Adoption still needs the gates in the master plan (B2/B6), and the user approves concepts before anything is built.

| Tool | Repo @ commit | License | Install hooks | What it needs | Decision |
|---|---|---|---|---|---|
| Teardown | `elvarofficial/teardown` @ `a91262ac1109` | MIT (2026) | none | Produces **one offline HTML page** using three.js; its own checks use `npm install` + `npx playwright install chromium` | **Adopt the method** for the single bounded 3D proof of concept (request → policy → approval → execution → validation → audit/recovery). Requires a 2D fallback, reduced-motion, no-WebGL, keyboard/screen-reader alternatives, a bundle budget and no external assets. Adding three.js is a new dependency that needs review. |
| Hairline | `lucasmarkes/hairline` @ `37d2e78dcb33` | MIT (2026) | none | `@lucasmarkes/hairline` React package (+ three for figures); network refs are docs/localhost/esm.sh demos | **Candidate** for the isometric CI/CD pipeline explainer, lighter than full 3D. Package and version get pinned before adding. |
| Taste Skill (`design-taste-frontend` 2.5.1) | `Leonxlnx/taste-skill` @ `f6b76575f949` | MIT (2026) | none | Instructions only (381 lines); recommends licensed stock photos (Unsplash) and optional WebGL | **Adopt the art-direction checklist** for Home/Product/Pricing. **Do not** pull stock photos or external assets: the master plan requires original visuals and authentic product media. Not for app or dashboard UI (out of its scope). |
| Web Design Guidelines | `vercel-labs/agent-skills` @ `1a2c79d4e6c4` (skill) + `vercel-labs/web-interface-guidelines` @ `434b7f913646` (rules) | rules repo MIT (2025); **agent-skills has no top-level LICENSE** | none | The skill fetches rules from GitHub at run time | **Use the pinned rules copy** (MIT) for the accessibility/quality audit, not the live-fetching skill. The skill file's license is unconfirmed, so it isn't vendored. |
| Awesome Design | `VoltAgent/awesome-design-md` @ `fcc702849322` | MIT (2026) | none | Markdown only, no code | **Format reference only.** Its DESIGN.md files describe other companies' brand systems; using their tokens would violate the no-copy rule. |

All tools that run code need npm, which is blocked on Claude's Mac. Rendering and browser checks run through the repo's CI website harness until local npm works.

## 3D runtime libraries (2026-11-08; read via jsDelivr package metadata, nothing installed)

| Package @ latest | License | Install hooks | Runtime deps | Peers / fit | Decision |
|---|---|---|---|---|---|
| `three@0.187.0` | MIT | none | **0** | — | **Use** (core engine + its own `examples/jsm` addons: OrbitControls, RoomEnvironment, RoundedBoxGeometry, EffectComposer, UnrealBloom, OutputPass) |
| `postprocessing@6.39.6` | Zlib | none | **0** | three `>=0.168 <0.188` (fits 0.187) | Optional, only if the built-in three passes aren't enough |
| `gsap@3.15.1` | GSAP Standard "no charge" | none | **0** | — | Optional, for camera choreography; restriction: no rival no-code animation builder |
| `@react-three/fiber@9.8.2` | MIT | none | 10 | react `>=19 <19.4` (Axiom 19.2.3 OK) | **Defer.** Nice React ergonomics, but 10 extra packages for no visual gain at this stage. |
| `@react-three/drei@10.7.9` | MIT | none | **21** incl. `@mediapipe/tasks-vision`, `hls.js`, `detect-gpu` | — | **Reject for now.** Large supply-chain surface; `detect-gpu` fetches benchmark data from a CDN by default (breaks "no external runtime calls"). |
| `@react-three/postprocessing@3.2.2` | MIT | none | 2 (`maath`, `n8ao`) | needs R3F | Defer with R3F |

**Recommended stack:** vanilla `three` (0 dependencies), in a client-only React component, plus optional `gsap`. This matches the in-chat v4 concept, which used only three and its addons.

**Fallback:** reuse the existing accessible `components/marketing/GovernanceAssembly.tsx` homepage visualization as the 2D, no-WebGL and reduced-motion experience.

**Performance budget (proposed):** 3D chunk ≤ 200 KB gzipped JS, loaded only after the hero is interactive and the section scrolls near view (no impact on first paint); zero external requests (self-hosted, CSP `'self'`); device pixel ratio capped at 1.5 on mobile; render loop paused when off-screen or the tab is hidden; 60 fps desktop and 30 fps mid-range mobile targets; static poster first.

**Side note:** the site CSP allows `connect-src 'self' https:`, which permits any HTTPS origin. Tightening it is a separate security task.

**Blocker:** adding any dependency changes `package-lock.json`, which needs a working `npm install`. That's blocked on Claude's Mac, and CI's `npm ci` rejects a lock that doesn't match `package.json`.
