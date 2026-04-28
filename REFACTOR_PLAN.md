# REFACTOR PLAN: Single-Product Focus

Goal: Turn the codebase into one focused SaaS product — **AI Cloud Operator**.

---

## STEP 1: CORE ROUTES (KEEP)

These are the only routes visible to users after refactoring.

### Public
| Route | Purpose | Currently |
|-------|---------|-----------|
| `/` | Landing page — rewrite to focus solely on Cloud Operator | `app/page.tsx` (mixed consulting + SaaS) |
| `/auth/signin` | Sign in | `app/auth/signin/page.tsx` |
| `/auth/signup` | Sign up (with `?redirect=/dashboard/onboarding`) | `app/auth/signup/page.tsx` |
| `/pricing` | Single pricing page for Cloud Operator tiers | **NEW redirect target** — use `/operator/pricing` content |
| `/contact` | Contact / support form | `app/contact/page.tsx` |
| `/terms` | Legal | `app/terms/page.tsx` |
| `/privacy` | Legal | `app/privacy/page.tsx` |

### Authenticated (Dashboard)
| Route | Purpose | Currently |
|-------|---------|-----------|
| `/dashboard` | **Unified dashboard** — merge current `/cloud-operator?token=X` dashboard view + `/dashboard/resilience` into one | Needs consolidation |
| `/dashboard/onboarding` | Single onboarding flow — based on current `/operator/onboarding` wizard (connect cloud → analyze → see results) | Move from `app/operator/onboarding/` |
| `/dashboard/connectors` | Connector management (deep link into dashboard tab) | Currently a tab inside `/cloud-operator` |
| `/dashboard/terraform` | Terraform jobs (deep link into dashboard tab) | Currently a tab inside `/cloud-operator` |

### Admin (Gated)
| Route | Purpose | Currently |
|-------|---------|-----------|
| `/admin/leads` | Lead management | `app/admin/leads/page.tsx` — keep |
| `/admin/enterprise-dashboard` | Sales intelligence | `app/admin/enterprise-dashboard/page.tsx` — keep |
| `/admin/plan-debug` | Billing debug | `app/admin/plan-debug/page.tsx` — keep |

### Total visible routes: 13
Down from ~56.

---

## STEP 2: ROUTES TO REMOVE, HIDE, OR DECOUPLE

### DELETE (remove page files, add redirects)

These routes serve other products or stale content. Delete the page files. Add 301 redirects to `/`.

| Route | Reason | Redirect to |
|-------|--------|-------------|
| `/builder` | Website Builder — separate product | `/` |
| `/builder/pricing` | Website Builder pricing | `/pricing` |
| `/website-builder` | Alias for builder | `/` (already redirects to `/builder`) |
| `/request` | Website build request form | `/contact` |
| `/request/thank-you` | Website build confirmation | `/` |
| `/visionxix-ai` | Chatbot product | `/` |
| `/visionxix-ai/pricing` | Chatbot pricing | `/pricing` |
| `/visionxix-ai/features` | Chatbot features | `/` |
| `/visionxix-ai-assistant` | Chatbot demo | `/` |
| `/cloud-studio` | Legacy product (if page exists) | `/dashboard` |
| `/apps` | Mobile apps showcase (VisaNova, RecallEase) | `/` |
| `/demo/glowing-effect` | Dev demo | `/` |
| `/demo/realistic-fog` | Dev demo | `/` |
| `/cloud-review` | Lead magnet (already redirects to `/free-review`) | `/` |
| `/free-review` | Lead magnet — consulting framing | `/` |
| `/enterprise-readiness` | Consulting assessment | `/` |
| `/solutions-for-growing-teams` | Consulting packages | `/` |
| `/markets` | Market positioning — consulting | `/` |
| `/services` | Consulting services overview | `/` |
| `/press` | Press releases | `/` |
| `/embed/[botId]` | Bot embed — chatbot product | Remove (no redirect needed, iframe-only) |

### HIDE (move behind `/admin` or gate, not in nav)

