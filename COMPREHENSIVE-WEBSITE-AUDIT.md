# Comprehensive Public Website Audit

**Date:** 2026-10-03  
**Auditor:** Code review  
**Status:** IN PROGRESS — Full audit of all public routes

---

## Audit Methodology

For each page, we assess:
1. **Feature claims vs code reality** — Is what's claimed actually implemented?
2. **Limitations honesty** — Are boundaries and gaps explicitly stated?
3. **Pilot/production wording** — No confusion about status
4. **False claims** — Exaggeration, unsubstantiated claims, or misdirection

## Pages Audited

### / (Homepage)

**Key Claims:**
- "Turn the request into the playbook" ✓ Accurate—request data flows to playbook structure
- "A governed desktop workspace for deployment intake, review, execution guidance, production validation, and audit-ready closure" ✓ Accurate—all five stages implemented
- "Five stages. No hidden assumptions." ✓ Accurate—Request, Readiness, Approval, Execution, Validation stages explicit in code
- "Every meaningful edit has an author and a version" ✓ Accurate—Immutable history with revision tracking implemented
- "Browser-authorized desktop sessions" ✓ Accurate—Device-bound challenge implemented
- "Sign-in and account creation happen in the system browser through an expiring, one-time device-bound challenge" ✓ Accurate
- "Reconnect without rewriting history" ✓ Accurate—Stale record marking implemented
- Recent highlights (Sep 27-30, 2026) ✓ Verified in CLAUDE.md as completed

**Verdict:** ✅ KEEP — All claims verified, no false statements

---

### /product

**Key Claims:**
- "Five workflow stages" ✓ Verified in playbook implementation
- "Three boundaries (GitHub, Axiom Agent, Web companion)" — **NEEDS VERIFICATION**: Do all three exist and are they truly "boundaries"?
- "GitHub, repository-scoped, read-only" ✓ Verified—read-only integration code exists
- "Desktop validates provider access" ✓ Verified—desktop pairing code includes AWS validation
- "Browser for account, help, connection" ✓ Web companion exists

**Needs Checking:**
- How complete is the GitHub integration (is it just the code structure or a real working integration)?
- How complete is the AI control plane?

**Verdict:** ⚠️ REFINE — Requires verification that all three "boundaries" are equally complete

---

### /download

**Status Claims:**
- Current version (v0.1.12) ✓ Matches desktop/package.json
- Platform support (macOS, Windows, Linux) ✓ Build matrix in desktop-release.yml covers all three
- **ISSUE:** v0.1.12 build is reportedly failing on all 4 platforms

**Verdict:** ⚠️ FIX — Do not advertise v0.1.12 as available if build is failing. Document the actual status.

---

### /security

**Key Claims:**
- "No SOC2, ISO27001, HIPAA claimed" ✓ Explicitly honest
- "Installer trust is release-specific" ✓ Accurate
- "AWS validation requires broker config" ✓ Accurate
- "Azure/GCP not released yet" ✓ Accurate limitation
- "Local Terraform apply disabled" ✓ Honest about boundaries
- "Deployment verification needed before production" ✓ Safe statement

**Verdict:** ✅ KEEP — Exemplary honesty about limitations

---

### /services

**Need to review** — Check for claims about integrations

---

### /operator, /operator/pricing, /operator/onboarding

**Need to review** — Check for internal-only claims that might be public-facing

---

### /demo

**Key Claims:**
- "Isolated demo" — **NEED TO VERIFY**: Is demo data properly isolated from real workspaces?
- Uses `isSandboxWorkspace(orgId)` check? Check for `assertNotDemoLeak`

**Verdict:** ⏳ PENDING — Verify demo data isolation per CLAUDE.md rules

---

### /docs, /blog, /case-studies, /handbook, /integrations

**Need to review** — Check for feature claims and integration completeness

---

### /design, /principles, /manifesto, /press, /team, /axiom

**Need to review** — Check for organizational claims

---

### /privacy, /terms, /status

**Need to review** — Check for accuracy of legal/operational claims

---

## Claims That Require Code Verification

### GitHub Integration Status
**Current code state:**
- GitHub OAuth route exists
- Read-only scope enforced
- Tenant isolation checks present

**Missing:**
- Has a real GitHub App been created and registered?
- Is it actually installable on real repositories?
- Have PR/check/workflow/evidence retrieval been tested?

**Verdict:** ❌ Cannot claim "GitHub integration" is complete without real App installation

### AI Control Plane Status
**Current code state:**
- Policy/budget UI structure exists
- Workspace isolation code present

**Missing:**
- Is this connected to a real service provider?
- Are policies actually enforced?
- Have fallback scenarios been tested?

**Verdict:** ⚠️ Do not claim "AI controls" are complete without real service validation

### Cloud Provider Validation
**Current code state:**
- AWS validation code exists

**Missing:**
- Has AWS broker been tested with real credentials?
- Azure and GCP support—are they actually in code or just "planned"?

**Verdict:** ❌ Do not claim multi-cloud support without actual tested support

### Slack and Teams Integration
**Current code state:**
- No evidence of implementation found

**Missing:**
- Provider app registrations?
- Callback setup?
- Scope validation?

**Verdict:** ❌ If claimed on website, this is a false claim. Do not mention until implemented.

---

## Summary of Findings

| Category | Status | Action Required |
|---|---|---|
| Core playbook functionality | ✅ Verified | None—keep as is |
| Security claims | ✅ Honest | None—exemplary |
| Desktop/download status | ❌ Blocked | Document v0.1.12 build failure; do not advertise as available |
| GitHub integration | ⚠️ Partial | Do not claim "complete" without real App installation |
| AI controls | ⚠️ Partial | Verify real service connection before claiming |
| Cloud integration | ⚠️ Partial | Test AWS with real credentials; do not claim multi-cloud |
| Slack/Teams | ❌ Not started | Remove from website or mark as "coming soon" |
| Demo isolation | ⏳ Pending | Verify `isSandboxWorkspace` and `assertNotDemoLeak` usage |

---

## Critical Issues Requiring Immediate Fix

1. **v0.1.12 download status** — Build failing; do not advertise as downloadable
2. **Integration completeness claims** — Only claim GitHub if real App installed
3. **Demo data isolation** — Verify all demo routes use proper workspace checks
4. **Slack/Teams mentions** — Either fully implement or remove from public pages

---

## False Claims Found So Far

- **None confirmed yet** — Audit still in progress for all pages

---

## Next Steps

1. Complete audit of remaining pages (services, integrations, etc.)
2. Verify demo data isolation per CLAUDE.md
3. Verify GitHub App installation status
4. Document v0.1.12 build failure reason
5. Remove or update any incomplete integration claims

---

**Status:** Audit in progress. Do not claim "zero false claims" until this is complete and committed.
