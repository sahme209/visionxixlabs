# Browse the Integrations catalog

**Internal draft · unpublished · customer-ineligible.** November15 local logo-grid/FAQ/motion source supersedes the earlier presentation below; current source bindings are in docs/recovery/2026-11-15/framer-website-followup/SOURCE-MANIFEST.json. Historical source-bound website runtime `479ac14adb602a78adae5d4af4829cac460390df` (also present at source `d410`). Local preview only: exact build/HTTP/asset evidence is recorded in `docs/recovery/2026-11-03/website-479ac14a-build-preview`; no new browser, screenshots, keyboard, connected-account or production acceptance is claimed here. No help IDs/UI anchors or approved retrieval record are introduced by this article.

The actual mounted `/integrations` page is a public **catalog**, not your account’s connection screen. Browsing starts no connection, grants no permission and performs no provider action. Availability and operation labels describe the catalog, including preview/planned designs; they do not prove your account has access or that an action can run.

## Find a tool

All four controls change local page state and combine as an intersection. They do not query a provider or change your permissions.

| Actual control | What it does / limitation |
|---|---|
| **Search connectors** | Case-insensitive substring search of the connector **name only**, after trimming surrounding whitespace. It does not search descriptions, documentation, jobs or operation names. |
| **Job** | All jobs, Cloud delivery, Source & CI, Work tracking, Communication, Orchestration & observability or Data. These are catalog categories, not workspaces or account scopes. |
| **Availability** | All availability, Available workflows, Configuration required, Preview or review, Planned. “Preview or review” includes both preview and implementation-review entries. It does not inspect your current connection. |
| **Operation model** | All operation models, Read context, Change workflows or Receive events, derived from existing typed catalog metadata. Choosing Change workflows does not enable a write or grant a scope. |

The polite **“N connectors shown · M in the catalog”** result count updates with the filters. Results use a compact shared-border logo grid; Job still filters the same catalog metadata. **Clear filters** appears when filters are active and results remain; it resets search and all three selectors. If no entries match, **“No connectors match these filters”** explains the empty intersection and offers the same reset. An empty result is not a missing permission or failed connection. Clearing filters does not change availability.

## Read a result card

Each cell shows its name, vendor mark (a generic editor symbol for Visual Studio Code), availability and a passive **Operation models** group. Open the native **Connection details** disclosure for its complete provider-specific limitation paragraph. The Read context / Change workflows / Receive events items are plain descriptive text, not action buttons. A card can list more than one operation model; it can still be planned or under review. Read the limitation paragraph rather than treating a listed operation as supported execution.

Where catalog metadata enables documentation navigation, the ordinary link says **Read setup guide**, **Read preview scope** or **Browse documentation**. It opens the existing documentation/product destination; it does not launch OAuth, connect an account, validate access or execute the described action. Some review entries intentionally link to general documentation because a released customer setup is not verified.

A planned/disabled entry shows **“No setup available yet”** and has no setup link or action. For example, a GitLab card and its operation labels are not a customer-ready GitLab connector/sign-in flow. The catalog’s “Available” label also remains conditional on current account configuration and operation-specific Axiom checks.

## Availability and the next ordinary navigation

The current local page uses six native FAQ disclosures covering browsing, available workflows, required configuration, preview/planned items, production changes and permissions. Opening a summary changes only the disclosure. The preceding five-stage workflow model retains direct selection of Choose, Connect, Read, Propose/review and Act/record; the selected stage explains its parts, intended rule, failure and handoff. It is illustrative, not a current account or Governance qualification. Governance remains incomplete and disabled.

The lower logo rows are decorative, inaccessible to keyboard focus and hidden from assistive navigation because all names/statuses/limits are already in the catalog. A finite4800ms entrance runs only while visible, stops when hidden/out of view and resumes its remaining duration. Reduced-motion or missing observer/media support gives a static view. No loop/player, automatic setup, permission or provider event. This is local source behavior, not yet compiled browser acceptance.

The **Before you connect** links remain Connection guide (`/docs/integration-setup`), Permission model (`/docs/permissions-model`) and Desktop downloads (`/download`). The hero also links to the existing connection guide. No link starts OAuth, creates a connection or downloads an installer directly.

## Source scope and remaining editorial acceptance

Source inspection found no existing catalog-specific guide/control inventory to duplicate. This draft covers the page’s actual filter/card/disclosure/before-connect controls; shared site navigation/footer controls are outside this article. It adds no end-user security guarantee, actual connection inspection or delivery claim. Current native/browser images, keyboard/screen-reader walkthrough, approved exact release binding and genuine editorial review are still required before any customer eligibility or support ingestion.

| Source | SHA-256 |
|---|---|
| `app/integrations/page.tsx` | `8c2df362981ba90618f39daaf704543ddb4cb38880473f3e487df3df746625ce` |
| `components/marketing/IntegrationCatalogBrowser.tsx` | `f0a4bc146b4cdac20ac3e48862145bb6ac855652059d87f966b05c5296e36f41` |
| `lib/integrations/publicIntegrationCatalog.ts` | `e225d21bf0fedc57ed4fc3ba8a5c7ee9eb0cae57110d5167c3dbd9180f554f03` |
| `lib/integrations/integrationRegistry.ts` | `116398a2e8a6c8e41386fda17d7fc4601ca08283e4a42cac642786dfaf91733e` |

November15 finite compiled follow-up:1280/390four/two-column geometry, no horizontal document overflow, search/planned4entries0links/empty/reset, native details Enter and production FAQ Enter observed. Evidence: docs/recovery/2026-11-15/framer-website-followup/REVIEW-AND-RESULT.md. No account action or complete page/control/Safari/performance/assistive/editorial/customer acceptance follows.