These have value for internal use but should not be in the public nav or sitemap.

| Route | Reason | Action |
|-------|--------|--------|
| `/admin/*` | Already gated | Keep as-is, remove from sitemap |
| `/internal/pricing` | Internal reference | Keep as-is |
| `/dashboard/bots/[botId]` | Chatbot product — decouple later | Hide from nav, keep functional for existing users |
| `/insights` | Blog — useful for SEO but not core product | Remove from top nav. Keep pages alive. |
| `/insights/[slug]` | Individual articles | Keep alive, remove from nav |

### DECOUPLE (keep functional, remove from nav, redirect later)

These serve other products. Keep the code working for existing users but remove all navigation links. Plan to extract to separate deployment later.

| Route | Reason |
|-------|--------|
| `/dashboard` (current bot dashboard) | Chatbot product. The new `/dashboard` will be Cloud Operator. Current bot users need a migration path. |
| `/api/bots/*` | Chatbot API — keep functional, remove from nav |
| `/api/chat` | Chatbot API — keep functional |
| `/api/leads/*` | Website builder lead pipeline — keep functional for existing leads |
| `/api/website-builder/*` | Website builder API — keep functional |
| `/api/cloud-studio/*` | Legacy — keep functional, stop linking to it |
| `/api/visionxix-ai-chat` | Chatbot API — keep functional |
| `/api/visionxix-lead` | Chatbot lead capture — keep functional |

### DELETE — Consulting Pages

These position the company as a consulting firm. They conflict with the SaaS product identity.

| Route | Redirect to |
|-------|-------------|
| `/cloud-solutions` | `/` |
| `/cloud-solutions/aws` | `/` |
| `/cloud-solutions/azure` | `/` |
| `/cloud-solutions/gcp` | `/` |
| `/cloud-solutions/[solutionId]` | `/` |
| `/ai-solutions` | `/` |
| `/ai-solutions/ai-automation` | `/` |
| `/ai-solutions/ai-infrastructure` | `/` |
| `/ai-solutions/internal-ai` | `/` |
| `/ai-engineering` | `/` |
| `/cloud-security` | `/` |
| `/case-studies` | `/` |
| `/products` | `/pricing` |

---

## STEP 3: NAVIGATION STRUCTURE

### Top Navigation (Public — Not Logged In)

```
[Logo: Cloud Operator]   How It Works    Pricing    Docs    Contact    [Sign In]  [Start Free →]
```

- **Logo** → `/`
- **How It Works** → `/#how-it-works` (anchor on landing page)
- **Pricing** → `/pricing`
- **Docs** → External link or future route (placeholder, hide until ready)
- **Contact** → `/contact`
- **Sign In** → `/auth/signin`
- **Start Free** (primary CTA) → `/auth/signup?redirect=/dashboard/onboarding`

### Top Navigation (Logged In)

```
[Logo: Cloud Operator]   Dashboard    Pricing    Contact    [user@email.com ▾]
```

- **Dashboard** → `/dashboard`
- **Pricing** → `/pricing`
- **Contact** → `/contact`
- **User dropdown**: Settings, Sign Out

### Dashboard Sidebar

```
Overview          ← Score, cost, security summary
Connectors        ← AWS / Azure / GCP status + connect
Roadmap           ← 30-day improvement plan
Playbooks         ← Phased action items
Terraform         ← Plan / Approve / Apply
Execution Log     ← Audit trail
Export            ← Download report pack
───────────
Settings          ← Account, billing
Ask Axiom         ← AI chat (slide-out, not a route)
```

Each sidebar item maps to a tab in the unified dashboard. They can be defined as:
- `/dashboard` (Overview — default)
- `/dashboard?tab=connectors`
- `/dashboard?tab=roadmap`
- `/dashboard?tab=playbooks`
- `/dashboard?tab=terraform`
- `/dashboard?tab=logs`
- `/dashboard?tab=export`

Or as sub-routes:
- `/dashboard/connectors`
- `/dashboard/roadmap`
- etc.

