# AI Cloud Operator — Full Re-evaluation & Architecture Plan

---

## STEP 1: ALIGNMENT ANALYSIS

### Directly Aligned (Keep & Extend)

| Component | Location | Why It Fits |
|---|---|---|
| **AWS Connector (STS AssumeRole)** | `lib/connectors/aws.ts` | Production-grade multi-tenant broker pattern. This is the foundation for all cloud connections. |
| **Execution Plugin Engine** | `lib/execution/pluginEngine.ts` | Entitlement validation, dry-run safety, timeout, audit logging — this is your execution runtime. Keep it. |
| **AWS Plugins** (6 total) | `lib/plugins/aws/` | IAM scan, infra discovery, cost explorer, S3 scan, security group scan, key disable — real cloud operations. |
| **Axiom Assistant Agent** | `lib/agents/axiomAssistantAgent.ts` | AI DevOps engineer with tool-calling, plan generation, workflow execution, CONFIRM APPLY safety — this IS the product. |
| **Workflow Executor** | `lib/agents/axiomWorkflowExecutor.ts` | Multi-step plan execution with prerequisite checks, partial completion, rollback — critical for orchestration. |
| **AI Orchestrator** | `lib/ai/orchestrator.ts` | Multi-provider routing (OpenAI/Anthropic/Gemini) — useful for cost optimization and resilience. |
| **ExecutionLog model** | `prisma/schema.prisma` | Full audit trail with params, results, rollback steps, timing — enterprise requirement. |
| **RecurringAnalysis model** | `prisma/schema.prisma` | Continuous monitoring (daily IAM scan, weekly infra discovery) — differentiator. |
| **Entitlements system** | `lib/entitlements.ts` | Clean plan-based feature gating. Needs relabeling but the mechanism is solid. |
| **Stripe billing** | Webhook + plan model | Already wired. Just needs new plan names and pricing. |
| **Auth (NextAuth + JWT)** | `lib/auth` | Works. 30-day JWT sessions, credential provider — sufficient for B2B SaaS. |
| **Audit logging** | `lib/security/auditLog.ts` | Enterprise compliance requirement. Keep. |
| **Secret redaction** | `lib/security/secretRedaction.ts` | Essential when handling cloud credentials in chat/logs. |

### Irrelevant / Distracting (Remove or Pause)

| Component | Why It Doesn't Fit |
|---|---|
| **Bot / KnowledgeSource models** | Chatbot builder for websites. Has nothing to do with cloud infrastructure. |
| **Website Builder** (`/builder`, website-builder APIs, Lead `source: "website-request"`) | A completely separate product. Dilutes focus. |
| **Cloud Studio** (`/cloud-studio` routes, triggerCore for studio) | Overlaps with Cloud Operator but is a separate surface. Merge useful parts into Operator, kill the rest. |
| **Marketing pages** (`/products`, `/cloud-solutions`, `/insights`, `/press`, `/case-studies`) | Static marketing. Keep only a single landing page. The rest is noise during product build phase. |
| **AI Website Build lead flow** (Lead statuses: `package_generating`, `deploy_generating`, `published`) | Website delivery pipeline. Not cloud infrastructure. |
| **Vercel deploy preview/publish APIs** | Part of website builder. Remove. |
| **SalesPipelineSnapshot model** | Sales intelligence for a consulting business. Not relevant to a SaaS product. |
| **AxiomScoreSnapshot** (18-dimension scoring) | Overly complex for what is effectively a health check. Simplify to 5 core metrics. |
| **Contact Resolution Agent** (`AgentJob.type: CONTACT_RESOLUTION`) | Sales follow-up automation. Not the product. |
| **Board deck generation** | Executive fluff. Not needed in the product until post-PMF. |
| **Embed routes** (`/embed`) | Widget embedding for websites. Irrelevant. |

### Reuse With Modification

| Component | What Changes |
|---|---|
| **Lead model** | Rename to `Project` or `Environment`. Drop website-related fields. Add multi-cloud config. |
| **Cloud Operator page** (46K lines) | Radical simplification. Keep: connector UI, chat, execution results. Kill: health snapshot form, board deck, marketing CTAs. |
| **Connector interface** (`CloudConnectorInterface`) | Currently a contract but Azure/GCP are stubs. Implement them for real. |

---

## STEP 2: MULTI-CLOUD ARCHITECTURE REQUIREMENTS

### Core Principle: Abstract-Execute-Verify

Every cloud operation must follow: **define intent -> generate IaC -> dry-run -> apply -> verify -> log**.

### 2.1 Networking

**Problem:** Each cloud has different VPC/VNet/VPC primitives, different IP ranges, different peering models.

