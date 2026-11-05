# Public website Docs: find a guide and follow its navigation

**INTERNAL SOURCE GUIDE — not published or customer eligible.** Owner: Axiom documentation workstream. Author: Codex draft. Genuine human editorial owner: unassigned. Source review date: November 5, 2026. Publication, editorial, authentic media, browser/native/accessibility and retrieval acceptance remain false.

This finite guide covers the public `/docs` layout and landing page, their contents disclosure/sidebar, the imported static heading index and its source generator, and the shared article pagination/feedback primitives. It does not cover the native app's Documentation view, the site's global command palette, every article-body link, account setup or actual support submission. Existing [native Documentation](native-documentation-controls.md), [website command palette](website-command-controls.md) and [contact controls](website-contact-controls.md) retain their separate source versions and acceptance limits.

The [source and family ledger](website-docs-navigation-controls.sources.json) pins revision `49c5d4b5de5d9efa03b06e544106404da8387f36`. Its `website.docs.*` labels are documentation IDs, not HTML attributes, lookup selectors, runtime authority or unique rendered instances. All descriptions below are source observations; no browser, server, search request, model call or destination was exercised.

## Start with the work you need to do

Open public Docs from the website's existing navigation. The shared Docs layout surrounds the article with the global navigation/footer and a Documentation contents panel. Global navigation/footer controls are outside this unit. The landing page offers four task groups: **Get started**, **Complete a task**, **Look up a control**, and **Resolve a problem**. Their 15 links lead to setup, workflow, access/plan/surface/term/audit and troubleshooting guides. The ledger preserves each current label, group and literal destination; it does not claim all destinations are available in the current browser or appropriate to your installed product version. [layout, landing]

Before following operational instructions, check the installed version, current access and each guide's supported/preview scope. The landing warnings explicitly distinguish a guide's presence from product activation and tell readers not to resend an uncertain/consumed action. Saved plans, review decisions and dispatch acknowledgements do not prove successful deployment, health or rollback. Navigation itself grants none of these permissions.

| Documentation ID / control | Location and useful next step | Result, limits and recovery |
| --- | --- | --- |
| `website.docs.landing.task-link` — task guide links | On `/docs`, choose the task matching setup, completion, reference or recovery. | Navigates to that literal guide route. No form is sent or workflow executed. If the destination is unavailable, retain the original task/outcome and choose another relevant guide or the support handoff; do not infer failed provider work from a page error. |
| `website.docs.contents.toggle` — **Documentation contents** | At narrow widths, expand/collapse the guide list. Its button exposes `aria-expanded` and the panel ID. | Initially collapsed. At the source `lg` breakpoint (the focus helper checks 1024px), contents stay visible and the toggle is hidden. This is a disclosure, not a modal or a focus trap. Browser/layout/AT behavior is unverified. |
| `website.docs.filter.query` — **Find a guide** | In contents, enter task words, a heading or guide title. | Filters the existing sidebar catalogue locally. It does not fetch a search answer, read article bodies, query private knowledge or invoke AI/charge model tokens. No submit control or Enter-to-select behavior is implemented here. |
| `website.docs.filter.clear` — **Clear guide filter** | Appears whenever the raw query is nonempty, including whitespace. | Clears the query and returns focus to the search field. No remote state or navigation history is cleared. If nothing matches, simplify terms or clear the filter. |
| `website.docs.sidebar.guide-link` — guide links | Choose a matching label beneath a section heading. | Uses the catalogue's literal href. Exact current pathname equality alone adds `aria-current="page"`; parent sections are not treated as current for every descendant. A selected page can be hidden by the active filter. |
| `website.docs.article.previous` — **Previous** | Where one of the inventoried article callers supplies a previous destination, follow its displayed label. | The shared primitive renders that caller's href; if absent, it renders a noninteractive spacer. It does not infer the previous page from browser history or the search results. |
| `website.docs.article.next` — **Next** | Where an article caller supplies a next destination, follow its displayed label. | Same caller-owned behavior as Previous. Not every article is asserted to mount pagination; the landing page does not mount it. |
| `website.docs.feedback.contact` — **Open support request** | The **Still blocked?** card, including the landing page, links to `/contact`. | Opens the contact page; it does not submit a ticket or record a helpfulness vote. Include a failed step/error only through the appropriate later form and never send a password, token or cloud secret. Recording, email and resolution belong to the separate contact guide. |

