# Phase 5 — Autonomous Experience + Enterprise Readiness Verification

Phase 5 delivers an "autonomous feel" without auto-execution: playbooks, quality gates, connectors, and policy packs, all additive and tier-gated.

---

## A) Connectors

### Types & Storage Format

| File | Purpose |
|------|---------|
| `lib/connectors/types.ts` | ConnectorType, ConnectorStatus, ConnectorMetadata |
| `lib/connectors/github.ts` | Read-only GitHub API validation |
| `lib/connectors/aws.ts`, `azure.ts`, `gcp.ts` | Stub validators (format only) |

**Storage format** (in `fullPayload.connectors[connectorType]`):

```json
{
  "status": "linked" | "pending" | "error",
  "linkedAt": "ISO8601",
  "authMethod": "token" | "oauth" | "app",
  "encryptedCredRef": "<base64>"
}
```

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/connectors/link?token=XXX` | Link connector (token required) |
| GET | `/api/connectors/status?token=XXX` | Return connector status (no creds) |

### Tier Gating

- **Free**: GitHub only (optional)
- **Pro+**: GitHub + AWS, Azure, GCP placeholder connectors
- **Enterprise**: Private integrations flags (future)

---

## B) Credential Vault & Audit

### Encryption Vault Notes

| File | Purpose |
|------|---------|
| `lib/security/credentialVault.ts` | AES-256-GCM, per-record IV, CREDENTIAL_ENCRYPTION_KEY |
| `lib/credentialEncrypt.ts` | Re-exports from credentialVault (backward compat) |

**Per-record format**: `{ ciphertext, iv, tag }` — key from `CREDENTIAL_ENCRYPTION_KEY`.

### Audit Log Actions List

| Action | When |
|--------|------|
| `connector_linked` | POST /api/connectors/link success |
| `export_downloaded` | GET /api/cloud-operator/export success |
| `implementation_requested` | POST /api/cloud-operator/request-implementation success |
| `roadmap_generated` | Cloud operator trigger success |
| `drift_detected` | Drift signals present in trigger |

**AuditLog model**: `id`, `createdAt`, `leadId`, `action`, `actor`, `metadata`.

---

## C) Playbook Schema Example

```typescript
type PlaybookPack = {
  phasePlaybooks: Array<{
    phaseName: string;
    objective: string;
    prerequisites: string[];
    stepByStep: Array<{ step: string; command?: string; file?: string; validation?: string }>;
    rollbackPlan: string[];
    successCriteria: string[];
  }>;
  cutoverChecklist: string[];
  ownerRoles: string[];
  estimatedEffortHours: number;
};
```

**Storage**: `fullPayload.axiomResult.playbooks`

**Tier exposure**:
- Pro+: Full playbooks
- Growth+: Download as markdown (in export pack)
- Free: 2–3 step preview + upsell

---

## D) Validator Rules

| Validator | File | Rules |
|-----------|------|-------|
| GitHub Actions YAML | `validateGithubActionsYaml.ts` | Requires `on:` or `jobs:`; warns on `{{ }}` placeholders |
| Terraform | `validateTerraform.ts` | Requires `terraform`, `resource`, or `provider`; warns on unclosed `${ }` |
| Dockerfile | `validateDockerfile.ts` | Requires `FROM`; validates known instructions |
| Security Checklist | `validateSecurityChecklist.ts` | Requires terms: iam, mfa, audit, exposure |

**Quality storage**: `fullPayload.axiomResult.quality = { pass: boolean, issues: string[] }`

---

## E) Policy Packs

| File | Purpose |
|------|---------|
| `lib/axiom/policyPacks.ts` | Deterministic IAM, network, logging, incident response templates |

**Tier gating**:
- Enterprise: Full templates
- Pro/Growth: Preview + "request enterprise pack"

---

## F) Tier Gating Matrix

| Feature | Free | Pro | Growth | Enterprise |
|---------|------|-----|--------|------------|
| GitHub connector | ✓ | ✓ | ✓ | ✓ |
| Cloud connectors (AWS/Azure/GCP) | ✗ | ✓ | ✓ | ✓ |
| Playbooks view | Preview (2–3 steps) | Full | Full | Full |
| Playbooks download (markdown) | ✗ | ✓ | ✓ | ✓ |
| Quality gate badge | ✓ | ✓ | ✓ | ✓ |
| Policy pack | ✗ | Preview | Preview | Full |
| Connectors tab | ✗ | ✓ | ✓ | ✓ |

---

## G) UI Tabs

| Tab | Visibility | Content |
|-----|------------|---------|
| Overview | All | Metrics, business impact, recommendations, request implementation |
| Roadmap | All | 30-day plan |
| Playbooks | All | Full (Pro+) or preview (Free) |
| Export | All | Download pack, configs |
| Connectors | Pro+ | Connector status / link info |

**Autopilot copy**:  
"Autopilot Mode: Generates step-by-step playbooks and validated configs. Execution requires your approval."

---

## H) Files Touched

| Path | Purpose |
|------|---------|
| `lib/connectors/*` | Connector types, GitHub, AWS, Azure, GCP stubs |
| `app/api/connectors/link/route.ts` | POST link |
| `app/api/connectors/status/route.ts` | GET status |
| `lib/security/credentialVault.ts` | AES-256-GCM encryption |
| `lib/security/auditLog.ts` | Audit logging |
| `lib/credentialEncrypt.ts` | Re-exports credentialVault |
| `lib/axiom/playbooks.ts` | Playbook generator |
| `lib/axiom/validators/*` | Config validators |
| `lib/axiom/policyPacks.ts` | Policy pack templates |
| `app/api/cloud-operator/trigger/route.ts` | Playbooks, quality, policy packs, audit |
| `app/api/cloud-operator/status/route.ts` | Playbooks, quality, policy pack exposure |
| `app/api/cloud-operator/export/route.ts` | Playbooks markdown, quality gate, audit |
| `app/api/cloud-operator/request-implementation/route.ts` | Audit |
| `app/cloud-operator/page.tsx` | Tabs, Autopilot copy |
| `prisma/schema.prisma` | AuditLog model |
