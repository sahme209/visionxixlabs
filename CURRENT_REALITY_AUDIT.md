# CURRENT REALITY AUDIT

Generated: 2026-04-27
Project: `/Users/samirahmed/Library/Mobile Documents/com~apple~CloudDocs/VisaNova-IOS-Android-Web/visionxixlabs`

---

## STEP 1: ROUTE INVENTORY

### Authentication (2 routes)
| Route | What it does | Status |
|-------|-------------|--------|
| `/auth/signin` | Email/password sign-in form | Active |
| `/auth/signup` | Account creation with plan redirect | Active |

### Main Product Pages (6 routes)
| Route | What it does | Status |
|-------|-------------|--------|
| `/` | Main homepage. Hero with "Run Axiom" CTA → `/cloud-operator`, AWS/Azure/GCP pills → `/cloud-solutions/*` (consulting pages, NOT the tool). Mixed messaging: cloud engineering consulting + SaaS platform. | Active, confused |
| `/cloud-operator` | **THE MAIN TOOL.** Form-based survey → AI analysis dashboard. No auth required. Creates Lead via `/api/cloud-operator/submit`, returns token, reloads as dashboard with tabs (Overview, Roadmap, Playbooks, Connectors, Terraform, Export). | Active, core |
| `/operator` | **DUPLICATE landing page** for "Cloud Operator" product. Separate branding, separate pricing cards (Free/Pro/$149/Enterprise). All CTAs go to `/auth/signup?redirect=/operator/onboarding`. | Active, redundant |
| `/operator/onboarding` | **SEPARATE onboarding wizard.** 4-step flow: Welcome → Connect Cloud (IAM Role) → Analyze → Redirect to `/dashboard/resilience`. Uses `/api/cloud-operator/start` (lightweight) instead of `/submit`. | Active, parallel path |
| `/operator/pricing` | Pricing page for "Cloud Operator" tier. Different from `/axiom/pricing`. | Active, redundant |
| `/axiom` | Educational landing page about Axiom platform. "See how it works" explainer. Links back to `/cloud-operator`. Not the tool itself. | Active |
| `/axiom/pricing` | Pricing page for Axiom. Monthly/yearly toggle. Different framing than `/operator/pricing`. | Active, redundant |

### Dashboards (3 routes)
| Route | What it does | Status |
|-------|-------------|--------|
| `/dashboard` | Bot management dashboard. Lists chatbots, usage quotas, message limits. **Not related to cloud operator at all.** | Active, separate product |
| `/dashboard/bots/[botId]` | Individual bot config page. | Active |
| `/dashboard/resilience` | Resilience scoring dashboard. Destination of `/operator/onboarding` flow. Shows score breakdown, risks, Terraform jobs. Requires `?token=` to function. | Active |

### Website Builder (2 routes)
| Route | What it does | Status |
|-------|-------------|--------|
| `/builder` | AI website generator. Prompt input → HTML preview → deploy. | Active |
| `/builder/pricing` | Builder subscription plans (Starter/Professional/Business). | Active |

### Cloud Solutions — Consulting Pages (4 routes)
| Route | What it does | Status |
|-------|-------------|--------|
| `/cloud-solutions` | Landing page for cloud engineering consulting services. NOT the SaaS tool. | Active, consulting |
| `/cloud-solutions/aws` | AWS consulting page. CTA: "Book a Call" → `/contact`. **This is where users land when clicking "AWS Cloud" pill on homepage.** They expect to connect AWS. They get a contact form. | Active, misleading |
| `/cloud-solutions/azure` | Azure consulting page. Same pattern. | Active, consulting |
| `/cloud-solutions/gcp` | GCP consulting page. Same pattern. | Active, consulting |
| `/cloud-solutions/[solutionId]` | Dynamic solution detail pages. | Active |

### AI Solutions — Consulting Pages (4 routes)
| Route | What it does | Status |
|-------|-------------|--------|
| `/ai-solutions` | AI consulting services overview. Marketing copy, no backend. | Active, consulting |
| `/ai-solutions/ai-automation` | Email classification, support automation. Marketing only. | Active, consulting |
| `/ai-solutions/ai-infrastructure` | Private LLM deployment services. Marketing only. | Active, consulting |
| `/ai-solutions/internal-ai` | Internal AI assistants. Marketing only. | Active, consulting |