**Architecture:**

```
+-----------------------------------------------------+
|              Unified Network Layer                    |
+-----------------------------------------------------+
|  Transit Gateway (AWS) <-> VNet Gateway (Azure)      |
|       <-> Cloud Interconnect (GCP)                   |
|                                                      |
|  Site-to-Site VPN as universal fallback              |
|  WireGuard overlay for cross-cloud service mesh      |
+-----------------------------------------------------+
```

- **IP addressing:** Allocate non-overlapping CIDR blocks per cloud. Use a `/16` per cloud (e.g., AWS: `10.0.0.0/16`, Azure: `10.1.0.0/16`, GCP: `10.2.0.0/16`).
- **Cross-cloud connectivity:** Use IPsec VPN tunnels between clouds as the baseline. For high-throughput customers, provision dedicated interconnects (AWS Direct Connect, Azure ExpressRoute, GCP Cloud Interconnect).
- **Service mesh:** Deploy a lightweight WireGuard overlay or use Consul Connect / Istio multi-cluster for service-to-service encryption and discovery across clouds.
- **Terraform modules:** `modules/networking/aws-vpc`, `modules/networking/azure-vnet`, `modules/networking/gcp-vpc`, `modules/networking/cross-cloud-vpn`.

### 2.2 Compute

**Strategy:** Kubernetes everywhere. GKE, EKS, AKS as managed control planes. Workloads are containerized and portable.

```
+--------------+  +--------------+  +--------------+
|   EKS (AWS)  |  |   AKS (Azure)|  |   GKE (GCP)  |
+--------------+  +--------------+  +--------------+
|  Node pools  |  |  Node pools  |  |  Node pools  |
|  Spot/Preempt|  |  Spot/Low-pri|  |  Preemptible |
|  Autoscaling |  |  Autoscaling |  |  Autoscaling |
+------+-------+  +------+-------+  +------+-------+
       |                 |                 |
       +------- Federation Controller ----+
              (Karmada or custom CRDs)
```

- **Workload placement:** Cost-optimized by default. Use spot/preemptible for stateless, reserved for stateful.
- **Multi-cluster federation:** Karmada for workload distribution across clusters. The platform generates Karmada PropagationPolicies.
- **IaC:** `modules/compute/eks`, `modules/compute/aks`, `modules/compute/gke` with identical variable interfaces (node count, instance type mapping, autoscaling min/max).

### 2.3 Storage

**Tiered approach:**

| Tier | AWS | Azure | GCP | Replication |
|---|---|---|---|---|
| Object | S3 | Blob Storage | GCS | Cross-cloud sync via Rclone daemon |
| Block | EBS | Managed Disks | Persistent Disk | Velero backup + restore |
| Database | RDS/Aurora | Azure SQL/Cosmos | Cloud SQL/Spanner | Logical replication + pg_dump |
| Cache | ElastiCache | Azure Cache | Memorystore | Application-level cache invalidation |

- **Cross-cloud replication for object storage:** Deploy an Rclone daemon that syncs critical buckets bidirectionally on a configurable schedule (5min for hot, 1hr for warm).
- **Database failover:** Primary in one cloud, read replicas in another via logical replication (PostgreSQL) or change data capture (Debezium for MySQL).
- **Terraform modules:** `modules/storage/s3-bucket`, `modules/storage/azure-blob`, `modules/storage/gcs-bucket`, `modules/storage/cross-cloud-sync`.

### 2.4 DNS / Routing

**Architecture:** Cloudflare as the global traffic manager (cloud-agnostic).

```
User -> Cloudflare DNS (weighted/geo routing)
         +- 70% -> AWS ALB (us-east-1)
         +- 20% -> GCP LB (us-central1)
         +- 10% -> Azure FD (eastus)
         
Failover: Health checks every 30s.
          Unhealthy endpoint -> traffic redistributed in <60s.
```

- **Why Cloudflare:** Not tied to any cloud provider. Handles DNS, CDN, DDoS, WAF in one layer.
- **Health checks:** Cloudflare health checks against each cloud's load balancer. Automatic failover on 3 consecutive failures.
- **Terraform:** `modules/dns/cloudflare-lb` with weighted routing, geo-steering, and failover policies.

### 2.5 Replication & Failover Strategy

**Three modes the platform offers:**

1. **Active-Passive** (default): Primary cloud handles 100% traffic. Standby cloud has infrastructure pre-provisioned but receives no traffic. Failover via DNS flip. RPO: 5min, RTO: 5min.

2. **Active-Active** (growth tier): Traffic split across 2+ clouds. Each cloud can absorb 100% if the other fails. Database uses multi-master or conflict-free replication. RPO: ~0, RTO: ~30s.

