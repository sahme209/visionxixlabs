# Website email-verification handoff

Reviewed: 2026-10-15. This change repairs the website portion of desktop-origin credentials signup; it does not certify a production customer journey.

## Observed functional blocker

`POST /api/auth/signup` returns `verificationRequired: true` after storing a verification token and accepting email delivery. The website previously ignored this flag, attempted credentials login immediately, and redirected to manual sign-in when that login was rejected. Mandatory email proof therefore looked like a failed signup, with no check-email instruction or explicit route back to the original pairing request.

## Implemented behavior

The signup form now renders a check-email confirmation when verification is required, clears the submitted password from component state, and does not attempt credentials login or navigate away. It retains the already-sanitized desktop callback in a Continue to sign in link and explains how to restart pairing if the request expires. A contact link provides an existing support channel. The account does not gain verification, workspace entitlement, or deployment approval from this UI change.

The existing signup API, verification token lifecycle, OAuth providers, desktop challenge requirement, consent requirement, and legacy response handling remain unchanged. Delivery errors still remain errors and do not show a delivery confirmation.

## Regression evidence

`app/auth/signup/__tests__/verificationHandoff.test.ts` renders the real signup page with simulated HTTP and NextAuth boundaries. Its three cases verify mandatory-proof confirmation without a premature credentials attempt, preserved pairing callback, failed-delivery behavior, and the desktop-origin signup restriction. The mandatory-proof case failed against the previous page and passed after the change.

These tests do not send mail, create real accounts, prove a production callback, or establish an authenticated desktop connection.

## Remaining customer acceptance gates

1. Confirm serving Vercel application and protected preflight use the intended production Neon project, branch and database.
2. Verify recoverable history and restore readiness, then obtain explicit approval for the exact auth-only schema recovery.
3. In an authorized isolated environment, start a real desktop challenge, create a disposable account, receive and consume the verification email, and follow Continue to sign in from the retained signup tab.
4. Verify a successful credentials session resumes the pending challenge and desktop identity exchange. Repeat with an expired challenge to verify an honest restart path.
5. Separately exercise Google and GitHub OAuth, tenant isolation and entitlement denial. Neither provider registration nor successful HTTP responses proves these journeys.

Outstanding issues outside this change include the verification endpoint losing pairing context in the email tab (the retained signup tab preserves it), missing website UI for the existing resend-verification API and recovery after delivery failure, and actual signed desktop installation acceptance. These are recorded as unresolved, not covered by the three regression cases.

## Follow-up recovery milestone (source review)

Reuse `app/api/auth/resend-verification/route.ts`; it already exists. Before claiming reliable proof recovery, make token consumption and user verification atomic in `verify-email/route.ts`, preserve only a strictly validated desktop callback, and add account-neutral resend UI/route regressions. The current separate token-consumption and user-update operations can burn a token if the identity update fails. Resend delivery-error responses also require account-disclosure review. These findings are not fixed by the signup handoff.