Source keys: `layout`, `landing`, `contents`, `sidebar`, `primitives`, `route:app/docs/getting-started/page.tsx`, `contact-destination`.

## Understand exactly what the guide filter matches

The sidebar contains 23 literal guide entries in seven sections. The source catalogue, not the count of files under `app/docs`, defines the search universe. The ledger preserves all 23 routes, labels and sections; it does not declare all website articles indexed. No current entry uses the supported `coming-soon` flag. Were one present, the renderer would display a noninteractive disabled span; the count/filter logic still includes matching entries, so a future count would not automatically mean that many navigable guides. [sidebar]

The raw query is trimmed, lowercased and split on whitespace. **Every** term must occur as a substring somewhere in the combined section title, item label and that route's indexed literal summaries/headings. Terms need not be adjacent or appear in the same indexed field. There is no fuzzy ranking, synonym expansion, exact phrase syntax, full-body search, server request or generated answer. An empty/whitespace-only query shows the whole catalogue in its original order. Empty sections disappear from filtered results. [sidebar]

The live status text reports **N guide(s) shown** or **No guides match**. It counts matched catalogue records, not successful destination reads, customer eligibility, available integrations or evidence coverage. Query state belongs to the mounted sidebar. No source effect clears it on a pathname change; it can persist when the shared layout remains mounted, and remount persistence is not promised. Use **Clear guide filter** if a guide seems missing.

The imported JSON index contains only source-extracted literal `DocHeader` title/summary, `DocSection` title and `Callout` title values from the navigation-listed pages. It does not collect arbitrary body paragraphs, dynamic headings, private documentation or support answers. The generator preserves source-file and navigation hashes and finite field/source bounds; the website build preflight compares a newly derived index with the stored JSON. The sidebar itself only consumes indexed fields: it does not perform those freshness/hash checks on each keystroke. This unit does not regenerate the index, execute that build gate or claim current deployed index qualification. [heading-index, heading-generator, heading-build-gate]

## Contents, focus, composition and fragments

Opening the disclosure does not itself focus the search field. While open, ordinary Escape bubbling within its aside prevents/stops that event and collapses the panel. If focus was within the panel on a narrow viewport, closing by that helper returns it to the contents button. Native composition events or keyCode 229 return before the Escape handler; the candidate key is not consumed by this handler. No custom arrow-key navigation or focus trap is supplied. [contents]

A media-query change now preserves focus when the current control becomes hidden: narrowing a collapsed desktop panel moves its focused child to the disclosure; widening while that narrow-only disclosure owns focus moves focus to visible guide search. Focus outside contents, the query and an expanded panel are retained. The modern/legacy media listener is removed on cleanup. This separate [local component repair](../../recovery/2026-11-05/docs-contents-breakpoint-focus/README.md) has controlled component evidence, not real browser/AT acceptance. [contents]

A changed pathname closes the disclosure. The focus helper returns focus only when the viewport is narrow and the panel currently owns focus; it is not a whole-site navigation-focus guarantee. A hash-only or query-string-only change does not change `usePathname`, so this effect is not a promise to close on every URL change. At wide layouts, the panel remains displayed by its responsive classes even when the local open flag becomes false. [contents]

The catalogue and landing task links contain route paths without fragment targets. Shared `DocSection` assigns a section `id` only when the caller supplies one and uses `scroll-mt-24` for anchored placement. It does not create a self-link, hash-navigation controller, focus restoration or proof that every article heading is addressable. Browser fragment scrolling and article-specific anchors remain separate from this finite source inventory. [sidebar, landing, primitives]

## Pagination is explicit, not a generated reading order

`DocFooterNav` uses only its `prev`/`next` props. For example, the inspected Getting started caller supplies **Documentation overview** → `/docs` and **Desktop installation** → `/docs/desktop-install`; this is one example from the 20 shared pagination callsites inventoried below; custom article-body navigation remains excluded. The separate exported `getDocAdjacent` helper flattens the sidebar catalogue, omits coming-soon entries and returns neighbours only for an exact known pathname. It returns no neighbours for unknown routes and one missing neighbour at each end. No current `app/docs` caller uses this helper; the inspected pagination callers supply literal props. The filter never changes that helper's catalogue order. [primitives, route:app/docs/getting-started/page.tsx, sidebar]