3. **Burst** (cost-optimized): Single primary cloud. Secondary cloud auto-scales from zero when primary hits capacity or goes down. Uses serverless compute (Lambda, Cloud Functions, Azure Functions) for burst capacity. RPO: 5min, RTO: 2min.

### 2.6 Infrastructure as Code

**Terraform is the execution engine.** Not Pulumi, not CDK, not CloudFormation.

**Why Terraform:**
- Single language for all three clouds
- State management is mature
- Drift detection built-in
- Largest module ecosystem
- Your customers' DevOps teams already know it

**Module structure:**
```
terraform/
+-- modules/
|   +-- networking/
|   |   +-- aws-vpc/
|   |   +-- azure-vnet/
|   |   +-- gcp-vpc/
|   |   +-- cross-cloud-vpn/
|   +-- compute/
|   |   +-- eks/
|   |   +-- aks/
|   |   +-- gke/
|   +-- storage/
|   |   +-- s3-bucket/
|   |   +-- azure-blob/
|   |   +-- gcs-bucket/
|   +-- dns/
|   |   +-- cloudflare-lb/
|   +-- security/
|   |   +-- aws-iam-baseline/
|   |   +-- azure-ad-baseline/
|   |   +-- gcp-iam-baseline/
|   +-- monitoring/
|       +-- datadog/
|       +-- prometheus-stack/
+-- environments/
|   +-- {customer-id}/
|       +-- main.tf          # Composed from modules
|       +-- variables.tfvars  # Customer-specific values
|       +-- backend.tf        # Remote state per customer
+-- templates/
    +-- active-passive.tf.tpl
    +-- active-active.tf.tpl
    +-- burst.tf.tpl
```

**State management:** Terraform Cloud or S3 + DynamoDB locking. One state file per customer per environment.

---

## STEP 3: EXECUTION ENGINE DESIGN

### 3.1 How APIs Trigger Infrastructure Creation

```
User clicks "Deploy" in dashboard
        |
        v
POST /api/execution/deploy
        |
        v
+-----------------------------+
|   Execution Controller       |
|   1. Validate entitlements   |
|   2. Load project config     |
|   3. Generate Terraform      |
|      from template + vars    |
|   4. Create ExecutionJob     |
|   5. Push to job queue       |
+-------------+---------------+
              |
              v
+-----------------------------+
|   Job Queue (BullMQ/Redis)   |
|   or Inngest for serverless  |
+-------------+---------------+
              |
              v
+-----------------------------+
|   Execution Worker            |
|   1. Pull job from queue     |
|   2. Clone TF modules        |
|   3. terraform init          |
|   4. terraform plan (always) |
|   5. Store plan output       |
|   6. If approved:            |
|      terraform apply         |
|   7. Parse outputs           |
|   8. Update ExecutionLog     |
|   9. Notify user via WS/SSE |
+-----------------------------+
```

**Critical:** Terraform `plan` ALWAYS runs first. `apply` only after explicit user approval (your existing CONFIRM APPLY pattern).

### 3.2 How Terraform Gets Called

**NOT from the Next.js serverless function.** Terraform runs are long-lived (minutes). You need a dedicated worker.

**Architecture:**

```
Next.js API (Vercel) -> Inngest event -> Inngest worker function
                                              |
                                              v
                                    Docker container with:
                                    - Terraform CLI
                                    - AWS/Azure/GCP CLIs
                                    - Customer credentials (STS temp creds)
                                    
                                    Runs:
                                    1. terraform init -backend-config=...
                                    2. terraform plan -out=plan.tfplan
                                    3. terraform apply plan.tfplan
                                    4. terraform output -json
```

**Why Inngest over BullMQ:** Inngest runs on Vercel/serverless, supports long-running functions (up to 2hr), has built-in retry/replay, and doesn't require you to manage Redis or worker servers. It's the right choice at your scale.

**Cloud SDK usage:** Only via Terraform providers. Your existing direct AWS SDK calls (`@aws-sdk/client-ec2`, etc.) are for **discovery and scanning** — they stay as plugins. But for **creating/modifying infrastructure**, Terraform is the execution path. This gives you:
- State tracking
- Drift detection
- Rollback (terraform destroy or revert to previous state)
- Audit trail (plan files)

### 3.3 Job Orchestration

Evolve the existing `AgentJob` and `ExecutionLog` models:

