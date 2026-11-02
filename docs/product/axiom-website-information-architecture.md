# Axiom website: information architecture and design proposal

November 2, 2026 · **Internal design draft — not approved, implemented or published.**

This is the B2 design deliverable for the [master action plan](axiom-master-action-plan.md). It proposes an original public experience grounded in current source and six partial reference audits. It does not change runtime behavior, account creation, installer publication, authorization, pricing, production flags or existing source/evidence history. Security, visual quality and understandable next steps are acceptance criteria throughout.

## 1. Intent and chosen direction

Help an engineering operator understand Axiom, assess whether a particular workflow fits, inspect its limits, and find the correct next step. A technical evaluator should reach the relevant permissions and recovery documentation without entering an account or watching a long film. An existing customer should reach a task guide without navigating a sales funnel.

Recommended direction: **a task-led product site with an evidence trail**. Start with repository context → proposed action → independent review → separate requester action → saved outcome/recovery. Use that sequence as a recurring visual explanation, while explicitly distinguishing the capabilities and versions that actually support each part. A conceptual sequence never proves complete executor coverage.

Alternatives considered: a large connector-led catalog makes breadth easy to scan but obscures current support and the primary workflow; an immersive demonstration-first site gives immediate atmosphere but delays prerequisites and can misrepresent scripted success. Retain connector discovery and a short optional tour beneath a clear purpose/next action. This recommendation is the document author's design choice, not a recorded human approval. The user opted out of unnecessary design questions; this deliverable remains a proposal for review, with no implementation authorized by the document itself.

Proposed hero copy: **“Engineering work. With you in control.”** Supporting sentence: “Bring repository context, human review and recorded outcomes into one workspace.” A nearby availability sentence explains that actions depend on the installed version, current access and enabled workflow. Do not elevate “all changes governed,” “autonomous delivery,” “automatic rollback” or “permanent audit” into a site-wide promise.

## 2. Evidence and status rules

Use three explicit content states, with scope beside the state:

| State | Meaning | Required backing before public use |
|---|---|---|
| Implemented | The described behavior exists in the named supported release and surface. | Release/source identification, actual behavior verification and relevant limitations. A route's existence alone does not qualify its claims. |
| Local preview | Source or isolated composition exists, but is not established as shipped/activated/native accepted. | Exact source and receipt, simulated boundaries, default-OFF/coverage limits and missing gates. Public display is optional, never indistinguishable from supported functionality. |
| Planned | Proposed work, including this architecture. | Clearly stated future scope; no operational CTA, date commitment or simulated connected state. |

Current source anchors: [Home](../../app/page.tsx), [Product](../../app/product/page.tsx), [Navigation](../../components/Navigation.tsx), [Footer](../../components/Footer.tsx), [docs shell](../../app/docs/layout.tsx), [demo landing](../../app/demo/page.tsx), [download route](../../app/download/page.tsx), [master status](axiom-master-action-plan.md). These are source observations on November 2, not live-page or current-release acceptance. New uncommitted runtime work must not inherit an earlier build's passing status.

Current claim boundary:

- Existing public routes, account/sign-in flow and download presentation are source-present. Preserve the immutable public v0.1.21 history. v0.1.22 partial artifacts/local corrections are not a completed installer publication; Windows signing/clean-host acceptance remains unresolved/deferred.
- Agent review/requester execution, immutable source observation and deployment baseline admission have local qualification receipts. They do not establish full Governance enrollment, production activation, every mutation path or genuine native/live acceptance. Outstanding legacy bearer and mixed-runtime transition concerns remain explicit.
- A proposed action's source/workflow evidence is not approval authority, artifact integrity, application health or verified rollback. Recording approval does not automatically execute, continue a queue or adopt an old review.
- Historical ServiceNow/connector outcomes remain evidence about their exact operation; they do not authorize a new write or complete the current lifecycle. Never repeat an unknown/consumed action for demonstration.
- All integrations need operation-specific support states. GitLab/sign-in, broader ecosystem work, future support AI and full all-control documentation remain pending. A logo never means connected, supported for every operation or approved.

## 3. Navigation and exact destinations

