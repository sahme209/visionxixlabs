# Atomic email-proof recovery

Reviewed: 2026-10-15. This patch changes application transaction composition only; it adds no schema, migration, provider, credential, or production operation.

## Failure and recovery boundary

Previously, `/api/auth/verify-email` committed `EmailVerificationToken.usedAt` before a separate `User.emailVerifiedAt` write. If the identity write failed, the user remained unverified and their otherwise valid link was permanently consumed. Retrying the same link returned invalid/used rather than recovering from the transient failure.

The route now claims the unused, unexpired hashed token and updates its owning user inside one Prisma interactive transaction. A failed identity write or failed lookup aborts that transaction, preserving the link for retry while it remains valid. Successful transactions commit proof consumption and verification together. The conditional `updateMany` still admits only one claim. Unknown, expired, used, missing, and oversized tokens remain denied.

An infrastructure/transaction failure returns a generic 503 with retry guidance. No token, account record, email, or database diagnostics are exposed. Success still redirects only to `/auth/signin?verified=1`; it creates no authenticated session, workspace entitlement, pairing approval, or deployment permission. Callback preservation, resend UI, rate-limit redesign, and production schema repair are outside this patch.

## Regression evidence and limits

`app/api/auth/verify-email/__tests__/route.test.ts` models immediately committed non-transactional writes versus isolated transaction drafts that commit together or roll back. Its injected identity-write failure reproduced the original bug: `usedAt` remained populated. With the fix, the same token survives that failure and verifies on retry. Concurrent conditional claims admit one success and one rejection; subsequent replay remains denied. Additional cases cover unknown, expired, used, empty, and oversized proof.

The model tests application transaction boundaries and single-claim behavior, not a running PostgreSQL lock implementation. Existing token helper and authentication-gate regressions are run alongside it. Real production email delivery, migration readiness, password/OAuth sessions, and desktop pairing remain separately gated and unverified.