```prisma
model ExecutionJob {
  id              String   @id @default(cuid())
  projectId       String
  userId          String
  type            String   // "terraform_plan" | "terraform_apply" | "terraform_destroy" | "scan" | "remediation"
  status          String   @default("queued") // queued | planning | awaiting_approval | applying | succeeded | failed | cancelled
  terraformPlanId String?  // S3 key for .tfplan file
  planSummary     Json?    // { add: 5, change: 2, destroy: 0, resources: [...] }
  applyOutput     Json?
  errorMessage    String?
  retryCount      Int      @default(0)
  maxRetries      Int      @default(3)
  parentJobId     String?  // for chained workflows
  createdAt       DateTime @default(now())
  startedAt       DateTime?
  finishedAt      DateTime?
  approvedAt      DateTime?
  approvedBy      String?
  
  @@index([projectId])
  @@index([status])
}
```

**Workflow orchestration for multi-step deployments:**

```
Job 1: terraform plan (networking)     -> awaiting_approval
Job 2: terraform plan (compute)        -> awaiting_approval (depends on Job 1)
Job 3: terraform plan (storage)        -> awaiting_approval (depends on Job 1)
Job 4: terraform plan (dns)            -> awaiting_approval (depends on Job 2 + 3)
```

Use `parentJobId` for dependency chains. The Inngest step function handles sequencing:

```typescript
inngest.createFunction(
  { id: "deploy-infrastructure" },
  { event: "infra/deploy.requested" },
  async ({ event, step }) => {
    const networkPlan = await step.run("plan-networking", () => 
      runTerraformPlan(event.data.projectId, "networking")
    );
    
    await step.waitForEvent("approval-networking", {
      event: "infra/plan.approved",
      match: "data.jobId",
      timeout: "24h",
    });
    
    await step.run("apply-networking", () =>
      runTerraformApply(networkPlan.planFileKey)
    );
    
    // Compute and storage can run in parallel after networking
    const [computePlan, storagePlan] = await Promise.all([
      step.run("plan-compute", () => runTerraformPlan(event.data.projectId, "compute")),
      step.run("plan-storage", () => runTerraformPlan(event.data.projectId, "storage")),
    ]);
    
    // ... continue with approvals and applies
  }
);
```

### 3.4 Failure & Retry Handling

| Failure Type | Strategy |
|---|---|
| **Terraform plan fails** | Parse error, log to ExecutionJob. Retry up to 3x with exponential backoff. If persistent, mark failed and alert user. |
| **Terraform apply fails mid-way** | Terraform handles partial state automatically. Log the error. User can re-run apply to complete. |
| **Cloud API rate limit** | Terraform providers have built-in retry. For SDK plugins, implement exponential backoff with jitter (already partially in your plugin engine timeout). |
| **Credential expiry** | STS temp creds last 15min (your current `DurationSeconds: 900`). For long Terraform runs, refresh credentials mid-job or use 1hr sessions. |
| **Worker crash** | Inngest automatically retries. Terraform state lock prevents corruption. Idempotent by design. |
| **User-initiated cancel** | Set job status to `cancelled`. Run `terraform plan -destroy` to compute cleanup, then auto-apply or ask for approval. |

---

## STEP 4: PRODUCT SIMPLIFICATION

### REMOVE (Phase 1 — Before Next Deploy)

1. **Bot/KnowledgeSource** — All models, APIs, UI. Delete the `bots` directory, `/api/bots`, `/api/chat` (bot chat), `dashboard/bots`.
2. **Website Builder** — All of it. `/builder`, `/api/website-builder`, `/api/leads/[id]/generate`, `/api/leads/[id]/deploy-preview`, `/api/leads/[id]/publish`, Vercel deploy APIs.
3. **Cloud Studio** — Merge the useful trigger logic into Cloud Operator. Delete `/cloud-studio`, `/api/cloud-studio`.
4. **Marketing pages** — `/products`, `/cloud-solutions`, `/cloud-security`, `/ai-engineering`, `/insights`, `/press`, `/case-studies`, `/contact` (keep a simple contact form in the app). Replace with a single landing page.
5. **Embed routes** — Delete.
6. **Contact Resolution Agent** — Delete. Not the product.
7. **Board deck generation** — Pause (not remove). Not MVP.
8. **SalesPipelineSnapshot** — Delete.

### CORE (The Product)

1. **Cloud Connector** — Link AWS, Azure, GCP accounts
2. **Discovery Scanner** — Discover all infrastructure across all linked clouds
3. **Security Auditor** — IAM, networking, storage, compliance scanning
4. **Architecture Generator** — AI generates Terraform for multi-cloud setup
5. **Execution Engine** — Run Terraform plan/apply with approval flow
6. **Monitoring Dashboard** — Real-time view of all infrastructure across clouds
7. **Axiom Chat** — AI assistant for natural language infrastructure management
8. **Recurring Analysis** — Continuous drift detection and compliance monitoring