Desktop header: Axiom logo/Home, **Product**, **Integrations**, **Security**, **Docs**, **Demo**; right side **Download** and a quiet **Sign in** link. Keep Pricing visible in a small “More” disclosure with Support, Status and Company; no hover-only access. This avoids eight equally prominent acquisition buttons. Mobile menu includes every destination below in the same conceptual order. Footer repeats all eight main destinations, then Pricing, Status, Contact, Founding Supporters, Privacy and legal links already present in the existing footer.

| Label/CTA | Destination | Existing source / behavior boundary |
|---|---|---|
| Axiom / Home | `/` | `app/page.tsx`; proposed revised hierarchy is not built. |
| Product / Explore Axiom | `/product` | `app/product/page.tsx`. |
| Integrations / Check connector support | `/integrations` | `app/integrations/page.tsx`; proposed operation filters remain planned. |
| Security / Understand the controls | `/security` | `app/security/page.tsx`; rewrite requires evidence review. |
| Docs / Read the guides | `/docs` | `app/docs/page.tsx`; existing shell, not complete coverage. |
| Demo / Explore the scripted tour | `/demo` | `app/demo/page.tsx`; interactive scripted data, not a live executor. |
| Download / Check available downloads | `/download` | `app/download/page.tsx` → existing DownloadContent; preserve actual artifact selection/readiness. |
| Support / Find help | `/account/help` | `app/account/help/page.tsx`; account-oriented help, preserve actual sign-in behavior. Public support hub proposed at `/help`: **new, not implemented**; do not render a dead link. |
| Sign in | `/auth/signin` | Existing auth route; no new consent, credential or automatic account action. |
| Create account | `/auth/signup` | Existing auth route; secondary only where prerequisites justify it. Do not alter verification/account linking. |
| Pricing / Check plan and usage | `/plans` | `app/(marketing)/plans/page.tsx`; retain actual plan/billing facts and eligibility. |
| Contact / Ask a question | `/contact` | `app/(marketing)/contact/page.tsx`; link only, no automatic form submission. |
| Service status | `/status` | `app/status/page.tsx`; do not imply independently verified uptime. |
| Support Axiom / Founding Supporters | `/support` | Existing `app/(marketing)/support/page.tsx` is funding/sponsorship, **not customer troubleshooting**. Keep that distinction and current checkout readiness. |
| Privacy | `/privacy` | Existing route; preserve current privacy-choice controls. |

“Request a demo” must not imply a booking service exists. If used, label **“Contact us about a demo”** and link `/contact`. No new email address, scheduler, support SLA, paid tier or purchase is invented. New anchors/search/filter controls below are proposed components, not asserted current destinations.

## 4. Concrete page outlines

### Home `/`

1. Calm, left-aligned purpose block, short availability sentence and one primary **Explore Axiom** → `/product`; secondary **Explore the scripted tour** → `/demo`. Download remains in the header.
2. Wide evidence stage: an authentic current-source still when available, with version/surface/capture caption. Until B3 supplies it, use a clearly labeled schematic or retain the existing explicitly scripted presentation; no synthetic screenshot passed off as the app.
3. “From context to outcome”: five stages on one horizontal rail at large sizes, vertical ordered list on phones. Review and requester execution are visibly distinct; unknown outcome leads to read-only recovery rather than a success checkmark.
4. Three job sections: understand repository context; review a proposed change; inspect a saved outcome. Each has one real artifact/caption or a labeled planned evidence placeholder in internal designs only, one limit and one named documentation link.
5. Connector summary with operation/status text → `/integrations`, then concise control explanation → `/security`.
6. Closing next-step pair: **Check available downloads** → `/download`; **Read the setup guide** → `/docs/getting-started`. No fake customer logos, numerical productivity claims or unsupported compliance badges.

### Product `/product`

Hero explains who uses it and what it coordinates. Follow with the workflow rail, then expandable sections for Agent, Releases, Bot, batches and saved evidence. Each section shows: customer job, supported surface/version, prerequisites, actual action boundary, expected record, failure/unknown recovery and a guide link. Existing guide destinations include `/docs/approval-workflow`, `/docs/releaseops`, `/docs/execution-plans` and `/docs/audit-logs`; their current prose still requires claim/version reconciliation before redesign acceptance.

