# Weekly Summary Email Setup

## Overview

Users can opt in to receive a **weekly summary email** every Monday with:
- Total approvals and RFEs from the past week
- Approvals per day and average processing time
- Similar cases approved (when profile is set)
- Visa Pause recovery metrics (for affected countries)

## Flow

1. **User enables** "Weekly Summary Email" in Settings (Web or iOS)
2. Preference is stored in Firestore: `users/{uid}.weeklySummaryEmailEnabled = true`
3. **Vercel Cron** runs every Monday at 9:00 AM UTC
4. Cron calls `GET /api/cron/weekly-summary`
5. API fetches users with `weeklySummaryEmailEnabled === true`
6. For each user: loads profile, computes stats, sends email via Resend

## Required Setup

### 1. Vercel Environment Variables

Add to your Vercel project:

| Variable        | Description                                              |
|----------------|----------------------------------------------------------|
| `CRON_SECRET`  | Secret to protect the cron endpoint (e.g. `openssl rand -hex 32`) |
| `RESEND_API_KEY` | Already configured for welcome emails                  |
| `RESEND_FROM_EMAIL` | Sender (e.g. `VisaNova <support@visanova.app>`)   |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | JSON string for Firebase Admin (needed for cron) |

Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` when invoking cron jobs. The API verifies this before running.

### 2. Manual Test (Optional)

To test without waiting for Monday:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://visanova.app/api/cron/weekly-summary"
```

Or with secret as query param (for quick tests):

```bash
curl "https://visanova.app/api/cron/weekly-summary?secret=YOUR_CRON_SECRET"
```

### 3. Firestore Rules

The `users` collection already allows users to read/write their own document. No rule changes needed for `weeklySummaryEmailEnabled`.

## Files Added

- `lib/services/weeklySummaryEmailService.ts` - Core logic
- `app/api/cron/weekly-summary/route.ts` - Cron endpoint
- `vercel.json` - Cron schedule (`0 9 * * 1` = Monday 9am UTC)
- Settings: Web (`app/settings/page.tsx`), iOS (`VisaFlow/SettingsView.swift`)

## Resend

Uses your existing Resend setup. Emails are sent from `RESEND_FROM_EMAIL` (or `support@visanova.app`). Ensure your domain is verified in Resend.
