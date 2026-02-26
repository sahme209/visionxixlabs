# Vision XIX AI — Plan & Usage Enforcement

Message limits and plan features are enforced per [visionxixlabs.com/visionxix-ai/pricing](https://visionxixlabs.com/visionxix-ai/pricing).

## Plans

| Plan       | Messages/month | Pages   | Chatbots | Team   |
|------------|----------------|---------|----------|--------|
| Starter    | 6,000          | 2,500   | 1        | 1      |
| Growth     | 15,000         | 15,000  | 3        | 5      |
| Scale      | 60,000         | 80,000  | 8        | 15     |
| Enterprise | Custom         | 500k+   | Unlimited| Unlimited |
| Demo       | 1,000          | 100     | 1        | 1      |

## Add-ons

- Extra 10k messages: +$25/mo — set `addOn10k: true` on bot doc
- Extra 25k messages: +$49/mo — set `addOn25k: true` on bot doc

## Firestore

- **visionxix_bots** — `{ botId: string }` doc with `plan`, `addOn10k`, `addOn25k`, etc.
- **visionxix_usage** — `{ botId_yearMonth }` doc with `messageCount` (e.g. `demo_2025-02`)

## Setup

1. **Demo bot** — Auto-created on first request when `botId: "demo"`. Plan: `demo` (1k messages/month).

2. **Paid customers** — Create a doc in `visionxix_bots` with:
   - `botId`: unique ID (from Stripe metadata or dashboard)
   - `plan`: `starter` | `growth` | `scale` | `enterprise`
   - `addOn10k`: boolean (optional)
   - `addOn25k`: boolean (optional)
   - `stripeCustomerId`, `stripeSubscriptionId` (optional, for webhooks)

3. **Stripe webhook** — When customer subscribes to a Vision XIX AI plan, call `upsertBot({ botId, plan, stripeCustomerId, stripeSubscriptionId })` to create/update the bot.

## API

All chat requests must include `botId`. The API:

1. Ensures the bot exists (auto-creates demo if `botId === "demo"`)
2. Checks `canSendMessage(botId)` — returns 402 if over limit
3. Calls OpenAI
4. Increments usage via `incrementMessageUsage(botId)`
