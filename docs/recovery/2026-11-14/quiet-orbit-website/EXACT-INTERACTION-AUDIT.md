# Exact interaction audit and Axiom richness direction

Reference: https://exact.framer.ai. Observed November 14, 2026 in the in-app Chromium browser. This is a public template landing page, not evidence that its advertised application exists or works. External accounts were not created, forms were not submitted, and no purchase/install occurred.

## Actual reference checks

- Inventory: 31 anchors in the default rendered landing page, ten major sections plus footer. Both header section navigation and footer navigation were exercised; Features, Use cases, Testimonials, Pricing and FAQ reached their intended sections after animation settled. Some first observations occurred mid-transition; later settled observations supersede them.
- All four use-case choices were clicked: the code sample, explanatory paragraph and CTA changed. This is a demonstration, not execution of the displayed code. Alternate use-case CTA destinations were inspected, but not every alternate CTA was separately opened.
- Yearly pricing changes the displayed paid amount from 29 to 23; Monthly was selected again. These template numbers are not Axiom pricing.
- All six FAQ items were opened; multiple answers can remain open. Full keyboard/assistive-technology qualification of every FAQ state is not established.
- Copy produced the displayed installation command; the initially empty clipboard was restored to empty. The command was not executed.
- Header Get Started and all nine default-state outbound download/feature/trial CTAs were clicked. They lead to the Framer template remix login, not a demonstrated app download. No login followed.
- Other outbound destinations were checked: Typeform, Framer, Discord, LinkedIn, X and creator attribution. These are external destination checks only, not audits of those services. The Discover product new-tab behavior, logo links and Framer badge were inspected as link targets, not each separately clicked. Do not claim every link/state was exhaustively tested.
- Mobile menu opened, selecting Features closed it and scrolled; Escape dismissal was confirmed after its transition completed. An attempted extra close then had no matching element because the menu was already closed; no menu bug is asserted.
- Desktop wheel movement and section scrolling observed. Runtime HTML carries Lenis classes. Three desktop feature cards use sticky top128px, with preceding cards receding (observed scale0.96/0.98). On390px phones cards are relative normal-flow, not sticky. All ten section widths were checked at390px; whole-document width also checked at320px, with no horizontal overflow.
- Reduced-motion preference was emulated and the page reloaded; heading reached full opacity, but Lenis classes persisted. This is not proof of a complete reduced-motion or accessibility pass.

## Measured visual system

| Role | Observed value |
|---|---|
| Main warm black | #0a0908 |
| Charcoal panels | #171615 |
| Primary text | #ffffff |
| Secondary copy | #858585 |
| Code neutral | #bfbdb6 |
| Desktop content rail | 1080px at1280px viewport |
| Main section padding | 96px24px; pricing128px24px |
| Section internal gap | 40px |
| Feature panel radius | 12px |
| Desktop H1 / H2 | Inter Display400,56/56px and36/39.6px |
| Feature title / copy | Inter400,20/24px and16/20.8px |
| Phone H2 | 32px |

Independent public-source review confirmed Framer appearance hooks, a Lenis component, Inter/Inter Display and Fragment Mono in code. No GSAP string in the HTML is not proof that every bundle lacks it. No external fonts/assets were copied.

## What Axiom takes from it

The owner explicitly named **richness**: a nearly black crisp product window over tactile painted color, restrained warm-charcoal panels, controlled spacing and a coherent scroll rhythm. Original artwork lives behind product frames, never behind explanatory body copy. Keep EOS-inspired original3D as the homepage focal object. Preserve Axiom's real content, labelled illustrations, availability and honest next actions.

Initial local changes: warm canvas/surface tokens; desktop-only Home sticky feature panels; regular flow on phones/short screens/reduced motion; focus raises a selected panel; corrected Support double gutters; PipeFlow grid children can shrink to the phone rail. Product is explicitly excluded from this first sticky pilot. Native scrolling remains the current default; no Lenis package was added. Receding scale choreography is not yet implemented or accepted.

Original built-in image generation created a new painted alpine basin, rather than copying Exact's painting. Full PNG is preserved at work/visual-orbit-preview/assets/axiom-painted-basin-v1.png. Encoded WebP at public/images/marketing/axiom-painted-basin-v1.webp is1774×887 and268292bytes. Encoding changed format only, not composition. Prompt/provenance is in PAINTED-ASSET-PROVENANCE.md. No external generation-credit plugin or CLI/API key was used.

## Actual Axiom checks and remaining coverage

Frozen pre-refinement build: FINAL-BUILD-RESULT.json passes contract,production types andNext compiler once in77.32seconds; no credentials/DB supplied. That receipt predates the latest CSS, home color literals and new painting asset.

Latest browser images use the exact current CSS and painting injected locally over the frozen compiled HTML; they are **CSS-preview evidence**, not a newly compiled release. Painting is an equivalent data URL only inside the temporary browser preview; product source uses a local static asset URL. Temporary styles/emulation were removed or their test tabs closed; preview-only overflow-anchor suppression was not added to product source.

- Home1440×900: black surfaces/painting visible and text clear; source-CSS sticky positions observed.
- Home1024×760: panel heights415,440,396 fit the viewport allowance, no horizontal overflow. Keyboard Tab reached readiness action and focus-within raised its panel. Reduced motion and390px switch panels to static normal flow. Enlarged-text/Safari/performance remain open.
- Home390px painted panel: no horizontal overflow; desktop and phone screenshots saved.
- Security baseline390px overflow447px was reproduced. Equivalent compiled-module CSS shrink correction produces390/390 and320/320 width equality. Source fix is .flow > * {min-width:0}.
- Support320px: nested rail sections now have0px outer+20px inner padding and no horizontal overflow. No forms/payments submitted.
- Integrations search filtered18 to1 for GitHub; phone menu open/Escape closed. Product390px panel inspected without horizontal overflow. Earlier Docs page seen in the preview is not a full Docs interaction audit.
- Latest focused content/hierarchy/truthful-claims suite7PASS/3files; both CSS files parse; WebP decoded metadata valid; whitespace checks pass. Existing mocked Motion whileHover warning retained.
- Independent final scoped source review CLEAR, including painting/labels/black surfaces, gutters, grid shrink and narrowed sticky scope. This is not complete accessibility, native or owner visual acceptance.

Independent page-coverage review identified outstanding Contact and Status public-shell alignment; live sitemap legacy pages capabilities/compare/how-it-works/trust; resources/enterprise-readiness/insights/blog/handbook/manifesto/principles/team/press/design and child articles. Home still has repetitive lower models/CTAs; Product's new wide panels are buried after several substantial sections. Preserve unique facts/controls while consolidating. Redirect routes require destination checks rather than duplicate redesigns.

Next sequence: approve by actual visual feedback within existing local scope, refine richness/composition and Home/Product rhythm, finish Contact/Status, then other live routes. Complete responsive/focus/enlarged-text/reduced-motion/fallback/performance checks before final frozen release validation and normal PR. No whole-site, desktop-install or production acceptance is claimed. Governance remains incomplete/disabled and the production runtime database mismatch remains separate/open. No push/PR/deployment/package/credential/provider/database change occurred.