### Dashboard Simplification

**Current:** 46K+ line monolith with health snapshot forms, board decks, marketing CTAs, and AWS-specific UI.

**Target:** 5 tabs.

```
+-------------------------------------------------+
|  [Overview] [Infrastructure] [Security] [Jobs] [Settings] |
+-------------------------------------------------+
|                                                  |
|  Overview:                                       |
|  +- Connected clouds (AWS Y, Azure Y, GCP N)    |
|  +- Resource count (142 EC2, 38 S3, 12 RDS...)  |
|  +- Security score (82/100)                      |
|  +- Monthly cost ($14,200 across 2 clouds)       |
|  +- Active alerts (3)                            |
|                                                  |
|  [Ask Axiom] — floating chat, always available   |
|                                                  |
+-------------------------------------------------+
```

---

## STEP 5: USER FLOW

### Step 1: Signup (30 seconds)

```
Landing page -> "Start Free" -> Email + password -> Dashboard
```

No credit card required. Free tier gets: 1 cloud connection, discovery scan, security scan, read-only.

### Step 2: Connect First Cloud (2 minutes)

```
Dashboard shows: "Connect your first cloud provider"
         |
         +- AWS: "Create this IAM role in your account" 
         |       (one-click CloudFormation stack link)
         |       Paste Role ARN -> Validate -> Connected
         |
         +- Azure: "Register this app in Azure AD"
         |         (guided flow with screenshots)
         |         Paste Tenant ID + Client ID -> Connected
         |
         +- GCP: "Create service account with these permissions"
                  (Terraform snippet or Console instructions)
                  Upload JSON key -> Connected
```

The existing AWS AssumeRole flow stays. Build equivalent for Azure (App Registration + `@azure/identity` SDK) and GCP (Service Account + `@google-cloud/*` SDKs).

### Step 3: Run Discovery Scan (3 minutes, automated)

```
After cloud connected:
"Scanning your infrastructure..." (progress bar)
         |
         v
Discovery complete:
+----------------------------------------+
|  AWS (us-east-1)                        |
|  +- 24 EC2 instances                    |
|  +- 8 RDS databases                     |
|  +- 42 S3 buckets                       |
|  +- 3 VPCs                              |
|  +- 12 Lambda functions                 |
|  +- Monthly cost: $8,400                |
|                                          |
|  Security Score: 64/100                  |
|  +- 3 Critical findings                 |
|  +- 7 High findings                     |
|  +- 12 Medium findings                  |
+----------------------------------------+
```

This uses your existing `aws:infra-discovery`, `aws:iam-exposure-scan`, `aws:s3-public-bucket-scan`, `aws:security-group-exposure-scan` plugins running in sequence.

### Step 4: Generate Multi-Cloud Architecture (5 minutes)

```
"Want to make this infrastructure resilient?"
         |
         v
AI analyzes current infra -> generates recommendation:

"Based on your setup, I recommend Active-Passive with Azure as standby.
 Estimated additional cost: $2,100/month (+25%)
 Failover time: <5 minutes
 
 This will create:
 - Azure VNet mirroring your AWS VPC
 - AKS cluster matching your EKS config  
 - Azure SQL replicas of your RDS instances
 - Cross-cloud VPN tunnel
 - Cloudflare DNS with health-check failover"
         |
         v
[View Terraform Plan] [Customize] [Ask Axiom]
```

The AI (Claude via your orchestrator) generates a Terraform configuration by selecting and parameterizing your modules. Input: current resources, desired redundancy mode, budget constraints. Output: complete `.tf` files using your module library.

### Step 5: Deploy Infrastructure (15-45 minutes)

```
User clicks "Deploy" -> CONFIRM APPLY
         |
         v
Execution pipeline:
1. ########.. Networking (VPC, subnets, VPN)     2min
2. ####...... Compute (AKS cluster, node pools)   8min  
3. ##........ Storage (Azure SQL, Blob)            5min
4. .......... DNS (Cloudflare routing)             1min
5. .......... Verification (health checks)         2min
         |
         v
"Multi-cloud infrastructure deployed. 
 Azure standby is receiving replicated data.
 Failover will trigger automatically if AWS health check fails."
```

Each step is an Inngest job with its own ExecutionJob record. Real-time progress via SSE (Server-Sent Events) to the dashboard.

### Step 6: Monitor System (Ongoing)