### Vision XIX AI — Chatbot Product (3 routes)
| Route | What it does | Status |
|-------|-------------|--------|
| `/visionxix-ai` | Chatbot product landing page. | Active |
| `/visionxix-ai/pricing` | Chatbot subscription pricing. | Active |
| `/visionxix-ai/features` | Features and capabilities page. | Active |
| `/visionxix-ai-assistant` | Live AI assistant demo. | Active |

### AI Engineering (1 route)
| Route | What it does | Status |
|-------|-------------|--------|
| `/ai-engineering` | AI engineering consulting page. Marketing copy only. | Active, consulting |

### Cloud Studio — Legacy (1 route implied)
| Route | What it does | Status |
|-------|-------------|--------|
| `/cloud-studio` | If page exists, it's the legacy predecessor to Axiom. Backend routes exist at `/api/cloud-studio/*`. | Stale, superseded |

### Admin (3 routes)
| Route | What it does | Status |
|-------|-------------|--------|
| `/admin/leads` | Lead management dashboard. Filters, AI package generation, deployment tools. | Active, internal |
| `/admin/enterprise-dashboard` | Sales intelligence. Cloud operator leads with deal signals. | Active, internal |
| `/admin/plan-debug` | Plan lifecycle debugger. Stripe config troubleshooting. | Active, internal |

### Content & Marketing (10+ routes)
| Route | What it does | Status |
|-------|-------------|--------|
| `/contact` | Contact form. "Discuss your requirements." **Where cloud connector CTAs used to point.** | Active |
| `/case-studies` | Engineering case studies. | Active |
| `/press` | Press releases. | Active |
| `/insights` | Blog/insights hub. | Active |
| `/insights/[slug]` | Individual articles. | Active |
| `/products` | Pricing/product overview. | Active |
| `/services` | Services overview. | Active |
| `/markets` | Market positioning page. | Active |
| `/enterprise-readiness` | Enterprise AI readiness assessment. | Active |
| `/solutions-for-growing-teams` | Fixed-scope packages. | Active |
| `/cloud-review` | 20-30 minute cloud review session. Lead magnet. | Active |
| `/cloud-security` | Security consulting page. | Active |
| `/free-review` | Free cloud assessment. Lead magnet. | Active |
| `/apps` | Mobile apps showcase (VisaNova, RecallEase). Unrelated to cloud operator. | Active |

### Other (4 routes)
| Route | What it does | Status |
|-------|-------------|--------|
| `/request` | Website request form for custom build quotes. | Active |
| `/request/thank-you` | Confirmation after request submission. | Active |
| `/embed/[botId]` | Embeddable chatbot iframe. | Active |
| `/demo/glowing-effect` | UI component demo. | Stale/dev |
| `/demo/realistic-fog` | UI component demo. | Stale/dev |
| `/internal/pricing` | Internal pricing reference. | Internal |
| `/terms` | Terms of service. | Active |
| `/privacy` | Privacy policy. | Active |
| `/website-builder` | May be alias for `/builder`. | Active |

