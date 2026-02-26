# Web → iOS/Android port: Home & Stats (today’s changes)

## Home (web)

### New components
1. **Journey Pipeline**
   - Stages: I-130 = USCIS → NVC → Interview → Visa; I-129F = NOA2 → NVC → Interview → Visa.
   - Data strip (when logged in): Priority date, Form, Est. [stage] date range; row 2: Service center, Country, Path.
   - Step counter: "1/4 Step".
   - Progress bar to center of current step (or 100% on last).
   - Current / Next line: "Current USCIS · Next NVC", "1 of 4 stages".
   - Teaser (logged out): muted pipeline, "Your journey" / "See your stage and estimated dates when you sign in.", "Sign in to see your stage and dates".

2. **On Track card ("Am I on track?")**
   - Compares user priority date to current latest approved PD.
   - States: **ahead** (PD ahead of recent approvals — may hear soon); **close** (within ~3 months); **waiting** (in queue).
   - Copy: "Am I on track? · I-130" (or I-129F), message + sub with dates.

### Section copy
- Section title: **"Your case at a glance"**
- Subtitle: **"Your timeline, queue position, and processing context—all in one place."**

---

## Stats (web)

### Paywall (non‑subscribed)
- Headline: **"Know where you stand"**
- Sub: **"Real data, clear estimates. Unlock Pro to see your case in context."**
- Bullets:
  - Your percentile vs. recent approvals
  - Processing speed and center trends
  - Countdown and timeline range
- CTA: **"Unlock Pro to See Inside"**
- Footer: "Your case in context—updated as new data arrives"

### Subscribed header
- Title: **"Statistics & Insights"**
- Subtitle: **"Processing stats and trends from real data—so you see how the system is moving and where your case fits."**

### Section titles (subscribed)
- Where you stand
- Your progress
- Recent activity
- Processing times
- System activity
- Cases like yours
