# Engineer Hiring Plan

Internal document: stages and responsibilities for scaling cloud and AI delivery. Adjust timelines and titles to fit your situation.

---

## Stage 1 — Founder-led implementation

- **Who:** Founder(s) doing cloud and AI implementation.
- **Scope:** Hands-on delivery: architecture, IaC, pipelines, AI integration, security baseline. Sales, discovery, and delivery are the same people.
- **Limits:** Capacity is capped by founder time. Good for early clients and proving the model; not scalable beyond a small number of concurrent engagements.
- **Goal:** Validate demand, deliver quality, document patterns and playbooks so future hires can replicate.

---

## Stage 2 — Hire Cloud / DevOps Engineer

- **When:** When there is enough pipeline and revenue to support a full-time technical hire (and you’re turning down or delaying work).
- **Role:** Cloud/DevOps Engineer.
- **Responsibilities:**
  - Implement and maintain cloud infrastructure (AWS/Azure/GCP) from specs or designs.
  - Build and maintain CI/CD pipelines, IaC (Terraform, CloudFormation, or equivalent).
  - Implement monitoring, logging, and basic security controls.
  - Work from runbooks and scope defined by founder or lead; escalate design and client decisions.
- **What founder keeps:** Architecture decisions, client discovery, scoping, and high-level design. Code review and quality bar.
- **Outcome:** Founder focuses on sales, discovery, and design; engineer executes and operates. Capacity for 2–3x more delivery.

---

## Stage 3 — Hire AI Engineer

- **When:** When AI work is a meaningful share of pipeline and you need dedicated AI implementation capacity.
- **Role:** AI Engineer (or ML/LLM Engineer).
- **Responsibilities:**
  - Deploy and integrate LLMs and AI services (RAG, APIs, private models) in client environments.
  - Implement guardrails, logging, and cost controls for AI workloads.
  - Work with Cloud/DevOps on networking, security, and deployment of AI components.
  - Follow security and governance patterns set by the team.
- **What founder keeps:** AI strategy, client use-case discovery, model and vendor choices. AI Engineer executes and tunes.
- **Outcome:** Parallel capacity for cloud-only and AI-inclusive engagements. Clear split: cloud infra vs. AI implementation.

---

## Stage 4 — Add Security Engineer

- **When:** When security reviews, compliance, or security-heavy implementations are recurring (e.g. SOC2, hardening, IAM redesign).
- **Role:** Security Engineer (or Cloud Security Engineer).
- **Responsibilities:**
  - Security assessments and hardening (IAM, network, logging, encryption).
  - Compliance support (evidence, controls, documentation) where it’s technical.
  - Security review of infra and AI deployments before go-live.
  - Not replacing a CISO — focused on implementation and review, not policy ownership.
- **What founder keeps:** Client relationship on security scope; Security Engineer owns execution and reporting.
- **Outcome:** Security can be a first-class offering without founder bottleneck. Frees Cloud/DevOps to focus on build and run.

---

## Summary table

| Stage | Hire | Primary focus | Founder focus |
|-------|------|----------------|---------------|
| 1 | — | Full delivery | Everything |
| 2 | Cloud/DevOps Engineer | Infra, CI/CD, operations | Sales, design, review |
| 3 | AI Engineer | AI deployment, integration, governance | Sales, AI strategy, review |
| 4 | Security Engineer | Security assessments, hardening, compliance support | Sales, scope, client |

---

## Notes

- **Order can vary.** If security demand is high before AI, Stage 4 can come before Stage 3. If AI is the main differentiator, Stage 3 before Stage 4.
- **No fabricated credentials.** Hire for demonstrated skill (projects, references, technical conversation). Avoid title inflation.
- **Documentation.** Each stage should improve runbooks, templates, and scope documents so the next hire can onboard and deliver consistently.