Use an always-visible availability matrix: “Repository assistance,” “Reviewed actions,” “Deployment planning,” “Operational evidence,” with **per-operation** shipped/preview/planned verification rather than a universal green check. Explain baseline-bound approval only for the qualified local scope; do not offer an activation button. Preserve legacy observations as history, never present them as newly valid execution authority. End with `/demo` and `/docs/getting-started`.

### Integrations `/integrations`

Group by customer job: source/CI, cloud delivery, work tracking/change records, communication and orchestration/observability. Proposed accessible filters are **job**, **availability** and **operation**; default shows all states honestly, with planned items visually subordinate. Each connector detail needs provider identity, exact supported reads/writes, account versus organization scope, permissions, credential handling limits, configuration surface, last verified version and safe disconnect/recovery instructions.

Use existing `/docs/integration-setup`, `/docs/oauth-setup`, `/docs/aws-setup`, `/docs/azure-setup`, `/docs/gcp-setup` where applicable. Do not invent per-provider public routes: `/integrations/[provider]` is **new/not implemented** unless separately established. “Configure” may link to the actual authenticated `/account/integrations` only with a clear account-required label; it never silently begins OAuth. Do not turn a catalog card into consent or a credential request.

### Security `/security`

Lead with the operational model, not a badge wall: current identity and scope → exact proposal and independent review → separate requester action → outcome/uncertainty/recovery. Then distinguish product controls, customer configuration, data/credential boundaries, and independent assurance. Every assurance statement gets scope, version/date and an evidence/task link; unsupported assurance is omitted.

Concrete sections: tenant/session/role boundaries; provider connection and permission scope; review/one-attempt semantics; data classes and retention/deletion facts; deployment source-versus-health limits; responsible reporting/contact; explicitly incomplete coverage. Existing reference links: `/docs/security-model`, `/docs/permissions-model`, `/docs/approval-workflow`, `/docs/audit-logs`, `/privacy`, `/contact`. New public evidence center `/security/evidence` is **planned/not implemented**. Do not expose internal receipts, secrets, tenant metadata or sensitive implementation details as public evidence.

### Docs `/docs`

Landing offers four starting paths with distinct labels: **Get started**, **Complete a task**, **Look up a control**, **Resolve a problem**. Preserve existing documentation shell/sidebar routes; improve hierarchy rather than producing a disconnected second docs system. Proposed search returns article title, matched task/control/error, supported version and availability; it is **planned**, not a claim of a working retriever.

| Category | Initial existing destinations | Proposed content work |
|---|---|---|
| Quickstarts | `/docs/getting-started`, `/docs/desktop-install`, `/docs/quickstart-checklist` | OS-specific install/sign-in/workspace/access checks; read readiness; inspect a synthetic proposal; identify outcome/recovery without requiring a live write. |
| Goal guides | `/docs/approval-workflow`, `/docs/releaseops`, `/docs/integration-setup`, `/docs/source-modes` | Explain current actor, exact source, separate review/execution, consumed unknown and where to inspect history. |
| Reference | `/docs/permissions-model`, `/docs/execution-plans`, `/docs/surfaces`, `/docs/glossary`, `/docs/audit-logs` | Stable screen/control help IDs, permission matrix with verified scope, exact states/effects and supported-version selectors. |
| Troubleshooting | `/docs/troubleshooting`, `/docs/faq`, `/docs/releaseops/readiness` | Sign-in/connection/readiness failures; expired/stale review; missing baseline; lost acknowledgment; unknown outcome; safe read-only reconciliation. |

Installation is not synonymous with readiness; account creation is not authority. Never turn a troubleshooting article into a retry instruction for a consumed or uncertain operation. `/docs/rollback` exists but must distinguish actual supported recovery from a general rollback promise. New dedicated baseline/unknown-outcome article URLs are **not implemented**; use reviewed existing destinations until publication is accepted.

### Demo `/demo`