### Route Count Summary
- **Total page routes:** ~56
- **Core product routes:** 6 (cloud-operator, operator/*, axiom, dashboard/resilience)
- **Consulting/marketing routes:** ~20
- **Unrelated product routes:** ~8 (builder, bots, visionxix-ai)
- **Admin/internal:** 3
- **Content pages:** ~10
- **Auth:** 2

---

## STEP 2: PRODUCT/FEATURE INVENTORY

### 1. Axiom / Cloud Operator — The Main Product
- **Routes:** `/cloud-operator`, `/operator`, `/operator/onboarding`, `/axiom`, `/dashboard/resilience`
- **Backend:** `/api/cloud-operator/*`, `/api/connectors/*`, `/api/terraform/*`, `/api/architecture/*`, `/api/axiom/*`, `/api/execution/*`
- **Status:** ACTIVE. Core product. Real AI analysis, real cloud connectors, real Terraform execution.
- **Problem:** Split across TWO entry points (`/cloud-operator` and `/operator/onboarding`) with different flows, different APIs, and different destinations.
- **Should stay:** YES — but needs consolidation.

### 2. Website Builder
- **Routes:** `/builder`, `/builder/pricing`, `/request`, `/request/thank-you`
- **Backend:** `/api/website-builder/*`, `/api/leads/*` (13 endpoints)
- **Status:** ACTIVE. AI generates HTML from prompts. Vercel deployment pipeline. Lead capture.
- **Relation to Cloud Operator:** None. Completely separate product sharing the same codebase.
- **Should stay:** Separate concern. Not related to "AI Cloud Operator" vision.

### 3. Vision XIX AI Chatbot
- **Routes:** `/visionxix-ai`, `/visionxix-ai/pricing`, `/visionxix-ai/features`, `/visionxix-ai-assistant`
- **Backend:** `/api/visionxix-ai-chat`, `/api/visionxix-lead`, `/api/bots/*`, `/api/chat`
- **Status:** ACTIVE. Functional chatbot with training pipeline.
- **Relation to Cloud Operator:** None. Completely separate product.
- **Should stay:** Separate concern.

### 4. Bot Dashboard
- **Routes:** `/dashboard`, `/dashboard/bots/[botId]`
- **Backend:** `/api/bots`, `/api/bots/train`, `/api/chat`
- **Status:** ACTIVE. Bot management with usage quotas.
- **Relation to Cloud Operator:** None. Uses the same `/dashboard` URL namespace, which is confusing — `/dashboard/resilience` is cloud operator, `/dashboard` is bots.
- **Should stay:** Separate concern but namespace collision with cloud operator dashboard.

### 5. Cloud Studio (Legacy)
- **Backend:** `/api/cloud-studio/submit`, `/api/cloud-studio/trigger`, `/api/cloud-studio/status`
- **Status:** STALE. Superseded by Axiom. Still has working backend.
- **Should stay:** Should be hidden or removed. Adds confusion.

### 6. Cloud Solutions Consulting Pages
- **Routes:** `/cloud-solutions`, `/cloud-solutions/aws`, `/cloud-solutions/azure`, `/cloud-solutions/gcp`
- **Backend:** None. Marketing copy → `/contact` form.
- **Status:** ACTIVE marketing pages. No product functionality.
- **Problem:** Homepage links "AWS Cloud" pill to `/cloud-solutions/aws` which ends at "Book a Call" contact form. Users expecting to connect AWS get a sales page.
- **Should stay:** Fine as consulting pages, but should NOT be linked from product CTAs.

### 7. AI Solutions / AI Engineering Consulting
- **Routes:** `/ai-solutions/*`, `/ai-engineering`
- **Backend:** None. Pure marketing copy.
- **Status:** ACTIVE marketing. No product.
- **Should stay:** Fine as service marketing. Not related to SaaS product.

### 8. Lead Management (Internal)
- **Backend:** `/api/leads/*` (13 endpoints), `/api/admin/*`, `/api/agents/run`
- **Status:** ACTIVE. Internal tool for managing website builder leads.
- **Should stay:** Internal tooling. Not user-facing.

### 9. Stripe Billing
- **Backend:** `/api/webhooks/stripe`, plan/entitlement logic in `lib/entitlements.ts`, `lib/pricing/membership.ts`
- **Status:** REAL. Plans: Starter ($35/mo), Growth ($75/mo), Scale (custom), Enterprise (custom).
- **Should stay:** YES. Core billing infrastructure.

### 10. Auth (NextAuth)
- **Backend:** `/api/auth/[...nextauth]`, `/api/auth/signup`
- **Status:** REAL. Email/password + JWT sessions.
- **Should stay:** YES.

### 11. Mobile Apps (VisaNova, RecallEase)
- **Routes:** `/apps`
- **Backend:** Separate infrastructure. Not in this codebase.
- **Status:** LIVE on App Stores. Completely unrelated to cloud operator.
- **Should stay:** Separate concern. Showcase page is fine but irrelevant to core product.

---

## STEP 3: BACKEND INVENTORY

### API Routes (52 total)

| Category | Count | Status |
|----------|-------|--------|
| Cloud Operator (submit, start, trigger, status, chat, export, send-report, run-recurring) | ~8 | REAL |
| Connectors (availability, status, link) | 3 | REAL |
| Terraform (generate, plan, approve, apply, jobs/[id]) | 5 | REAL |
| Axiom (execute-fixes, execution-logs) | 2 | REAL |
| Architecture (analyze) | 1 | REAL |
| Execution (run) | 1 | REAL |
| Cloud Studio (submit, trigger, status) | 3 | REAL but STALE |
| Leads (13 endpoints) | 13 | REAL — for website builder |
| Bots (list, create, train) | 3 | REAL — for chatbot product |
| Chat | 1 | REAL |
| Contact | 1 | REAL |
| Auth (signup, nextauth) | 2 | REAL |
| Admin (leads, enterprise-dashboard, plan-debug, aws-broker-test) | ~9 | REAL |
| Agents (run) | 1 | REAL |
| Plugins (list) | 1 | REAL |
| Website Builder (plan, run-axiom) | 2 | REAL |
| VisionXIX AI (chat, lead) | 2-3 | REAL |
| User (leads) | 1 | REAL |
| Webhooks (stripe) | 1 | REAL |

### Cloud Connectors (`lib/connectors/`)

| Connector | Implementation | Feature Flag | Default |
|-----------|---------------|--------------|---------|
| AWS | **REAL** — STS AssumeRole, broker pattern, AES-256-GCM encryption | `ENABLE_CLOUD_CONNECTORS_AWS` | ON (`!== "false"`) |
| Azure | **REAL** — ClientSecretCredential, ARM API verification | `ENABLE_CLOUD_CONNECTORS_AZURE` | OFF (`=== "true"`) |
| GCP | **REAL** — Service Account JSON, ProjectsClient | `ENABLE_CLOUD_CONNECTORS_GCP` | OFF (`=== "true"`) |
| GitHub | **REAL** — Token validation via `/user` endpoint | None | Always on |

### Security (`lib/security/`)

| Module | Status |
|--------|--------|
| `credentialVault.ts` — AES-256-GCM encryption | REAL |
| `auditLog.ts` — Non-blocking database audit trail | REAL |
| `secretRedaction.ts` — Regex-based secret scrubbing | REAL |

### AI Systems (`lib/ai/`)

| Module | Status |
|--------|--------|
| `provider.ts` — Multi-provider abstraction (OpenAI, Gemini, Anthropic) | REAL |
| `orchestrator.ts` — Task-based routing with fallback chain | REAL |
| `chat.ts` — Multi-provider chat with context history | REAL |
| `providers/openai.ts` — OpenAI SDK integration | REAL |
| Agents: `axiomAssistantAgent.ts`, `contactResolutionAgent.ts` | REAL |

### Terraform (`lib/terraform/`)

| Module | Status | Limitation |
|--------|--------|-----------|
| `generator.ts` — Generates .tf files from readiness report | REAL | AWS → Azure Active-Passive only |
| `runner.ts` — CLI execution (init, validate, plan, apply) | REAL | Requires Terraform CLI installed on server |

### Stripe

| Module | Status |
|--------|--------|
| Webhook handler | REAL |
| `lib/pricing/membership.ts` — Plan definitions | REAL |
| `lib/entitlements.ts` — Feature access from plan | REAL |
| `lib/pricing/tiers.ts` — Tier labels and benefits | REAL |

### Feature Flags (`lib/featureFlags.ts`)

| Flag | Default | Purpose |
|------|---------|---------|
| `ENABLE_CLOUD_CONNECTORS_AWS` | true | AWS connector |
| `ENABLE_CLOUD_CONNECTORS_AZURE` | false | Azure connector (real but opt-in) |
| `ENABLE_CLOUD_CONNECTORS_GCP` | false | GCP connector (real but opt-in) |
| `ENABLE_PLACEHOLDER_PLUGINS` | false | Stub plugins (analytics, domain-dns, etc.) |

### Required Environment Variables

**Critical (app won't function without):**
- `DATABASE_URL` — PostgreSQL connection
- `NEXTAUTH_SECRET` — Session signing
- `NEXTAUTH_URL` — Auth callback URL
- At least one of: `OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`

**AWS Connector (required for real cloud connection):**
- `AWS_CONNECTOR_BROKER_ACCESS_KEY_ID`
- `AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY`

**Token/Encryption (required for lead sessions):**
- `STARTER_TOKEN_SECRET` (min 32 chars, also used by credentialVault as fallback)

**Email:**
- `RESEND_API_KEY`

**Stripe:**
- `STRIPE_PRICES_STARTER`, `STRIPE_PRICES_GROWTH`, `STRIPE_PRICES_SCALE`

**Optional:**
- `CREDENTIAL_ENCRYPTION_KEY` (falls back to STARTER_TOKEN_SECRET)
- `AWS_CONNECTOR_BROKER_REGION` (defaults to us-east-1)
- `AI_PROVIDER` (override provider priority)
- `ENABLE_CLOUD_CONNECTORS_AZURE` / `GCP` (off by default)
- `ADMIN_EMAILS`, `VERCEL_TEAM_ID`, `VERCEL_TOKEN`

---

## STEP 4: DATA MODEL INVENTORY (Prisma)

Database: **PostgreSQL**

| Model | References | Status | Serves |
|-------|-----------|--------|--------|
| **Lead** | 128 | ACTIVE — highest usage | Everything. Website builder, cloud operator, contact forms, connectors. Overloaded as the universal entity. |
| **User** | 24 | ACTIVE | Auth, billing, plan entitlements |
| **TerraformExecutionJob** | 21 | ACTIVE | IaC generation and execution |
| **ExecutionLog** | 16 | ACTIVE | Plugin execution audit trail |
| **AxiomScoreSnapshot** | 10 | ACTIVE | Score trend history |
| **Bot** | 9 | ACTIVE | Chatbot product (unrelated to cloud operator) |
| **AgentJob** | 8 | ACTIVE | Async agent queue (contact resolution) |
| **RecurringAnalysis** | 5 | ACTIVE | Scheduled IAM/infra scans |
| **MultiCloudReadinessReport** | 3 | LIGHT | Resilience report storage |
| **AxiomConversation** | 3 | LIGHT | "Ask Axiom" chat persistence |
| **AxiomMessage** | 3 | LIGHT | Chat message storage |
| **AuditLog** | 3 | LIGHT | Security audit trail |
| **KnowledgeSource** | 1 | MINIMAL | Bot training data (chatbot product) |
| **SalesPipelineSnapshot** | 1 | MINIMAL | Admin analytics snapshot |
| **AIInvocation** | 0 | **DEAD** | Never referenced in code |

### Naming Problems

1. **Lead** is overloaded. It stores:
   - Website builder requests (`source: "website-request"`)
   - Contact form submissions (`source: "contact"`)
   - Cloud operator sessions (`source: "cloud-operator"`)
   - Cloud studio requests
   
   One model doing four different things. The `fullPayload` JSON field absorbs all the differences (operator profile, AI package, connector status, preview URLs, form data). This is a bag-of-everything pattern.

2. **No "Project" model.** Everything is a Lead. A cloud operator session that has connectors, terraform jobs, execution logs, and axiom snapshots is still just a "Lead" with JSON blobs.

3. **AIInvocation** exists in schema but has zero code references. Dead table.

4. **SalesPipelineSnapshot** has 1 reference. Designed for Phase 9 admin dashboard. Never fully wired up.

---

## STEP 5: CURRENT USER FLOW

### What a real user can do today:

**Path A — No signup required (fastest):**
```
Homepage (/)
  → Click "Run Axiom"
  → /cloud-operator (sees survey form)
  → Fill in: project type, hosting provider, cloud spend, etc.
  → Submit form
  → /cloud-operator?token=XXX (dashboard view)
  → See: resilience score, cost analysis, security findings, roadmap
  → Can view: Terraform plan, playbooks, strategic brief
  → Can execute: Terraform apply (with CONFIRM APPLY)
  → Can export: Report pack
```

**Path B — Signup required:**
```
/operator (landing page)
  → Click "Start Free"
  → /auth/signup?redirect=/operator/onboarding
  → Create account
  → /operator/onboarding (4-step wizard)
  → Step 1: Welcome
  → Step 2: Select AWS → Set up IAM Role → Paste Role ARN → Validate
  → Step 3: Run Analysis
  → Step 4: Redirect to /dashboard/resilience?token=XXX
```

**Path C — The dead end (most common user mistake):**
```
Homepage (/)
  → Click "AWS Cloud" pill
  → /cloud-solutions/aws (consulting page about AWS services)
  → Scroll to bottom
  → Click "Book a Call"
  → /contact (contact form: "Discuss your requirements")
  → User is confused. They wanted to connect AWS, not book a call.
```

### What works:
- Survey form submission on `/cloud-operator` creates a Lead and returns analysis
- AI scoring engine (resilience, cost, security) generates real output
- AWS connector validation via STS AssumeRole is real
- Terraform generation (AWS → Azure active-passive) is real
- Execution logging and audit trail work
- Token-based session management works
- Rate limiting works at all tiers
- Stripe billing/entitlement logic works

### What is fake/demo:
- Resilience score from the survey form is based on self-reported data, not real infrastructure scan (unless user connects AWS via Connectors tab)
- Azure/GCP connectors are real but disabled by default
- Placeholder plugins (analytics, domain-dns, deployment) are stubs behind feature flag
- The "500+ scans completed" and "99.9% uptime" stats on `/operator` landing page are unverified marketing claims

### What is blocked by env vars:
- AWS connection fails with 500 if `AWS_CONNECTOR_BROKER_ACCESS_KEY_ID` / `SECRET` are not set
- Lead creation fails with 500 if `STARTER_TOKEN_SECRET` is not set
- AI analysis fails if no AI provider key is set (`OPENAI_API_KEY` etc.)
- Email notifications fail if `RESEND_API_KEY` is not set
- Terraform apply fails if Terraform CLI is not installed on the server

### What is confusing:
- Two separate onboarding flows (`/cloud-operator` form vs `/operator/onboarding` wizard) that create different types of Leads via different APIs
- Three pricing pages (`/axiom/pricing`, `/operator/pricing`, `/builder/pricing`) for what might be the same product
- `/dashboard` is for bots. `/dashboard/resilience` is for cloud operator. Same namespace, unrelated products.
- Homepage "AWS Cloud" pill goes to consulting page, not the tool
- Connectors tab used to link to `/contact` ("Get connector access"). Just fixed to have inline form, but previously was a dead end.
- Cloud Studio still has working APIs but is superseded by Axiom. No clear deprecation path.

---

## STEP 6: CLUTTER & CONFLICTS

### Duplicate Pages
1. **`/cloud-operator` vs `/operator`** — Two landing pages for the same product. `/cloud-operator` is the actual tool. `/operator` is a separate branded landing page that routes to a different onboarding flow.
2. **`/axiom/pricing` vs `/operator/pricing`** — Two pricing pages for essentially the same product with different framing.
3. **`/builder` vs `/website-builder`** — Likely aliases for the same page.

### Stale Copy
1. `/operator` landing page claims "500+ scans completed" and "99.9% uptime achieved" — unverified.
2. `/cloud-solutions/aws` page positions Vision XIX Labs as an AWS consulting firm, but the product is a self-service SaaS tool.
3. Various pages reference "Cloud & AI Engineering" as a consulting practice, then link to self-service tools.

### Old Product Names
1. **Cloud Studio** — Legacy product with working backend. Still referenced in APIs and pricing tiers. Should be clearly deprecated or removed.
2. **Cloud Operator** vs **Axiom** — Used interchangeably. `/cloud-operator` is the route, but the UI calls it "Axiom." The branding is inconsistent.
3. **Vision XIX AI** — Chatbot product brand. Shares the codebase but is a completely different product.

### Mixed Visions
The website simultaneously presents as:
1. **A cloud consulting firm** (`/cloud-solutions/*`, `/ai-solutions/*`, `/ai-engineering`, `/services`)
2. **A SaaS cloud operator platform** (`/cloud-operator`, `/operator`, `/axiom`)
3. **An AI website builder** (`/builder`, `/request`)
4. **A chatbot platform** (`/visionxix-ai`, `/dashboard`)
5. **A mobile app company** (`/apps` — VisaNova, RecallEase)

These are five different business identities in one codebase.

### Routes That Should Not Be Public
1. `/admin/*` — Protected by `requireAdmin` but publicly accessible routes exist
2. `/demo/*` — Development demos
3. `/internal/pricing` — Internal pricing reference
4. `/cloud-studio` — Deprecated product

### Features That Distract from AI Cloud Operator Vision
1. **Website Builder** — Complete separate product with its own pricing, 13 API endpoints, and lead pipeline. Shares the database and AI providers. Zero overlap with cloud operator.
2. **Chatbot Platform** — Bot dashboard, training pipeline, embed system. Different customer, different value prop.
3. **Consulting Pages** — Eight+ pages of consulting service marketing that compete with the self-service SaaS positioning.
4. **Mobile Apps Showcase** — VisaNova (immigration tracker) and RecallEase (health reminders). Completely unrelated.
5. **Cloud Studio** — Dead product still consuming mental space and API endpoints.

---

## STEP 7: FINAL CURRENT-STATE SUMMARY

### 1. What this website currently is

A monolithic Next.js codebase containing **five separate products** and a **consulting practice** all sharing one domain, one database, and one deployment:
- An AI cloud infrastructure scanning tool (Axiom/Cloud Operator)
- An AI website builder
- A chatbot platform (Vision XIX AI)
- A consulting services website (cloud + AI engineering)
- A mobile apps portfolio page

### 2. What it is pretending to be

A focused "AI Cloud Operator" SaaS platform that scans your infrastructure, scores your resilience, and deploys multi-cloud failover — "one outage never takes you down."

### 3. What parts are real

- **Cloud connectors** — AWS (production), Azure/GCP (real but disabled by default)
- **AI scoring engine** — Multi-provider (OpenAI/Gemini/Anthropic), real analysis
- **Terraform generation/execution** — Real, limited to AWS→Azure active-passive
- **Credential encryption** — AES-256-GCM, industry standard
- **Stripe billing** — Real plans, real entitlements
- **Auth** — NextAuth with email/password
- **Rate limiting** — Multi-layered (basic, tiered, leads-specific)
- **Audit logging** — Working, stored in database
- **Execution engine** — Plugin-based with entitlement checks and dry-run support

### 4. What parts are clutter

- **8+ consulting/marketing pages** that position the company as a services firm, contradicting the SaaS product
- **Website Builder** (13 API endpoints, separate pricing) — a whole different product
- **Chatbot platform** (bot dashboard, training, embed) — another different product
- **Mobile apps showcase** — unrelated consumer apps
- **Cloud Studio** — dead product with live API routes
- **Three pricing pages** for variations of the same cloud product
- **Two onboarding flows** to the same destination
- **Demo pages** (glowing effect, realistic fog)
- **AIInvocation** Prisma model with zero code references
- **SalesPipelineSnapshot** Prisma model with 1 reference

### 5. What must be cleaned before adding anything else

**Critical (blocking real users):**
1. **Kill Path C.** The homepage "AWS Cloud" pill must NOT go to `/cloud-solutions/aws` (consulting page → contact form). It should go to `/cloud-operator` or `/operator/onboarding`.
2. **Set required env vars** in production: `STARTER_TOKEN_SECRET`, `AWS_CONNECTOR_BROKER_ACCESS_KEY_ID`, `AWS_CONNECTOR_BROKER_SECRET_ACCESS_KEY`. Without these, the entire cloud connection flow returns 500 errors.
3. **Pick ONE onboarding flow.** Either `/cloud-operator` (form survey, no auth) or `/operator/onboarding` (wizard, signup required). Not both. Currently two paths create different Lead shapes via different APIs (`/submit` vs `/start`).

**High priority (causing confusion):**
4. **Consolidate pricing pages.** Three pricing pages (`/axiom/pricing`, `/operator/pricing`, `/builder/pricing`) is three too many for what should be one product. Pick one.
5. **Separate the dashboard namespace.** `/dashboard` (bots) and `/dashboard/resilience` (cloud operator) serve unrelated products. Users of one will be confused by the other.
6. **Deprecate Cloud Studio.** Remove or redirect `/api/cloud-studio/*` routes. The product is superseded.
7. **Fix the Lead model overload.** One Prisma model serving four different product types via a JSON blob is a scaling liability. At minimum, add a `type` discriminator that isn't just `source`.

**Lower priority (polish):**
8. Remove `AIInvocation` from Prisma schema (dead code).
9. Remove or gate `/demo/*` routes.
10. Decide: is this a consulting firm or a SaaS product? The homepage tries to be both and succeeds at neither.