Query param tabs are simpler to implement (no new page files needed). The current `/cloud-operator` page already uses this pattern with `activeTab` state.

### Primary CTAs (in order of prominence)

1. **"Start Free"** → `/auth/signup?redirect=/dashboard/onboarding`
2. **"Run Axiom"** → `/auth/signup?redirect=/dashboard/onboarding` (if not logged in) or `/dashboard` (if logged in)
3. **"Connect AWS"** → `/dashboard/onboarding` (if logged in) or signup flow

---

## STEP 4: REDIRECT MAP

Add all redirects to `next.config.ts` `redirects()` array.

### Permanent Redirects (301)

```typescript
// Products being removed
{ source: '/builder', destination: '/', permanent: true },
{ source: '/builder/pricing', destination: '/pricing', permanent: true },
{ source: '/website-builder', destination: '/', permanent: true },
{ source: '/request', destination: '/contact', permanent: true },
{ source: '/request/thank-you', destination: '/', permanent: true },
{ source: '/visionxix-ai', destination: '/', permanent: true },
{ source: '/visionxix-ai/pricing', destination: '/pricing', permanent: true },
{ source: '/visionxix-ai/features', destination: '/', permanent: true },
{ source: '/visionxix-ai-assistant', destination: '/', permanent: true },
{ source: '/apps', destination: '/', permanent: true },

// Consulting pages
{ source: '/cloud-solutions', destination: '/', permanent: true },
{ source: '/cloud-solutions/aws', destination: '/', permanent: true },
{ source: '/cloud-solutions/azure', destination: '/', permanent: true },
{ source: '/cloud-solutions/gcp', destination: '/', permanent: true },
{ source: '/cloud-solutions/:path*', destination: '/', permanent: true },
{ source: '/ai-solutions', destination: '/', permanent: true },
{ source: '/ai-solutions/:path*', destination: '/', permanent: true },
{ source: '/ai-engineering', destination: '/', permanent: true },
{ source: '/cloud-security', destination: '/', permanent: true },
{ source: '/case-studies', destination: '/', permanent: true },
{ source: '/services', destination: '/', permanent: true },
{ source: '/markets', destination: '/', permanent: true },
{ source: '/enterprise-readiness', destination: '/', permanent: true },
{ source: '/solutions-for-growing-teams', destination: '/', permanent: true },
{ source: '/free-review', destination: '/', permanent: true },
{ source: '/cloud-review', destination: '/', permanent: true },
{ source: '/press', destination: '/', permanent: true },

// Stale/demo pages
{ source: '/demo/:path*', destination: '/', permanent: true },
{ source: '/cloud-studio', destination: '/dashboard', permanent: true },

// Consolidation
{ source: '/products', destination: '/pricing', permanent: true },
{ source: '/axiom', destination: '/', permanent: true },
{ source: '/axiom/pricing', destination: '/pricing', permanent: true },
{ source: '/operator', destination: '/', permanent: true },
{ source: '/operator/pricing', destination: '/pricing', permanent: true },
{ source: '/operator/onboarding', destination: '/dashboard/onboarding', permanent: true },

// Old cloud-operator form path → new dashboard
{ source: '/cloud-operator', destination: '/dashboard', permanent: true },

// Dashboard consolidation
{ source: '/dashboard/resilience', destination: '/dashboard', permanent: true },
```

### Keep Existing Redirects
```typescript
// Already in next.config.ts — update these:
{ source: '/pricing', destination: '/pricing', permanent: true },  // was → /products, now /pricing IS the page
{ source: '/visionxix-ai/pricing', destination: '/pricing', permanent: true },  // was → /products
```

---

## STEP 5: DASHBOARD CONSOLIDATION

### Current State

Two dashboard experiences:

1. **`/dashboard`** — Bot management (message quotas, bot list). Requires auth. Has layout with header.
2. **`/cloud-operator?token=X`** — Full Axiom dashboard with tabs (Overview, Roadmap, Playbooks, Strategic, Trends, Export, Connectors, Timeline). No auth required. Token-based.
3. **`/dashboard/resilience?token=X`** — Resilience score breakdown. Token-based. Destination of `/operator/onboarding`.