Keep two distinct media classes: **scripted interactive tour** (existing) and **recorded product walkthrough** (requires B3 evidence). Label the class before interaction and in the caption, not only in a footer. The scripted tour has no account/cloud requirement and no authority effect. A recorded preview must name its source/version and simulated boundaries. Never show fictional provider confirmations or genuine-looking approval identities as real acceptance.

Proposed chapters: choose context; inspect evidence; record independent approval; deliberately request execution; inspect confirmed/refused/unknown outcomes. Chapters that lack real accepted evidence remain conceptual/scripted and visibly labeled. Controls: play/pause, chapters, captions, transcript, poster and fullscreen with keyboard return. No autoplay audio, provider calls, autoapproval or download-triggering tour controls. CTA **Read the approval guide** → `/docs/approval-workflow`; **Check available downloads** → `/download`.

### Download `/download`

Keep current artifact/version/source-of-truth selection unchanged. Layout: platform selector → version/architecture/package → exact available artifact/size/hash/signing facts → install guide → known limits → older-release disclosure. Only show an enabled artifact CTA when current readiness actually supplies it; this document specifies no binary URL, new release, size or signing claim. Distinguish public release from local source preview. Surface Windows warnings at decision time; do not imply Store certification or complete v0.1.22 Mac artifacts. Secondary **Installation help** → `/docs/desktop-install`; **Sign in** → `/auth/signin`.

### Support entry

Until a new public `/help` hub is implemented, **Find help** → `/account/help` with clear account context, and public **Troubleshooting** → `/docs/troubleshooting`, **Service status** → `/status`, **Contact** → `/contact`. Keep `/support` labeled Founding Supporters. Proposed hub would present task search, versioned common failures, safe diagnostics guidance and escalation; no invented ticket system, AI agent, response-time promise or automatic diagnostic upload.

Diagnostics copy must identify what will be shared and instruct users to omit credentials/tenant secrets. Preserve original operation IDs privately for approved support channels, not public search or URLs. Future answers cite approved current articles; absence of evidence produces uncertainty/escalation, not inferred permissions.

## 5. Original visual system

Build on the actual [public tokens](../../app/globals.css), [font setup](../../app/layout.tsx) and Axiom brand assets. No copied vendor layouts, illustrations, logos, screenshots, language or proprietary icons.

- **Palette:** canvas `#090a08`, surface `#121310`, elevated `#20211d`, warm-white primary `#f2f2ed`, secondary `#a2a39c`, Axiom orange `#f05a24`. Orange marks a chosen focus/action or a small structural detail; it does not mean successful execution. Existing tertiary `#70716b` is not approved for essential body text until contrast testing. Use explicit text/icons for status and a tested focus color on every surface.
- **Type:** retain Inter for headings/body and JetBrains Mono for versions, hashes and compact metadata. No added font family/download. H1 proposed clamp 40–72px; H2 28–44px; body 16–18px with 1.5–1.7 line height. Avoid tiny uppercase paragraphs; 12–13px metadata remains readable and zoomable. Hashes wrap, with a separately labeled copy control only if later implemented.
- **Composition:** 1200px marketing content maximum, 720px reading column, 24px mobile/40px desktop gutters where space permits; 8px spacing rhythm, 64–112px major-section spacing, 12–20px radius. Use thin neutral dividers and sparse surface layering instead of glowing card grids. Two columns only when both retain readable widths.
- **Ownable motifs:** a restrained orange scope bracket around the selected context; a five-stage evidence rail with review/requester split; a quiet outcome ledger with explicit confirmed/refused/unknown text. These explain state and sequence. Decorative connecting lines never imply active coverage or guaranteed causality.
- **Motion:** short opacity/position transitions for navigation and state clarification, no scroll-jacking or forced cinematic entrances. Respect reduced motion; final content is immediately available without animation. Do not make scrolling, typing or hovering necessary to discover availability limits.
- **Images:** one meaningful product image per section rather than repeated ornamental screen stacks. Crops retain the relevant state/next action; captions explain context outside the image. Enlargements have visible close/back controls and focus restoration. Internal wireframes are labeled design illustrations and cannot enter the authentic evidence library.

## 6. Documentation and evidence field contract

