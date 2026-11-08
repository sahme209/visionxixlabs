# Public-repo credential exposure — 2026-11-08 (no secret values recorded)

The user made `sahme209/visionxixlabs` public. Claude scanned every commit on every branch (3,627 commits, ~30 s, values never printed).

**Real-format production credentials found in history** — commit `252d1cf2` (2026-02-26), branch `origin/ai-website-build`; files removed from `main` later, still public in that history:

| Credential | File | Status |
|---|---|---|
| Stripe live secret key (`sk_live_`, full length) | `PRODUCTION_STRIPE_KEYS.md` | Rolled (user-reported 2026-11-08; not independently verified) |
| Stripe webhook signing secret (`whsec_`) | `PRODUCTION_STRIPE_KEYS.md`, `ADD_WEBHOOK_SECRET.md` | Rolled (user-reported 2026-11-08; not independently verified) |
| Resend API key (`re_`) | `EMAIL_CONFIG.md` | Revoked/replaced (user-reported 2026-11-08; not independently verified) |

After rotating, update Vercel env vars `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`. Whether the old keys are still active was **not** checked (no provider calls).

Triaged as non-secret: synthetic Neon test URL (user `synthetic`), fixture AWS/VXL/Stripe strings in tests, a removed `.npmrc` with only `legacy-peer-deps`. Current tree: no real secrets.

Also public now (not credentials): planning/handoff docs, named people/decisions, production Vercel project/team IDs and Neon project/branch IDs.

Recommended: make the repo private until rotation is done; rotation (not branch deletion or history rewrite) is the remedy, since copies may already exist.

**Update 2026-11-08:** user reports all three keys rolled and chose to keep the repo public. Claude did not verify with Stripe/Resend/Vercel. Vercel env vars must hold the new values for payments/email to work.
