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
- Release manifest fetched from GitHub — **CRITICAL**: v0.1.12 build failed on all 4 platforms

**How it Works:**
- Page fetches `/api/desktop/release-manifest` from `sahme209/axiom-releases` repo
- Shows "Released · v0.1.12" badge when assets exist
- Shows "No verified installer is currently available" (amber badge) when build failed

**Current State:**
- If v0.1.12 build never completed, no release assets were published
- Download page will correctly show amber badge + "No verified installer"
- This is honest behavior — no false claims

**Verdict:** ✅ KEEP — Page correctly reflects build status via manifest. The real issue is: Why did v0.1.12 build fail on all 4 platforms?

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

### /integrations

**Key Claims (Status Catalog):**

The page lists ALL integrations with honest status labels:

- **AWS:** "configuration required" ✓ Honest—code exists but live validation requires customer setup
- **GitHub:** "preview" ✓ Honest—inventory adapters exist, live org-scoped installation not verified
- **Slack:** "implementation review" ✓ Honest—notification code exists, customer OAuth/delivery not release-verified
- **Azure/GCP:** "preview" ✓ Honest about what's not released
- **GitLab, Linear, PagerDuty, Dynatrace:** "planned" ✓ Clear that no activation path is published
- **CloudWatch, Grafana:** "implementation review" ✓ Code exists, customer setup not verified
- **PostgreSQL, MySQL:** "implementation review" ✓ DDL exists, end-to-end journey not verified

**Pattern:** Each integration includes a label + detail explaining exactly what's implemented vs not released.

**Verdict:** ✅ KEEP — Exemplary honesty about integration status. No false claims about what's ready.

---

### /docs, /blog, /case-studies, /handbook

**Need to review** — Check for feature claims and resource completeness

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
| Integration catalog (/integrations) | ✅ Honest | None—exemplary status labeling |
| Download page | ✅ Correct | Shows accurate status based on GitHub manifest |
| GitHub integration | ⚠️ Partial | Do not claim "complete" without real App installation |
| AI controls | ⚠️ Partial | Verify real service connection before claiming |
| Cloud integration | ⚠️ Partial | Test AWS with real credentials; do not claim multi-cloud |
| Slack/Teams | ✅ Honest | Marked as "implementation review" on /integrations page |
| Demo isolation | ⏳ Pending | Verify `isSandboxWorkspace` and `assertNotDemoLeak` usage |
| v0.1.12 build | ❌ Failed | All 4 platforms failed; root cause must be diagnosed |

---

## Critical Issues Requiring Immediate Fix

1. **v0.1.12 build failure on all platforms** — Must diagnose GitHub Actions error
2. **GitHub App installation not confirmed** — Do not claim live integration without verification
3. **Demo data isolation** — Verify all demo routes use proper workspace checks per CLAUDE.md
4. **Slack/Teams status** — Currently marked "implementation review" — accurate, keep as is

---

## False Claims Found

**NONE CONFIRMED** — Website is remarkably honest about:
- What's implemented vs what's preview vs what's planned
- Security limitations (no SOC2, no autonomous deploy, etc.)
- Integration status (marked with completion levels)
- Build availability (shows actual manifest state)

The website does NOT claim things it doesn't have. The issue is not false claims but rather:
- **Unverified integrations** (GitHub, AI controls need real service validation)
- **Build failure diagnosis** (v0.1.12 crashed on all platforms; must investigate)
- **Demo isolation** (must confirm no demo data leaks to real workspaces)

---

## Next Steps

1. Complete audit of remaining pages (services, integrations, etc.)
2. Verify demo data isolation per CLAUDE.md
3. Verify GitHub App installation status
4. Document v0.1.12 build failure reason
5. Remove or update any incomplete integration claims

---

**Status:** Audit in progress. Do not claim "zero false claims" until this is complete and committed.