Use the existing [article schema](documentation-coverage/article-record.schema.json), [coverage process](documentation-coverage/README.md) and immutable draft revisions. Do not introduce a conflicting schema through website implementation. Existing required fields: `schema`, `id`, `revision`, `status`, `classification`, `title`, `productVersion`, `screenIds`, `controlIds`, `goal`, `prerequisites`, `permissions`, `steps`, `expectedOutcome`, `limitations`, `recovery`, `searchTerms`, `sources`, `media`, `verification`, `review`, `supersedes`.

| Field group | Content/publication contract |
|---|---|
| Identity and versions | Stable help ID plus immutable revision; supported product version and surface; replacement/supersession retained. Source offsets/candidate IDs are matching aids, not permanent public IDs. |
| Truth status | Article editorial status is distinct from capability availability. Internal draft/source preview cannot be retrieved as an approved shipped answer. Future structured availability fields require explicit schema versioning; until then state scope in limitations/verification and visible copy. |
| Prerequisites and authority | Exact workspace/connection/role/current-session requirements, independent reviewer and original requester distinctions, enabled workflow and relevant expiry. Evidence is never a permission grant. |
| Steps and outcomes | Exact accessible control labels and locations, one effect per numbered step, normal/empty/disabled/denied/stale/expired states, expected actual record and explicit exclusions. Every public CTA has destination, effect and required account context. |
| Source and verification | Exact source paths/hashes, source/runtime version and date, test/composition receipt with simulated boundaries, genuine verification classification. Hash drift quarantines; do not rewrite old accepted bytes. Internal evidence is not automatically public. |
| Media | Actual capture provenance/version/date, synthetic-data designation, safe redaction review, integrity hash, numbered annotation, descriptive alt text; video poster, duration, chapters, captions and transcript. No fabricated reviewer/provider results; missing media remains missing. |
| Recovery | Which saved operation to inspect, what read-only reconciliation can establish, who owns the next step, what cannot be retried/adopted, when to stop/escalate. Unknown is not failure or success; current authority loss never licenses bypass. |
| Editorial lifecycle | Real reviewer/date only after actual review; no fabricated identity or approval. Publish only after current-version/source/media validation. Preserve withdrawn/superseded history and exclude ineligible material from customer retrieval. |

Every supported website/app control and reachable state needs a reviewed mapping or explicit documented exclusion for B4 acceptance. Existing inventory counts are candidates, not completed help. Future B5 retrieval cases must cover exact labels, customer phrasing, wrong version, stale source, missing baseline, expired authority and consumed unknown; answers must cite article ID/revision and refuse unsupported operational instructions. Offline schema/hash/evaluation-format checks do not establish a running retriever or genuine editorial review.

## 7. Responsive, accessibility, cost and proof acceptance

These are proposed acceptance gates, not completed tests:

- Verify 320, 375, 768, 1024 and 1440px widths plus 200% zoom and 400% reflow. No horizontal page overflow, hidden essential status, clipped dialogs or competing sticky headers. Docs becomes one reading column with an explicit menu/search control; its content remains available without a persistent sidebar.
- Complete keyboard journey from skip link through nav disclosures, mobile menu, tour, docs contents and footer. Visible focus, logical order, Escape/close/focus-return, semantic headings/landmarks, accessible names and no keyboard trap. Pointer targets at least 24×24 CSS pixels with appropriate spacing; prefer 44px primary controls. Test screen-reader status announcements without announcing decorative rails.
- Meet WCAG 2.2 AA contrast and interaction requirements, including disabled/error states where applicable, caption/transcript alternatives and reduced motion. Never use color alone for supported/preview/planned or outcome states. Automated scans supplement actual keyboard/screen-reader review; they do not certify compliance.
- Target field Core Web Vitals at the 75th percentile: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; initially use documented lab profiles, then actual field data when available. Proposed performance budgets: first-view compressed media ≤300KB, no above-fold video download before intent, no new font family or third-party demo dependency. Measure actual route/script weight against the existing baseline before setting a hard JS budget; report regressions and reasons.
- Responsive image sizes/modern formats, fixed dimensions and lazy loading below the fold; video poster first, explicit load/play, no duplicate hidden downloads. Hosting/encoding/analytics costs require review; no new paid service, CI run, model invocation, data capture or provider request follows from this plan. Preserve optional-measurement consent and privacy-choice recovery.
- Maintain a CTA ledger with route, label, account requirement and effect. Test all destinations/anchors, unavailable artifacts, back navigation, authenticated/unauthenticated states and mobile variants without submitting forms or provider actions. New routes/components are visibly tracked as planned until real checks pass.
- Claims ledger must bind each material capability/security/platform/cost statement to exact version and evidence. No borrowed certifications, uptime, savings, customer identities, full-coverage or permanent-retention claims. Real screenshots, media and signed artifacts need their own acceptance, not source-presence inference.

