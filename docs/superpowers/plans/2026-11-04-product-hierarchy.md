# Product hierarchy implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the approved Product page immediately explain deployment decisions and show its existing conceptual workflow before the scripted demo.

**Architecture:** Recompose `app/product/page.tsx` only: task-explicit headline, desktop headline/support-action columns, existing five-stage `WorkflowEvidenceMap` directly in the opening section. Remove the duplicated lower workflow section; keep all conceptual, installed-version and incomplete-Governance notices in their unchanged component. Existing Navigation/Footer/demo and handler permissions stay intact.

**Tech Stack:** Existing Next/React/Tailwind, Vitest/Testing Library and the already used ordinary offline build/public-read preview pipeline. No new asset, library, permission or provider action.

This is an implementation increment within the user-approved `docs/product/axiom-website-information-architecture.md` and updated B2 requirements, not a new capability or identity boundary. No competitor asset/layout is copied. Root has current UX source critique; rendered browser acceptance is separately gated by existing browser permission. Keep old5210 preview and paired native sessions.

- [x] Write a focused rendered Product hierarchy regression: explicit category/task heading, exactly one conceptual workflow in the first section and before scripted preview, Download plus existing workflow-guide destinations, caveats retained. Mock navigation/footer/heavy demo only; no network.
- [x] Confirm meaningful RED against current Product page.
- [ ] Recompose the approved page without new actions or duplicate workflow. Run only the focused test plus existing workflow interaction compatibility if relevant; independent source review.
- [ ] Commit exact source; one new ordinary offline full build with isolated generated Prisma client and pinned cached engines. No production environment or root dependency mutation. Review exact pipeline before execution.
- [ ] If build succeeds, prepare a fresh safe public-read preview on separate ports, preserve old preview, verify bounded source/HTTP/action-denial facts, and provide the local link. Do not claim browser/visual/AT/performance acceptance without supported observation.
- [ ] Update master/board/evidence and local incremental recovery bundle; no push or deployment under consumed exceptions.

Execution ledger: two Product assertions failed on the original composition; the edited page plus unchanged workflow interactions pass5tests. No browser or pixel acceptance claimed. Ruling: keep the existing map full-width below a two-column headline/support header rather than nesting its own two-column layout in a narrow sidebar; this preserves readable record text and avoids new visual state. All conceptual/availability caveats remain in the original component. Local build/preview and final independent review are still pending.
