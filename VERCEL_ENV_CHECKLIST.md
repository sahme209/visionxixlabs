# Vercel Environment Variables Checklist

To fix 500 errors on `/api/auth/session` and `/api/auth/signup`, add these in Vercel → Project → Settings → Environment Variables:

| Variable | Required | Notes |
|----------|----------|-------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon, Vercel Postgres, Supabase). After adding, run `DATABASE_URL="your_url" npx prisma migrate deploy` locally to create tables. |
| `NEXTAUTH_SECRET` | Yes | Run `openssl rand -base64 32` to generate. |
| `NEXTAUTH_URL` | Yes | Your production URL, e.g. `https://visionxixlabs.com` (no trailing slash). |
| `OPENAI_API_KEY` | Yes | For AI chat. Get from https://platform.openai.com |

**Note:** The `runtime.lastError`, `FrameDoesNotExistError`, and `utils.js/extensionState.js` errors are from **browser extensions** (ad blockers, password managers, etc.), not your app. They can be ignored.