### Target State

One dashboard at `/dashboard`. Auth-required. No token in URL.

**How tokens work today:**
- `/api/cloud-operator/submit` creates a Lead and returns a token
- Token is appended to URL: `/cloud-operator?token=XXX`
- All API calls pass `?token=XXX`
- Token maps to a Lead ID via HMAC verification

**How it should work after:**
- User signs up / signs in → session established
- On first visit to `/dashboard`, if no Lead exists for this user, create one automatically (or show onboarding)
- Lead is associated with `userId` (already supported in Lead model)
- API calls use session auth OR token (both already supported by most endpoints)
- Token fallback preserved for unauthenticated flows (if needed later)

### Migration Steps

1. **Create `/dashboard/page.tsx`** — New unified dashboard page. Base on current `/cloud-operator/page.tsx` dashboard view (the `inDashboard` state). Remove the survey form. The dashboard always shows the tabbed view.

2. **Create `/dashboard/onboarding/page.tsx`** — Move current `/operator/onboarding/page.tsx` here. This is the 4-step wizard: Welcome → Connect Cloud → Analyze → Redirect to `/dashboard`.

3. **Auth gate** — `/dashboard/layout.tsx` already requires auth. The new dashboard inherits this.

4. **Lead resolution** — On dashboard load, resolve the user's Lead:
   ```
   const lead = await prisma.lead.findFirst({
     where: { userId: session.user.id, source: "cloud-operator" },
     orderBy: { updatedAt: "desc" },
   });
   ```
   If no Lead exists → redirect to `/dashboard/onboarding`.
   If Lead exists → show dashboard with that Lead's data.

5. **Remove token from URL** — The dashboard fetches status using the session, not a URL token. Add a new API pattern:
   ```
   GET /api/cloud-operator/status  (session-based, no token param)
   ```
   Falls back to token if provided (backwards compat).

6. **Merge resilience view** — The resilience score breakdown (from `/dashboard/resilience`) becomes the "Overview" tab in the unified dashboard.

### Dashboard Tabs (Final)

| Tab | Source | Shows |
|-----|--------|-------|
| Overview | Merge: `/dashboard/resilience` score view + `/cloud-operator` overview tab | Resilience score, cost/security/infra metrics, environment summary |
| Connectors | `/cloud-operator` connectors tab | AWS/Azure/GCP connection status, inline connect form |
| Roadmap | `/cloud-operator` roadmap tab | 30-day improvement plan |
| Playbooks | `/cloud-operator` playbooks tab | Phased action items |
| Terraform | `/cloud-operator` terraform-related UI | Plan/Approve/Apply |
| Execution Log | `/cloud-operator` + `/api/axiom/execution-logs` | Audit trail |
| Export | `/cloud-operator` export tab | Download report pack |

---

## STEP 6: FINAL PRODUCT STRUCTURE

### Routes (User-Facing)

```
/                              Landing page (Cloud Operator focused)
/auth/signin                   Sign in
/auth/signup                   Sign up
/pricing                       Single pricing page (Free / Pro / Enterprise)
/contact                       Contact form
/terms                         Terms of service
/privacy                       Privacy policy
/dashboard                     Unified Cloud Operator dashboard (auth required)
/dashboard/onboarding          4-step onboarding wizard (auth required)
/insights                      Blog (SEO, no nav link)
/insights/[slug]               Blog articles (SEO)
```

### Routes (Admin-Only)

```
/admin/leads                   Lead management
/admin/enterprise-dashboard    Sales intelligence
/admin/plan-debug              Billing debug
```

### API Routes (Keep)

