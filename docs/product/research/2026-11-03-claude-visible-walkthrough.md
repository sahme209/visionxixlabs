# Claude public website — bounded visible walkthrough

November 3, 2026. Actual browser interaction, not source-only notes or a full audit.
User-requested reference research only; vendor claims are not Axiom capabilities.

## Pages and interactions actually observed

1. `https://www.anthropic.com/claude` redirected to `https://claude.com/product/overview`. Read the product hierarchy, task examples, capability/reference links, FAQ and footer. Product menu first Expand only focused during hydration; a later click expanded its grouped Products / Specialized / Capabilities / Extensions / Models / Download/Login destinations. The host then changed to responsive mobile layout before Escape; the old menu target was no longer visible, so **Escape/focus return was not accepted**. No repeated blind keyboard action.
2. On the responsive overview, selected “2. The result” in Action tracking. The page showed an embedded illustrative Slack action-item list; selecting “1. The conversation” returned the initial example. This is a public example, not evidence that a real customer message was sent. Never pressed Modify prompt, login, download, Ask Claude submit or playback/audio.
3. Expanded “What apps does Claude work with?” via the current accessibility control. It revealed connector guidance and an actual Connectors page link. Followed that link; after navigation it resolved to `https://claude.com/marketplace/connectors-plugins`. A Playwright locator had failed while the AX button remained available; actual AX click succeeded, so no unsupported claim of a broken vendor control.
4. Directory initial state showed search, Recommended sort, grouped connectors/plugins, category/type filters and distinct detail versus Add-in-Claude links. No install/add/consent/submission action used.
5. Entered the non-sensitive public query Airflow. URL bound `q=Airflow` and current UI displayed no matching connectors with Clear all filters. This is a point-in-time search response, not proof that the provider supports no Airflow integration. Clear all restored default groups.
6. Opened Filter: focus was on Close, Category and Type disclosed separately. Selected Developer tools and Desktop extension, applied; URL bound both filters and current visible UI showed no matches with recovery. No global completeness/count claim. Clear all restored the default directory; no sort, deep detail, all category permutations, keyboard trap or contrast acceptance claimed.

## Original Axiom decisions

- Keep purpose, tasks and role/operation scope understandable before presenting ecosystem breadth. Link explanatory docs from capabilities rather than burying prerequisites.
- Distinguish sample conversation/result from authentic recorded execution. A public illustrative artifact is not an acceptance receipt.
- Separate browse/detail from connect/install. Axiom planned items must not expose operational consent CTAs.
- Empty results need an obvious recovery that restores both filters and search. Existing approved Axiom catalog has its own implementation/tests; no vendor markup, icons, artwork or copy imported.
- Focus tests must use the current responsive layout. A target disappearing after a host-width change is not evidence of Escape success or a product defect.

## Remaining research

Full Claude navigation/deep destinations, docs layout and support article controls, demo playback/captions, keyboard/responsive/contrast behavior and blocked actions remain incomplete. Cursor remains partial22 canonical pages; ChatGPT, Codex, Harness and Grok also remain partial. No external messages, sign-in, installation, downloads, account change, data submission or provider action occurred.

## Third public page: help article and search

Followed the safety article link observed on Product to `https://support.claude.com/en/articles/13364135-use-claude-cowork-safely`. Actual article presents collection navigation, relative update label, availability, risk, safety measures, user responsibility and related articles. A Copy for LLM control exists but was not pressed; no vendor article copied into Axiom knowledge. Search docs opened with focus in its combo box; a public “permissions” query produced ranked articles with collection context. Escape closed the search; focus landed on the web area, not a proven returned trigger. No claim that its focus return passes Axiom acceptance. Did not submit messenger/contact, copy/share controls, rating or account actions. The direct article/current search are partial documentation research, not vendor security verification. Future Axiom retrieval must use approved versioned content and genuine citations, never treat a vendor promise as Axiom authority.
