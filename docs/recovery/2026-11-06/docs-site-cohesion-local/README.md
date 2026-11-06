# Docs site cohesion — bounded local source change

November6,2026. Two-file correction following the user's report that Docs looked different from the rest of the website. Existing preview/source64eca and its saved screenshots remain historical evidence of the preceding design. This correction is not rebuilt, browser-accepted or published.

## Correction and exact source

Product/Security already use the shared `axiom-canvas`,1280px content and medium-weight restrained headings. Docs retained a standalone#141414/1400px shell and legacy bold display headings with per-header aurora/last-word underline. The correction reuses the existing website style; it introduces no new visual framework.

- `app/docs/layout.tsx`: only three class strings change. Shared canvas,1280px content, and existing public-site20/32/40px gutters/top spacing replace the separate shell. Before SHA256 `43374b3a74c3aab6138a37d6b73fcc93cf22ffd7db05f1dc54482214043ea8ce`; after `73859c8329a993a17e2148b774ef911823313f7b1bb9b3378defbd8068adc9d1`.
- `components/docs/DocPrimitives.tsx`: DocHeader renders the supplied title directly, using the site's medium-weight Inter hierarchy and neutral kicker. Header-only decorative auroras/last-word underline and their splitting code are removed. DocSection h2 uses medium weight. Before SHA256 `3eb9731b506f791a72acdff33b7559057371eddc4adbe72133cb75c3f7c72fb9`; after `3bc783d41466159f120acedaa6336bb3544b6ccf7edf6551c0813658624a26ec`.

## Preservation and verification

Layout element structure, main landmark, children, shared Navigation/Footer and DocsContents remain unchanged. Sidebar/filter/contents interactions, guide destinations, active navigation, anchor IDs, help IDs, all status/availability/uncertainty wording, controls and handlers are untouched. DocHeader retains the same typed title/summary/kicker/number props, conditional kicker and h1/p semantics; the old decorative title splitting is replaced by the exact supplied title. DocSection retains its section/id/kicker/children and h2 semantics. Callout, TrustGrid, DocFooterNav, feedback and all other primitive functionality remain intact. Post-header primitives are byte-identical; pre-header primitives differ only in the DocSection heading class. No content/data source or authority changes.

Author verification: scripted non-class layout preservation, pre-header primitive non-class preservation and post-header byte identity passed; `git diff --check` passed. No class-mirroring tests, build, server/browser interaction, new dependency, native restart or production action. Earlier inset correction is superseded by removal of the decorative header wrapper itself; no global overflow mask was added. Actual responsive/type/cross-page visual/keyboard/AT/contrast/performance acceptance remains pending on a later exact candidate delivery.

## Separate independent source review

Parent relayed the completed independent `offline_diagnostic_review` examination of these exact two files:

> No important defects found. Content, heading semantics, landmarks, anchor IDs, and navigation remain intact. Shared canvas and restrained typography improve cohesion; source review alone does not establish visual/browser acceptance.

This is a separate agent's source-only review, not the visual author's self-review or browser acceptance. Source bindings are in `source-bindings.json`.

## Tool-category correction

Earlier visual-worker wording treated Hairline/Teardown too loosely as general design workflows. Their actual upstream tools concern **interactive isometric figures** (Hairline) and **3D machine simulators** (Teardown); they are not UX-audit or typography tools. Reading their master requirements or deciding they do not fit this task is not a completed upstream tool/security/license/compatibility evaluation. They are not used for this shell/type correction. Their meaningful-diagram research/pilot and adoption gates remain separate and open. The master already states their scope accurately; no master edit is needed or made.

No stage/commit. Master/board, frozen image procedure/package/source64eca and open apps/drafts remain untouched.