```
/api/auth/*                    Auth
/api/cloud-operator/*          Core product APIs
/api/connectors/*              Cloud connectors
/api/terraform/*               IaC
/api/architecture/*            Analysis
/api/axiom/*                   Execution
/api/execution/*               Plugin execution
/api/plugins/*                 Plugin registry
/api/admin/*                   Admin
/api/webhooks/stripe           Billing
/api/contact                   Contact form
/api/agents/run                Agent worker
/api/user/leads                User's leads
```

### API Routes (Keep Functional, Stop Linking)

```
/api/bots/*                    Chatbot product (for existing users)
/api/chat                      Chatbot product
/api/leads/*                   Website builder pipeline (for existing leads)
/api/website-builder/*         Website builder
/api/cloud-studio/*            Legacy
/api/visionxix-ai-chat         Chatbot
/api/visionxix-lead            Chatbot lead capture
```

### Files to Eventually Remove (Phase 2)

These page files can be deleted once redirects are in `next.config.ts`:

```
app/builder/                   Website builder pages
app/cloud-solutions/           Consulting pages
app/ai-solutions/              Consulting pages
app/ai-engineering/            Consulting page
app/cloud-security/            Consulting page
app/case-studies/              Consulting page
app/services/                  Consulting page
app/markets/                   Consulting page
app/enterprise-readiness/      Consulting page
app/solutions-for-growing-teams/ Consulting page
app/free-review/               Lead magnet
app/press/                     Press page
app/apps/                      Mobile apps showcase
app/demo/                      Dev demos
app/visionxix-ai/              Chatbot product
app/visionxix-ai-assistant/    Chatbot demo
app/request/                   Website build request
app/axiom/                     Superseded by /
app/operator/                  Superseded by /dashboard/onboarding
app/cloud-operator/            Superseded by /dashboard
app/dashboard/resilience/      Merged into /dashboard
app/dashboard/bots/            Chatbot product (decouple)
app/cloud-studio/              Legacy (if exists)
app/products/                  Superseded by /pricing
```

### Sitemap (After Refactor)

```
/                    priority: 1.0
/pricing             priority: 0.9
/contact             priority: 0.8
/auth/signin         priority: 0.5
/auth/signup         priority: 0.5
/terms               priority: 0.3
/privacy             priority: 0.3
/insights            priority: 0.7
/insights/[slug]     priority: 0.6
```

Dashboard and admin routes excluded from sitemap (auth-gated).

### Navigation Component (After Refactor)

```tsx
// Public nav
const publicLinks = [
  { label: "How It Works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Contact", href: "/contact" },
];

// Auth buttons
const authButtons = session
  ? [{ label: "Dashboard", href: "/dashboard" }]
  : [
      { label: "Sign In", href: "/auth/signin", variant: "ghost" },
      { label: "Start Free", href: "/auth/signup?redirect=/dashboard/onboarding", variant: "primary" },
    ];
```

Three links. Two buttons. One product.

---

## EXECUTION ORDER

Do NOT do everything at once. Sequence:

### Phase 1: Redirects Only (Safe, No Breaking Changes)
1. Add all redirects to `next.config.ts`
2. Update `Navigation.tsx` to show only core links
3. Update sitemap to remove deleted routes
4. Deploy. Verify no 404s.

### Phase 2: Dashboard Consolidation
1. Create `/dashboard/page.tsx` (unified dashboard)
2. Move `/operator/onboarding` → `/dashboard/onboarding`
3. Add session-based Lead resolution to dashboard
4. Update `/dashboard/layout.tsx` with sidebar nav
5. Deploy. Verify onboarding → dashboard flow works.

### Phase 3: Landing Page Rewrite
1. Rewrite `app/page.tsx` as Cloud Operator focused landing
2. Remove consulting copy, mixed CTAs, AWS/Azure/GCP pills
3. Single CTA: "Start Free → /auth/signup"
4. Deploy.

### Phase 4: Cleanup
1. Delete page files for removed routes (redirects handle traffic)
2. Remove unused components
3. Clean up unused API routes (chatbot, website builder) if no active users
4. Remove `AIInvocation` from Prisma schema
5. Update root layout (remove AIChatWidget, StickyMobileCTA if chatbot-related)
