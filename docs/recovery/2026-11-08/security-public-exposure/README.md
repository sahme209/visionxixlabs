# Public-repo credential exposure — 2026-11-08 (no secret values recorded)

The user made `sahme209/visionxixlabs` public. Claude scanned every commit on every branch (3,627 commits, ~30 s, values never printed).

**Real-format production credentials found in history** — commit `252d1cf2` (2026-02-26), branch `origin/ai-website-build`; files removed from `main` later, still public in that history:

| Credential | File | Status |
|---|---|---|
| Stripe live secret key (`sk_live_`, full length) | `PRODUCTION_STRIPE_KEYS.md` | **Must roll** — not confirmed rolled |
| Stripe webhook signing secret (`whsec_`) | `PRODUCTION_STRIPE_KEYS.md`, `ADD_WEBHOOK_SECRET.md` | **Must roll** — not confirmed rolled |
| Resend API key (`re_`) | `EMAIL_CONFIG.md` | **Must revoke and replace** — not confirmed |

After rotating, update Vercel env vars `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`. Whether the old keys are still active was **not** checked (no provider calls).

Triaged as non-secret: synthetic Neon test URL (user `synthetic`), fixture AWS/VXL/Stripe strings in tests, a removed `.npmrc` with only `legacy-peer-deps`. Current tree: no real secrets.

Also public now (not credentials): planning/handoff docs, named people/decisions, production Vercel project/team IDs and Neon project/branch IDs.

Recommended: make the repo private until rotation is done; rotation (not branch deletion or history rewrite) is the remedy, since copies may already exist.