```
Dashboard Overview:
+-----------------------------------------+
|  Status: All Systems Operational         |
|                                          |
|  AWS (Primary)    Azure (Standby)        |
|  +- 24 EC2        +- 24 VMs (replica)   |
|  +- 8 RDS         +- 8 SQL (replica)    |
|  +- Latency: 12ms +- Latency: 18ms     |
|  +- Cost: $8,400   +- Cost: $2,100      |
|                                          |
|  Last scan: 2hr ago                      |
|  Next scan: in 4hr (auto)               |
|  Drift detected: 0                       |
|                                          |
|  [Run Scan Now] [View History]           |
+-----------------------------------------+
```

Uses your existing RecurringAnalysis model. Daily IAM scans, weekly infra discovery, with drift detection alerts.

---

## STEP 6: PRICING & BUSINESS MODEL

### Three Tiers (Simple, Scalable)

| | **Starter** | **Pro** | **Enterprise** |
|---|---|---|---|
| **Price** | Free | $499/month | $2,499/month |
| **Clouds** | 1 | 3 | Unlimited |
| **Resources managed** | Up to 50 | Up to 500 | Unlimited |
| **Discovery & Scanning** | Yes | Yes | Yes |
| **Security Audits** | Read-only | Read + remediate | Full auto-remediation |
| **Multi-cloud deploy** | — | Yes (Active-Passive) | Yes (Active-Active + Burst) |
| **Terraform execution** | — | Yes (with approval) | Yes (auto-approve option) |
| **Recurring monitoring** | Daily scan | Hourly scan | Real-time |
| **Axiom chat** | 50 msgs/month | Unlimited | Unlimited + priority |
| **Support** | Community | Email (24hr) | Slack + dedicated CSM |
| **Setup fee** | $0 | $0 | $5,000 (one-time) |

### Revenue Model

- **Primary:** Subscription (monthly/annual with 20% annual discount)
- **Secondary:** Usage-based overage ($0.50 per resource/month over tier limit)
- **Tertiary:** Professional services for Enterprise (custom integrations, migration assistance — $250/hr)

### Why This Works