Code blocks in the shared primitives are `<pre>/<code>` displays, not copy/run buttons. Callouts, headers, steps and section titles are content primitives, not independent interactive controls. Following a link to instructions does not authorize executing their examples, connecting a provider, creating an account, installing software or changing a release.

## Current shared-pagination destinations

These are the actual literal props at all 20 `DocFooterNav` callsites under the 28 inspected Docs page files, not a generated reading sequence. Labels and exact source ranges are retained in the ledger. The eight pages without this shared primitive are not claimed to lack custom navigation.

| Article route | Previous href | Next href |
| --- | --- | --- |
| `/docs/approval-workflow` | `/docs/releaseops` | `/docs/security-model` |
| `/docs/audit-logs` | `/docs/approval-workflow` | `/docs/troubleshooting` |
| `/docs/aws-setup` | `/docs/integration-setup` | `/docs/approval-workflow` |
| `/docs/azure-setup` | `/docs/aws-setup` | `/docs/gcp-setup` |
| `/docs/desktop-install` | `/docs/releaseops/readiness` | `/docs/releaseops` |
| `/docs/execution-plans` | `/docs/permissions-model` | `/docs/approval-workflow` |
| `/docs/faq` | `/docs/troubleshooting` | `/docs/glossary` |
| `/docs/gcp-setup` | `/docs/azure-setup` | `/docs/security-model` |
| `/docs/getting-started` | `/docs` | `/docs/desktop-install` |
| `/docs/glossary` | `/docs/faq` | Absent |
| `/docs/integration-setup` | `/docs/desktop-architecture` | `/docs/security-model` |
| `/docs/oauth-setup` | `/docs/security-model` | `/docs/permissions-model` |
| `/docs/permissions-model` | `/docs/security-model` | `/docs/approval-workflow` |
| `/docs/releaseops/connectors` | `/docs/releaseops` | `/docs/releaseops/readiness` |
| `/docs/releaseops` | `/docs/rollback` | `/docs/releaseops/connectors` |
| `/docs/releaseops/readiness` | `/docs/releaseops/connectors` | `/docs/desktop-install` |
| `/docs/rollback` | `/docs/approval-workflow` | `/docs/releaseops` |
| `/docs/security-model` | `/docs/aws-setup` | `/docs/troubleshooting` |
| `/docs/source-modes` | `/docs/getting-started` | `/docs/permissions-model` |
| `/docs/surfaces` | `/docs/execution-plans` | `/docs/glossary` |

There are 19 literal shared feedback callsites, separately recorded in the ledger. This does not mean all 28 pages offer the same support card. The five Docs pages absent from the sidebar/heading-index universe are `/docs/architecture`, `/docs/best-practices`, `/docs/desktop-architecture`, `/docs/scanning` and `/docs/terraform-export`. They exist as source destinations but their body controls are outside this unit. Integration setup's explicit Previous link can therefore lead to a page outside the sidebar. Route-source presence is not HTTP/browser readback.

## Finite coverage and outstanding acceptance

- [x] Eight documentation interaction families cover landing links, the contents toggle, filter/clear, sidebar links, shared Previous/Next and contact handoff.
- [x] All current 15 landing and 23 sidebar literal entries are retained in the ledger with their destinations; these sets overlap and are not a sum of unique guides.
- [x] Responsive/disclosure/open/closed behavior, composition/Escape/focus ownership, query matching/count/empty state, active route, future disabled-entry branch and optional pagination states are described from source.
- [x] Static index extraction/build-check boundary, hash/fragment limitations and all 20 shared pagination callsites and 19 feedback callsites are distinguished from runtime search and complete article coverage.
- [ ] Genuine editorial/customer approval, authentic media, deployed-version/destination readback, real browser/OS IME/keyboard/AT/viewport/performance acceptance and executed support retrieval.

This closes only the selected public Docs discovery/navigation source-description unit. Article body controls/links, global menus/footer, the native Documentation view, contact submission/backend outcomes, custom article pagination/navigation, source regeneration, route/server liveness and whole-site/all-B4/B5 acceptance are excluded. This documentation unit changes no runtime HTML metadata, existing guide or source index and no provider state or permission. The separately reviewed focus repair changes only local UI focus behavior; its installed/deployed acceptance remains open.
