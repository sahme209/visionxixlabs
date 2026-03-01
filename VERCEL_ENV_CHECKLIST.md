# Vercel Environment Variables Checklist

To fix 500/503 errors on `/api/auth/session` and `/api/auth/signup`, add **all** of these in **Vercel → Project → Settings → Environment Variables**:

| Variable | Required | Example | Notes |
|----------|----------|---------|-------|
| `NEXTAUTH_SECRET` | **Yes** | *(32+ char string)* | Run `openssl rand -base64 32` to generate. |
| `NEXTAUTH_URL` | **Yes** | `https://visionxixlabs.com` | Your production URL, no trailing slash. |
| `DATABASE_URL` | **Yes** | `postgresql://...` | PostgreSQL from Neon, Vercel Postgres, or Supabase. |
| `OPENAI_API_KEY` | Yes | `sk-...` | Primary AI provider. Get from https://platform.openai.com |
| `ANTHROPIC_API_KEY` | Recommended | `sk-ant-...` | For PLAN_STRONG, CODE_STRONG, DESIGN_STRONG. Get from https://console.anthropic.com |
| `GEMINI_API_KEY` | Optional | `AIza...` | Fallback provider. Get from https://aistudio.google.com |

**After adding DATABASE_URL**, run migrations once from your machine:
```bash
DATABASE_URL="your_postgres_url" npx prisma migrate deploy
```

**Important:** The `runtime.lastError`, `FrameDoesNotExistError`, `background.js`, `utils.js`, `extensionState.js` errors are from **browser extensions** (ad blockers, password managers, dev tools), not your app. Ignore them.