## 8. Research provenance and design rationale

No new browser interaction was performed for this document. Supported browser control is currently unavailable; this is not permission to use a hidden or alternate browser. The six saved audits contain partial visible observations and explicitly separated source-only reading. Their original remaining checklists remain open.

| Saved reference | Principle translated into original Axiom design | Boundary retained |
|---|---|---|
| [Cursor](../research/website-audit/cursor.md) | Purpose first; task-oriented docs; Security → configuration task → effective value/scope → verification/recovery. | Partial visible journeys; some source-only research and unfinished controls/mobile/keyboard checks. No copied assurance/retention claims. |
| [ChatGPT](../research/website-audit/chatgpt.md) | Goal-based entry points and ordered setup; explicitly labeled interactive illustration. | Illustration is not an account setting or operational action; partial audit only. |
| [Claude](../research/website-audit/claude.md) | Concise purpose, authentic captioned proof, connector/permission explanation linked to tasks. | Vendor capability/role tables do not establish Axiom support. |
| [Codex](../research/website-audit/codex.md) | Progressive setup/reference hierarchy; support citations tied to current approved documentation. | Future retrieval neither exists by documentation alone nor grants authority. |
| [Grok](../research/website-audit/grok.md) | Strong primary task and restrained progressive disclosure. | Sparse entry cannot replace operational evidence/recovery; initial audit, not full acceptance. |
| [Harness](../research/website-audit/harness.md) | Governed delivery story; separate product controls, assurance and task guides with scope/evaluation/recovery. | Root-visible delivery navigation is distinct from source-only security/docs; no vendor badge or deployment promise transfers. |

## 9. Full B1–B6 gap mapping and handoff

| Master item | This draft advances | Still required |
|---|---|---|
| B1 Research | Concrete cross-reference design decisions grounded in six saved partial audits. | Remaining visible destination/control, responsive/keyboard and blocked-page checks. No full-audit claim. |
| B2 Architecture/design | Exact hierarchy, page outlines, CTA destinations, status model, original visual system and acceptance criteria. | Genuine design approval, reviewable responsive page designs and actual implementation. This document alone does not complete B2. |
| B3 Authentic demos | Media classes, capture provenance, chapters and accessible alternatives specified. | Current-source native/browser captures, safe fixtures/redaction, exact version and genuine review. No new media supplied. A3/A4 acceptance dependencies retained. |
| B4 Every-control docs | Concrete docs organization and existing structured-record contract. | Complete screen/control/state inventory, current media, genuine editorial review and supported-release publication. Existing internal draft integrity is not customer approval. |
| B5 Support foundation | Version/citation/uncertainty/recovery requirements and retrieval test categories. | Reviewed ingestion/update/security architecture, actual version-matched retrieval and executed evaluation; cloud data-boundary approval separately. |
| B6 Delivery | Route/CTA, accessibility, responsive, media, performance/cost and claims gates specified. | Source implementation, independent review, exact builds and authorized publishing/live verification including favicon/download facts. No deployment authorization here. |

Suggested local implementation slices after design review: navigation/CTA ledger and static page hierarchy; truthful capability/connector cards; docs taxonomy and versioned article presentation; authentic accepted media; final integrated responsive/accessibility/performance/claims review. Keep source ownership and evidence batches separate from publishing authority. Do not let visual work displace A2 coverage/enrollment, A3 genuine lifecycle evidence, A4 native acceptance, A1 release gates or deferred A5–A8 obligations.
