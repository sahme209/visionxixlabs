# Cloud Operator Advancement Roadmap

**Goal:** Make the AI Cloud Operator more powerful, intelligent, and differentiated.

---

## Current State (Baseline)

| Layer | Current | Limitation |
|-------|---------|------------|
| **AI Model** | gpt-4o-mini | Less capable for complex reasoning |
| **Inputs** | Form only (project type, provider, spend, etc.) | No real infra/config context |
| **AI Output** | Single JSON blob: launch, optimize, secure, business, detections | Generic; not tailored to actual setup |
| **30-Day Plan** | Deterministic templates | Same tasks regardless of inputs |
| **Scoring** | Pure formulas | No AI refinement based on context |
| **Connectors** | Link GitHub/AWS/Azure/GCP | Metadata exists but rarely feeds AI |

---

## Phase 1: Stronger AI (Quick Wins)

### 1.1 Upgrade Model & Prompt

- **Model:** Make `MODEL_NAME` env-driven; default `gpt-4o` for Pro+ tiers, `gpt-4o-mini` for free.
- **Prompt:**
  - Add provider-specific guidance (AWS vs Azure vs GCP vs Vercel).
  - Include primary goal as a strong directive ("prioritize cost savings" vs "prioritize launch speed").
  - Request more specific outputs: concrete resource names, real CLI commands, provider-native syntax.
  - Add few-shot examples for common patterns (SaaS on AWS, static on Vercel, etc.).

### 1.2 Config Paste (Optional)

- **Form field:** "Paste config (optional)" — Terraform, CloudFormation, docker-compose, or YAML.
- **Flow:** If provided, AI receives the config and produces:
  - Specific anti-patterns in *their* infra
  - Concrete fixes with line/section references
  - Cost/savings estimates based on actual resources
  - Security findings tied to their setup

### 1.3 AI-Generated 30-Day Plan

- Today: `buildDeterministicTasks()` returns template tasks.
- **Upgrade:** Second AI call (or extend main call) to generate a **custom 30-day plan** from:
  - Profile + AI detections + scores
  - Output: `timeSequencedPlan` with specific tasks, day ranges, and rationale

---

## Phase 2: Richer Inputs

### 2.1 Connector-Enhanced Analysis

- When connectors (GitHub, AWS, Azure, GCP) are linked, pass metadata into the AI prompt:
  - Repo structure, language, frameworks
  - AWS: service usage, regions, approximate costs (if Cost Explorer available)
  - Azure/GCP: analogous metadata
- AI produces recommendations based on **actual** stack, not just form answers.

### 2.2 Cost Data Import

- Optional: CSV or JSON from billing export (AWS Cost and Usage Report, Azure Cost Management).
- AI analyzes spend breakdown and recommends:
  - Top 5 waste areas
  - Reserved instance / Savings Plans sizing
  - Storage tier migrations
  - Rightsizing suggestions per service

---

## Phase 3: Smarter Outputs

### 3.1 Compliance Mapping

- For SOC2, HIPAA, PCI: AI generates a **control mapping**:
  - Which controls are partially met / gaps
  - Recommended technical actions per control
  - Evidence/artifact suggestions

### 3.2 Migration Playbooks

- When project type suggests migration (e.g. lift-and-shift, re-platform):
  - AI generates a phased migration playbook
  - Cutover checklist, rollback steps
  - Estimated downtime and risk levels

### 3.3 Architecture Diagram (Mermaid)

- AI outputs a Mermaid diagram of recommended architecture.
- Rendered on the dashboard for visual clarity.

### 3.4 Runbook Generation

- From playbooks + secure section: generate **incident runbooks** (e.g. "DB overload", "Credential leak").

---

## Phase 4: Real-Time & Live Data

### 4.1 Drift Reassessment (Growth+)

- Periodic re-run with connector metadata.
- Compare against baseline; surface drift signals.
- AI summarizes: "3 new services added since last run; 2 unoptimized."

### 4.2 Trend Intelligence

- Use `AxiomScoreSnapshot` history.
- AI generates trend narrative: "Score improved 12 pts over 3 runs; savings potential increased by $X."

---

## Phase 5: UX & Performance

### 5.1 Streaming

- Stream AI output as it generates (chunked JSON or text).
- Show "Generating architecture…" → "Generating security…" → "Done."

### 5.2 Comparison Mode

- "Compare runs" — side-by-side before/after for repeat users.

### 5.3 Export Formats

- PDF report, Notion/Confluence import, Slack summary.

---

## Priority Order

| Priority | Enhancement | Effort | Impact |
|----------|-------------|--------|--------|
| P0 | Upgrade model + richer prompt | Low | High |
| P0 | AI-generated 30-day plan | Medium | High |
| P1 | Config paste (optional) | Medium | Very High |
| P1 | Connector metadata in prompt | Low | High |
| P2 | Compliance mapping | Medium | Medium (niche) |
| P2 | Architecture diagram (Mermaid) | Low | Medium |
| P3 | Streaming UX | Medium | Medium |
| P3 | Cost data import | High | High (enterprise) |

---

## Implementation Notes

- **Env vars:** `MODEL_NAME` (default `gpt-4o-mini`), `CLOUD_OPERATOR_PRO_MODEL` (optional, e.g. `gpt-4o`).
- **Token budget:** Larger models cost more; gate with tier or `maxDuration`.
- **Schema:** `fullPayload.operatorProfile.pastedConfig` for optional config.
- **Backward compat:** All new fields optional; existing flows unchanged.
