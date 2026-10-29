# Session pipeline starts require execution authority

Both session-authenticated pipeline start routes now enforce the existing exact-origin guard and canonical `actions:apply` permission before registering executors, checking entitlements, creating task records or starting work. Existing owner/admin/operator starts retain their behavior. Read-only, security-review, finance-view and unknown roles cannot start execution.

The shared context historically synthesizes `userId` from email if NextAuth does not supply an ID. A new optional `sessionUserId` preserves that distinction without changing legacy consumers. These start routes require and use the actual session ID as their server-owned actor; request metadata cannot replace the actor or workspace.

Eighteen initial RED regressions reproduced missing role/origin/identity checks. Review then caught the email-fallback distinction; two additional RED cases through the actual context resolver reproduced it. The complete focused checks passed: twenty-four route cases, four resolver-backed cases and eight existing context-authority cases. Final full suite: 10009 passed, zero failed, 107 skipped. Final TypeScript and production build passed; live release status is recorded separately. Independent final review found no blocker.

This does not alter API-key pipeline routes or grant new roles, model access or tool permissions. Tests performed no real pipeline work, provider inference, repository mutation or customer billing action. Legacy GitHub credential scoping, real repository CI, historical stalled-run recovery and native Agent acceptance remain separate work.
