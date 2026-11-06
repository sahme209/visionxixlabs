# Product / Docs navigation: bounded source findings

November 5, 2026 · local source review only. No UI edits, browser/network activity, tests or route requests. B1 reference research remains partial; B4 requires exact control labels, location, prerequisites and traceable documentation, not source presence promoted to customer acceptance. This report does not repeat the diagram findings.

Correction status: root applied the two bounded text changes below; independent source-diff review found them consistent with the findings. Integration setup now says “Apps & skills.” Getting started now distinguishes desktop workflows from the signed-in web companion, qualifies its functions by workspace access/enabled features and explicitly says desktop pairing does not execute an operation. The diff leaves secret-handling, operator/user responsibilities, live-validation and other authority warnings unchanged. Findings below retain the original observation for traceability; both caption issues are corrected in local source only. No test, browser, publication or customer-acceptance result is asserted.

## 1. Integration instructions name an obsolete desktop destination

`app/docs/integration-setup/page.tsx:32` tells the operator to use **“Plugins & Skills”** after service configuration. The current navigation label is **“Apps & skills”** (`desktop/src/lib/customerNavigation.ts:18`), confirmed by the actual mounted view heading (`desktop/src/views/PluginsSkillsView.tsx:183`) and command label (`desktop/src/components/WorkspaceCommands.tsx:8`). Following documentation by its exact words therefore does not match the current visible destination.

Action: update that destination caption to Apps & skills in the next authorized documentation correction. Preserve the operator/workspace-user separation, all secret handling warnings and the need for actual validation. Do not change routes, connection behavior or the historical exact-version source guides. The alternative Settings path is outside this finding and should be checked independently before changing it.

## 2. Getting started understates the signed-in website's purpose

`app/docs/getting-started/page.tsx:28–29` calls the installed app “the product,” describes the website as information/docs/sandbox/downloads, and says browser identity-provider approval pages are not a separate web application. In contrast, Product expressly names a **Web companion** for approved provider consent, profile, help and connection context (`app/product/page.tsx:16`). Current source also has a signed-in integration surface with workspace/authentication checks (`app/control/integrations/page.tsx:80–81`); `/account/integrations` redirects there (`app/account/integrations/page.tsx:3–4`). This is a source-present web responsibility, not just a desktop pairing page.

Action: scope the Getting started callout to desktop operational work while acknowledging the existing web companion responsibilities and their own access checks. Retain the distinction that desktop browser-assisted pairing is authentication rather than execution. Do not turn this correction into a claim that every web action is available, production-activated or currently accepted. No new CTA or account journey is needed to repair the copy.

## Route-check scope and remaining evidence

The reviewed Product and Docs-index literal destinations have corresponding current route source files, including the dedicated execution-plans/source-modes/surfaces/audit guides. No direct missing-route defect was established in this bounded source review; file existence does not establish HTTP success, middleware/auth outcomes, useful article content or live-link acceptance. Navigation's account-required Support label is consistent with the help page's sign-in redirect and was not flagged.

Actual supported-browser destination, keyboard, narrow-layout and screen-reader checks remain separate B1/B6 work; B4 editorial/version/media/customer coverage remains incomplete. No current production, account, connector or release state was queried. The two findings above are current source/caption alignment issues, not evidence of failed runtime controls.
