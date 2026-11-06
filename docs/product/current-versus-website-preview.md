# Current Product / Docs versus available previews

November 5, 2026 · read-only source/artifact comparison. No build, startup, test, browser or network operation performed.

| Surface | Guarded runnable0c9 preview | Compiled999658d6 artifact | Current source |
|---|---|---|---|
| Product page and conceptual workflow | Same source as current | Same source as current | No new diagram/layout implemented; three future concepts remain unselected. |
| Docs index, layout and sidebar | Same source as current | Same source as current | No unshown redesign in these files. |
| Docs breakpoint focus handling | Lacks later resize-focus repair | Contains repair | On narrow→wide, focused disclosure transfers to visible search; wide→narrow with collapsed contents transfers hidden-panel focus to disclosure. This is interaction behavior, not new visual styling. |
| Getting started callout | Older “installed app is the product” wording | Same older wording | “Desktop workflows and the web companion”; explicitly qualified web responsibilities and pairing does not execute. |
| Integration setup caption | Older “Plugins & Skills” destination | Same older wording | Current “Apps & skills” label. |

Comparison: Git diff0c9→999 identifies only `components/docs/DocsContents.tsx` plus its test within the reviewed Product/Docs component scope.999→working source identifies only the two caption files. Shared Navigation/Footer/DocPrimitives and `app/globals.css` show no0c9→current diff. This is scoped source equality, not a claim that all application/backend code matches or every pixel has rendered identically.

Eight ordinary staged-file comparisons independently found the retained999 stage byte-equal to its frozen source for Product, Docs index/layout, both caption guides, WorkflowEvidenceMap, DocsContents and DocsSidebar. The two guide files differ from current source exactly as above. Historical `current-source-check.json` describes its own build moment; it must not be interpreted as current after these edits.

## Minimal next batched preview qualification

1. Decide the purpose: **999 can show the focus repair but cannot show the two corrected captions.** Merely starting it or repointing the old proxy cannot update those compiled pages. Keep the already-shown0c9 Product accurately labelled; no Product rebuild is justified by a nonexistent redesign.
2. To show the corrected guides, include their exact frozen source in the next authorized ordinary website build batch. Preserve old outputs/receipts; do not patch compiled assets or reuse old passing results as new-source evidence. This report starts no build or approval flow.
3. Prepare a separate fixed-source guard/manifest/cache/port binding for whichever completed artifact is chosen. Reuse the reviewed public-only GET policy, synthetic environment and outbound-denied backend; keep account/auth/API/action paths blocked. Do not silently repoint the0c9 launcher, overwrite its manifest or interrupt existing sessions. Reconcile owned listener handles before any authorized startup.
4. At the meaningful showing milestone, verify bounded public delivery and refusal behavior, then inspect the actual guides plus narrow/wide keyboard focus behavior in a supported browser. Label source/version and public-only preview limits. HTTP/source checks do not establish rendered/AT/customer acceptance or make backend activation available.

Artifact coordinates: existing guard source`0c9d0e4072056f56c28d95bf53925afc429ccaf2`, port5262; retained999 source`999658d67487985e45e1354b0b2a5b41103bfe65`, stage `/Users/samirahmed/Library/Application Support/Vision XIX Labs/Axiom Local Website Builds/axiom-signin-current-build-999658d6-kyr6nbqq/stage`. Its successful build did not prepare or launch a new guarded preview. Desktop475 and source-derived catalogue styling are separate presentations; neither proves these website guide corrections are running.
