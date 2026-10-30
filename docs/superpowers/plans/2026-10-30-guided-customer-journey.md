# Guided customer journey implementation plan

> Execute inline using superpowers:executing-plans, then one final independent code review.

Goal: explain the next safe step and responsible human across current release and action screens without changing authority.
Architecture: pure shared presentation model plus accessible shared panel; map existing trusted data into it. No new backend endpoints, database writes, grants or workflow engine.
Spec: docs/superpowers/specs/2026-10-30-guided-customer-journey-design.md.

- [x] Task1: RED→GREEN pure model tests for requested, approved, dispatching, confirmed receipt, refused, unknown, cancelled, expired, stale; unknown/consumed outcomes cannot suggest resend. Readiness does not grant execution; unsupported states remain unknown.
- [x] Task2: Accessible shared presentation panel and desktop release/action integrations with current actor labels; UI tests prove navigation only/no calls and owner/uncertainty clarity. Reuse exact existing action buttons.
- [x] Task3: Matching authenticated web overview guide using existing destinations, no invented completion/aggregate inbox. Source test for safe links/auth continuity.
- [x] Task4: Locate exact white triangular logo. Preserve old asset until exact replacement identified; prepare one canonical source and all consumers/derivatives only when identified. No guessed logo.
- [ ] Task5: focused tests/types/frontend+production build, final review, commit/bundle/private backup and concrete release review. No paid CI, Vercel deployment or locked-Mac interaction.

Progress: replacement logo confirmed by user as a white triangular mark with transparent background, explicitly not the purple/cyan nodes. Bounded local asset/history/chat-summary searches did not recover it; exact source requested, do not invent/substitute.26 focused tests pass including root-discovered rendered panel tests, desktop type/frontend build passes. Exact final reviewed production build and Next TypeScript checks passed. Final reviewer finding reproduced RED and corrected GREEN; follow-up no important findings. No deployment, CI, provider action or locked-Mac interaction.

October30 update: the exact uploaded white triangular source was supplied, converted reproducibly to transparency, and verified on the live website and signed local apps. Published immutable installers remain unchanged. Further app-wide usability and new Governance workflow review remain in progress; do not treat old source-search notes above as current blockers.