- Free tier creates pipeline (discovery scans show the problem)
- Pro at $499/mo is a no-brainer for any company spending $10K+/mo on cloud (they'll save more than that)
- Enterprise at $2,499/mo is standard for infrastructure management platforms
- Setup fee for Enterprise covers the dedicated onboarding call and custom Terraform module development

---

## STEP 7: FINAL ARCHITECTURE

```
+---------------------------------------------------------------------+
|                          FRONTEND                                    |
|                                                                      |
|  Next.js 16 (App Router)                                            |
|  +- /dashboard          — Overview, resource counts, cost, alerts    |
|  +- /infrastructure     — Multi-cloud resource browser               |
|  +- /security           — Scan results, findings, remediation        |
|  +- /jobs               — Terraform plan/apply history               |
|  +- /settings           — Cloud connections, team, billing           |
|  +- Axiom Chat (overlay) — Natural language infra management         |
|                                                                      |
|  State: React Server Components + SWR for real-time                  |
|  Styling: Tailwind CSS                                               |
|  Real-time: SSE for job progress                                     |
+-------------------------------+-------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                          BACKEND (Next.js API Routes)                |
|                                                                      |
|  Auth Layer (NextAuth JWT)                                           |
|  +- /api/auth/*                                                      |
|  |                                                                   |
|  API Layer                                                           |
|  +- /api/connectors/link          — Connect cloud accounts           |
|  +- /api/connectors/status        — Check connection health          |
|  +- /api/scan/discover            — Trigger discovery scan           |
|  +- /api/scan/security            — Trigger security audit           |
|  +- /api/architecture/generate    — AI generates Terraform           |
|  +- /api/architecture/plan        — Run terraform plan               |
|  +- /api/architecture/apply       — Run terraform apply              |
|  +- /api/jobs/[id]                — Job status + logs                |
|  +- /api/jobs/[id]/approve        — Approve terraform plan           |
|  +- /api/chat                     — Axiom assistant                  |
|  +- /api/webhooks/stripe          — Billing events                   |
|  +- /api/cron/recurring           — Scheduled scans                  |
|                                                                      |
|  Middleware: Rate limiting, entitlement checks, audit logging         |
+-------------------------------+-------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                     EXECUTION ENGINE                                 |
|                                                                      |
|  +--------------+   +-----------------+   +------------------+      |
|  | Plugin Engine |   | Terraform Runner |   | Inngest Workers  |      |
|  | (existing)   |   | (new)            |   | (new)            |      |
|  |              |   |                  |   |                  |      |
|  | Scan plugins |   | init/plan/apply  |   | Long-running     |      |
|  | IAM audit    |   | State management |   | job orchestration|      |
|  | Cost check   |   | Output parsing   |   | Step functions   |      |
|  | S3 scan      |   | Drift detection  |   | Retry/timeout    |      |
|  +------+-------+   +--------+--------+   +--------+---------+      |
|         |                    |                      |                |
|         +--------------------+----------------------+                |
|                              |                                       |
|                     Credential Broker                                |
|                     (STS AssumeRole / Azure AD / GCP SA)             |
+-------------------------------+-------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                     CLOUD INTEGRATIONS                               |
|                                                                      |
|  +---------+        +---------+        +---------+                  |
|  |   AWS   |        |  Azure  |        |   GCP   |                  |
|  |         |        |         |        |         |                  |
|  | STS     |        | Azure AD|        | IAM SA  |                  |
|  | EC2     |        | ARM     |        | Compute |                  |
|  | S3      |        | Blob    |        | GCS     |                  |
|  | RDS     |        | SQL     |        | Cloud   |                  |
|  | IAM     |        | NSG     |        |   SQL   |                  |
|  | VPC     |        | VNet    |        | VPC     |                  |
|  | Cost Ex |        | Cost Mg |        | Billing |                  |
|  +---------+        +---------+        +---------+                  |
|                                                                      |
|  Terraform Providers: hashicorp/aws, hashicorp/azurerm,             |
|                       hashicorp/google, cloudflare/cloudflare        |
+---------------------------------------------------------------------+
                                |
                                v
+---------------------------------------------------------------------+
|                     DATA LAYER                                       |
|                                                                      |
|  PostgreSQL (Prisma ORM)                                             |
|  +- User, Project (renamed from Lead)                                |
|  +- CloudConnection (new: provider, credentials, status)             |
|  +- ResourceInventory (new: discovered resources per project)        |
|  +- SecurityFinding (new: findings from scans)                       |
|  +- ExecutionJob (evolved from ExecutionLog)                         |
|  +- TerraformState (reference to remote state)                       |
|  +- RecurringAnalysis (existing)                                     |
|  +- AuditLog (existing)                                              |
|  +- AIInvocation (existing)                                          |
|                                                                      |
|  Terraform State: S3 + DynamoDB (per customer)                       |
|  Job Queue: Inngest (serverless)                                     |
|  Real-time: SSE via Next.js streaming                                |
+---------------------------------------------------------------------+
```

---

## STEP 8: TOP 10 IMPLEMENTATION TASKS

Ordered by priority. Each task builds on the previous.

### 1. Schema Migration & Cleanup (Week 1)

**What:** Rename `Lead` to `Project`. Add `CloudConnection` model with `provider` (aws|azure|gcp), `credentialsEncrypted`, `status`, `lastValidatedAt`. Add `ResourceInventory` model for discovered resources. Add `SecurityFinding` model. Drop `Bot`, `KnowledgeSource`, `SalesPipelineSnapshot`. Remove all website builder fields from the Lead/Project payload.

**Files:**
- `prisma/schema.prisma` — rewrite
- `lib/db.ts` — update imports
- All API routes referencing `Lead` — update to `Project`

### 2. Azure & GCP Connector Implementation (Week 1-2)

**What:** Implement real Azure connector using `@azure/identity` + `@azure/arm-resources` for App Registration auth and resource discovery. Implement real GCP connector using `@google-cloud/resource-manager` + service account JSON key auth. Follow the same pattern as `lib/connectors/aws.ts` — validate connection, discover infrastructure, run security scan.

**New dependencies:** `@azure/identity`, `@azure/arm-resources`, `@azure/arm-compute`, `@azure/arm-storage`, `@azure/arm-network`, `@google-cloud/compute`, `@google-cloud/storage`, `@google-cloud/resource-manager`

**Files:**
- `lib/connectors/azure.ts` — full implementation
- `lib/connectors/gcp.ts` — full implementation

### 3. Azure & GCP Discovery Plugins (Week 2-3)

**What:** Build equivalents of `aws:infra-discovery` for Azure and GCP. Register in plugin registry. Each plugin: list VMs/instances, databases, storage, networking, IAM roles. Output in a normalized format that works across clouds.

**Files:**
- `lib/plugins/azure/infraDiscovery.ts`
- `lib/plugins/azure/securityScan.ts`
- `lib/plugins/gcp/infraDiscovery.ts`
- `lib/plugins/gcp/securityScan.ts`
- `lib/plugins/registry.ts` — register new plugins

### 4. Unified Resource Model & Dashboard (Week 3-4)

**What:** Create a normalized `ResourceInventory` table that stores discovered resources from all clouds in a common schema: `{ id, projectId, provider, resourceType, region, name, metadata, cost, tags, discoveredAt }`. Build the new 5-tab dashboard: Overview, Infrastructure (resource browser), Security, Jobs, Settings. Kill the 46K-line cloud operator page.

**Files:**
- New: `app/dashboard/overview/page.tsx`
- New: `app/dashboard/infrastructure/page.tsx`
- New: `app/dashboard/security/page.tsx`
- New: `app/dashboard/jobs/page.tsx`
- New: `app/dashboard/settings/page.tsx`
- Delete: `app/cloud-operator/page.tsx` (preserve chat component)

### 5. Terraform Module Library (Week 4-6)

**What:** Write Terraform modules for the 6 core categories: networking (VPC/VNet/VPC per cloud + cross-cloud VPN), compute (EKS/AKS/GKE), storage (S3/Blob/GCS), DNS (Cloudflare), security baselines (IAM policies), monitoring (Datadog agent). Store in a `terraform/modules/` directory in the repo. Each module has a standard variable interface.

**Files:**
- `terraform/modules/networking/aws-vpc/main.tf`
- `terraform/modules/networking/azure-vnet/main.tf`
- `terraform/modules/networking/gcp-vpc/main.tf`
- `terraform/modules/compute/eks/main.tf`
- (etc. — ~18 modules total)

### 6. Inngest Integration & Terraform Runner (Week 5-7)

**What:** Add Inngest SDK. Build a Terraform runner service that can execute `terraform init/plan/apply` in a sandboxed environment. Create Inngest step functions for multi-step deployment workflows. Wire up SSE for real-time job progress in the dashboard.

**New dependencies:** `inngest`

**Files:**
- New: `lib/execution/terraformRunner.ts`
- New: `lib/execution/inngestFunctions.ts`
- New: `app/api/inngest/route.ts` — Inngest webhook handler
- Update: `app/api/execution/run/route.ts` — add Terraform job types

### 7. AI Architecture Generator (Week 6-8)

**What:** Build the AI module that takes discovered infrastructure as input and generates a Terraform configuration for multi-cloud deployment. Uses Claude (your existing orchestrator with `PLAN_STRONG` task type). Input: current resources, desired redundancy mode, budget constraints. Output: complete `.tf` files using your module library.

**Files:**
- New: `lib/architect/generateTerraform.ts`
- New: `lib/architect/templates.ts` — active-passive, active-active, burst templates
- New: `app/api/architecture/generate/route.ts`
- New: `app/api/architecture/plan/route.ts`
- New: `app/api/architecture/apply/route.ts`

### 8. Settings & Connection Management UI (Week 7-8)

**What:** Build the Settings page with cloud connection management. For each provider: guided setup wizard, connection status, credential rotation, permissions audit. Team management: invite members, role-based access (admin, operator, viewer). Billing: current plan, usage, upgrade flow (existing Stripe integration).

**Files:**
- New: `app/dashboard/settings/connections/page.tsx`
- New: `app/dashboard/settings/team/page.tsx`
- New: `app/dashboard/settings/billing/page.tsx`
- Reuse: `components/axiom-ui/` connector components

### 9. Code Cleanup & Dead Code Removal (Week 8)

**What:** Remove all website builder code, bot code, marketing pages, Cloud Studio, embed routes, contact resolution agent, board deck. Update navigation. Update entitlements to use new plan names (Starter/Pro/Enterprise instead of starter/growth/scale/enterprise). Run tests. Deploy.

**Scope:** ~40% of current codebase gets deleted.

### 10. Landing Page & Onboarding Polish (Week 9-10)

**What:** Single-page marketing site (replace the 8+ marketing pages). Clear value prop: "Stop depending on one cloud. Deploy across AWS, Azure, and GCP in minutes." Animated demo showing discovery -> architecture -> deploy flow. Pricing table. Signup -> onboarding flow with progress indicator (connect cloud -> scan -> review -> deploy).

**Files:**
- Rewrite: `app/page.tsx` — single landing page
- New: `app/onboarding/page.tsx` — guided first-run experience
- Delete: `app/products/`, `app/cloud-solutions/`, `app/insights/`, `app/press/`, etc.

---

## SUMMARY

Your existing codebase has a strong foundation — the AWS connector, plugin engine, AI assistant, and execution logging are production-quality and directly applicable. The main work is: implement Azure/GCP for real, add Terraform as the execution backend, simplify the UI to 5 tabs, and delete ~40% of the code that serves the old multi-product vision. Weeks 1-4 are about cleaning the foundation. Weeks 4-8 are about building the multi-cloud execution capability. Weeks 8-10 are polish and launch.
