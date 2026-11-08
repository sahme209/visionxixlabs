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
