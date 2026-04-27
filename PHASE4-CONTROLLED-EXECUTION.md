# Phase 4: Controlled Terraform Execution — Implementation Summary

## What Was Built

Turn the Phase 3 multi-cloud recommendation into a safe Terraform workflow: Generate → Plan → Approve → Apply.

**Safety Rules:**
- No auto-apply — every apply requires explicit "CONFIRM APPLY"
- Plan runs automatically; apply only after approval
- All output captured, sensitive values redacted
- Timeout protection on every CLI command
- Graceful failure if Terraform CLI is not installed

---

## 1. Terraform Generator

**File:** `lib/terraform/generator.ts`

Generates 4 Terraform files for Active-Passive AWS→Azure:

| File | Contents |
|---|---|
| `main.tf` | Azure provider, resource group, virtual network + subnet, storage account with versioning |
| `variables.tf` | project_name, environment, Azure credentials (sensitive), region, CIDR blocks |
| `terraform.tfvars` | Project name filled, Azure credentials as commented placeholders |
| `outputs.tf` | Resource group, VNet, storage account names and IDs |

Creates a `TerraformExecutionJob` database record and writes files to an isolated temp directory.

---

## 2. Terraform Runner

**File:** `lib/terraform/runner.ts`

Safe CLI execution layer:

| Function | What It Does |
|---|---|
| `terraformInit(jobId)` | Runs `terraform init`, checks CLI is installed |
| `terraformValidate(jobId)` | Runs `terraform validate`, updates job status |
| `terraformPlan(jobId)` | Runs init → validate → plan, parses plan summary (add/change/destroy) |
| `terraformApply(jobId)` | Runs `terraform apply -auto-approve` ONLY if job is approved |
| `getJobStatus(jobId)` | Returns job status with redacted outputs |

**Safety controls:**
- `TF_IN_AUTOMATION=1` and `TF_INPUT=0` env vars prevent interactive prompts
- 2-minute timeout per command, 5-minute timeout for apply
- Sensitive values (secrets, keys, tokens) redacted from all stored output
- Apply refuses if `approvedAt`/`approvedBy` are null
- Apply refuses if status is not `awaiting_approval` or `planned`

---

## 3. API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/terraform/generate` | POST | Generate TF files + create job |
| `/api/terraform/plan` | POST | Run init/validate/plan, store output |
| `/api/terraform/approve` | POST | Mark job approved (requires "CONFIRM APPLY") |
| `/api/terraform/apply` | POST | Run apply only if approved |
| `/api/terraform/jobs/[id]` | GET | Return job status/output (redacted) |

All routes require starter token authentication and verify lead ownership.

---

## 4. Database Model

```prisma
model TerraformExecutionJob {
  id                  String    @id @default(cuid())
  leadId              String
  userId              String?
  readinessReportId   String?
  status              String    @default("queued")
  mode                String    @default("active_passive")
  primaryCloud        String    @default("aws")
  secondaryCloud      String    @default("azure")
  workingDirectory    String?
  generatedFiles      Json?
  planSummary         Json?
  planOutput          String?   @db.Text
  applyOutput         String?   @db.Text
  errorMessage        String?
  approvedAt          DateTime?
  approvedBy          String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}
```

**Status flow:** queued → generating → validating → planned → awaiting_approval → applying → succeeded/failed

---

## 5. Dashboard UI

Added "Deploy Standby Infrastructure" section to `/dashboard/resilience`:

1. **Generate** — Creates Terraform files from the readiness report
2. **Plan** — Runs init/validate/plan, shows add/change/destroy summary with expandable output
3. **Approve** — User types "CONFIRM APPLY" in input field, clicks Approve
4. **Apply** — Executes the approved plan, shows success/failure with expandable output

Color-coded status badges: green (add), yellow (change), red (destroy).

---

## 6. Axiom Safety Rules

Added rules 15-16 to the Axiom assistant system prompt:

- **Rule 15:** Axiom may explain Terraform plans but NEVER auto-apply. Apply always requires "CONFIRM APPLY" via dashboard UI.
- **Rule 16:** When users ask about deploying standby infrastructure, Axiom explains what will be created and directs them to the dashboard execution panel.

---

## Files Created

- `lib/terraform/generator.ts` — HCL file generation
- `lib/terraform/runner.ts` — Safe CLI execution
- `app/api/terraform/generate/route.ts` — Generate endpoint
- `app/api/terraform/plan/route.ts` — Plan endpoint
- `app/api/terraform/approve/route.ts` — Approve endpoint
- `app/api/terraform/apply/route.ts` — Apply endpoint
- `app/api/terraform/jobs/[id]/route.ts` — Job status endpoint

## Files Modified

- `prisma/schema.prisma` — Added TerraformExecutionJob model
- `app/dashboard/resilience/page.tsx` — Added Terraform execution UI
- `lib/agents/axiomAssistantAgent.ts` — Added safety rules 15-16

---

## How to Test

1. Start dev server: `npm run dev`
2. Visit `/dashboard/resilience?token=YOUR_TOKEN`
3. Run the resilience analysis first (Phase 3)
4. Click "Generate Terraform Plan" → creates TF files
5. Click "Run Terraform Plan" → runs init/validate/plan
6. Review the plan summary (N to add, N to change, N to destroy)
7. Type "CONFIRM APPLY" → click Approve
8. Click "Apply Infrastructure" → executes the plan
9. Verify success status

Via Axiom chat:
- "How do I deploy standby infrastructure?" → explains the flow, directs to dashboard
- "What will Terraform create?" → explains resource group, VNet, storage
- "Apply the Terraform" → refuses, directs to dashboard CONFIRM APPLY
