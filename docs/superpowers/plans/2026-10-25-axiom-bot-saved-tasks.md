# Axiom Bot Saved Tasks Implementation Plan

> For agentic workers: use superpowers:executing-plans task by task; no additional delegation is required.

**Goal:** Save and resume workspace-bound Bot task drafts with versioned history across app restarts, without execution.
**Architecture:** Dedicated BotTaskDraft and BotTaskDraftEvent storage avoids generic operation-worker pickup. Paired server routes derive tenant and actor; explicit desktop Save is the only upload boundary. Strict bounded inputs, idempotency and ownership/version fences apply to every mutation.
**Tech Stack:** Existing Next.js/TypeScript/Prisma/PostgreSQL and React/Tauri.
**Spec:** outputs/phase1-product-audit/full-app-usability/axiom-bot-next-blueprint.md (user approved saved-task foundation).

## Global constraints
No execution, paid inference, provider writes, credentials, grants, cron, blanket migration or recovered-schema SQL. Preserve current app-session drafts. Do not publish or claim live storage from mock tests. New schema is additive and not applied to production as part of implementation checks.

## Tasks
- [ ] Domain: lib/axiom/bot/savedTaskSchema.ts strict draft/create/update contracts, content hashing, UTF-8 bounds and explicit draft-only projection. RED then GREEN tests.
- [ ] Storage: dedicated Prisma models/additive reviewed migration and lib/axiom/bot/savedTaskRepo.ts; atomic task+history, tenant/creator isolation, idempotent create with immutable request payload check, CAS update. Unit and owned isolated PostgreSQL acceptance; no production migration.
- [ ] Paired API: /api/desktop/bot/tasks and /[id]/history; current session, workspace read/write permission, no API-key fallback, bounded request body, sanitized errors/no-store; route tests.
- [ ] Desktop: typed client methods, explicit Save, saved history/resume, stale/context/unmount result ownership; never auto-upload unsent text; no Run button. Real transport/component regression tests.
- [ ] Verification: exact source preservation/full tests/types/frontend/native; actual macOS save/resume only after service storage route is available. Document local/mock/native/live distinctions and all pending release gates.
