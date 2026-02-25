# Vision XIX AI — Sellable Bot Platform

You now have a **real bot product** to sell. Here's what's implemented.

## What's Built

### 1. Auth
- Sign up (`/auth/signup`)
- Sign in (`/auth/signin`)
- Session (NextAuth + JWT)

### 2. Multi-tenant bots
- Each user can create **bots**
- Each bot has its own **knowledge base**
- Chat API (`/api/chat`) routes to the correct bot by `botId`

### 3. Training pipeline
- **URL** — scrape a website and add content to the bot
- **Raw text** — paste text
- Stored in SQLite via Prisma

### 4. Customer dashboard (`/dashboard`)
- Create bots
- Add training sources (URL or text)
- Copy embed code for each bot

### 5. Embed widget
- `public/embed.js` — floating chat button
- `/embed/[botId]` — chat UI in iframe
- Customers add: `<script src="https://visionxixlabs.com/embed.js" data-bot-id="BOT_ID"></script>`

### 6. Pricing page
- `/visionxix-ai/pricing` — Starter, Growth, Scale, Enterprise
- "Start free trial" → sign up

## How to run locally

1. Copy `.env.example` to `.env` (or `.env.local`)
2. Set:
   - `DATABASE_URL="file:./dev.db"`
   - `NEXTAUTH_SECRET` (run `openssl rand -base64 32`)
   - `NEXTAUTH_URL=http://localhost:3000`
   - `OPENAI_API_KEY` (for chat)
3. Run `npx prisma migrate dev` (already done)
4. Run `npm run dev`
5. Sign up at `/auth/signup`, create a bot, add a URL, copy embed code

## What's next for monetization

1. **Stripe** — wire pricing plans to Stripe checkout
2. **Plan limits** — enforce bot count, message limits, page limits by plan
3. **Usage reset** — monthly message count reset
4. **Vercel Postgres** — switch from SQLite for production

## Files changed/added

- `prisma/schema.prisma` — User, Bot, KnowledgeSource
- `lib/db.ts` — Prisma client
- `lib/auth.ts` — NextAuth config
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/auth/signup/route.ts`
- `app/api/bots/route.ts` — list/create bots
- `app/api/bots/train/route.ts` — add URL/text
- `app/api/chat/route.ts` — multi-tenant chat
- `app/auth/signin/page.tsx`, `app/auth/signup/page.tsx`
- `app/dashboard/` — layout, page, bots/[botId]
- `app/embed/[botId]/page.tsx` — chat UI for embed
- `public/embed.js` — embed script
- `components/Providers.tsx` — SessionProvider
- `types/next-auth.d.ts` — session.user.id
