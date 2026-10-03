# Axiom Agent — Complete Product Implementation Plan

**Current Status:** Architecture solid, testing and UX work remain  
**Target:** Complete, secure, truthful, premium release-governance product  
**Branch:** codex/workspace-integration-foundation

---

## Requirements Checklist (11 Total)

### ✅ COMPLETED / VERIFIED
- [x] **Security baseline (10)** — Verified throughout: least authority, tenant isolation, same-origin mutations, short-lived state, encrypted credentials, fail-closed
- [x] **AI control plane (8)** — Policy architecture complete, workspace governance working, status endpoints truthful
- [x] **Real integrations: GitHub (7)** — OAuth, token scoping, validation, evidence collection complete; ready for real testing

### 🚧 IN PROGRESS / PARTIALLY DONE
- [ ] **Release-quality verification (11)** — Started desktop build; awaiting v0.1.12 completion
- [ ] **Website content truthfulness (6)** — Pricing ✓; need to audit: Product, Capabilities, Security, Download, Changelog, Docs, Resources

### ❌ NOT STARTED / NEEDS IMPLEMENTATION
- [ ] **Playbook-first product (1)** — Unify request/readiness/playbook/risk/approval/exec/validation/evidence/closure
- [ ] **Real release story (2)** — Visual flow with progressive disclosure
- [ ] **Website visual consistency (3)** — Dark identity, original imagery, calm typography, no Cursor copies
- [ ] **Signed-in web companion (4)** — Persistent shell with safe settings
- [ ] **Mobile experience (5)** — Full nav, responsive, accessible, intentional layout
- [ ] **Slack & Teams (7)** — Real app registrations, OAuth, validation
- [ ] **Cloud health (7)** — AWS read-only, then observability, then GCP/Azure
- [ ] **Deployment rehearsal investigation (9)** — Docker/isolated checks truthfulness

---

## Work Breakdown By Priority & Time Estimate

### PHASE 1: IMMEDIATE (Today/Tomorrow)
**Goal:** Fix blocking desktop issue, audit top web pages, plan playbook unification

#### 1A. Retry v0.1.12 Desktop Build [0.5 hours]
- Delete/recreate tag or use workflow_dispatch
- Monitor for success
- If fails: request admin logs
- **Validates:** Workflow fix works, clean-host test can proceed

#### 1B. Website Truthfulness Audit [2 hours]
**Pages to audit:**
- [ ] /product (claims about governance, approval, evidence)
- [ ] /capabilities (AI, autonomy, integrations)
- [ ] /security (controls, not certifications)
- [ ] /download (installer availability, limitations)
- [ ] /changelog (user impact vs. implementation details)
- [ ] /docs (Get Started vs. Reference structure)
- [ ] /resources (only current content)

**Audit criteria:**
- No exaggerated AI autonomy claims
- No false certifications (SOC 2, HIPAA, FedRAMP)
- No fake integrations or "coming soon" as "available"
- No pricing tiers that don't exist
- No customer testimonials
- Clear limitations (read-only, no autonomous deployment)

#### 1C. Playbook Unification Design [1 hour]
- Document data model for unified playbook
- Sketch UI flow (Request → Closure)
- List all components to consolidate
- Estimate implementation time

**Output:** Implementation spec for Phase 2

---

### PHASE 2: SHORT TERM (This Week)
**Goal:** Landing pages solid, playbook flow started, mobile verified

#### 2A. Fix Website Content Issues [2-3 hours]
- Apply findings from 1B
- Update claims to match reality
- Remove overstated features
- Restructure docs if needed
- Add missing limitations/disclaimers

#### 2B. Signed-in Companion Shell [4-6 hours]
- Extract Integrations, Settings, Help into persistent sidebar
- Implement account display (email, pilot status, usage)
- Safe settings (no role/workspace/approval edits)
- Sign-out flow
- Verify no unsafe mutations

#### 2C. Mobile Experience Audit [2 hours]
- Responsive layout check
- Hamburger nav completeness
- Touch target sizing
- Accessibility (focus, labels, ARIA)
- Reduced motion support
- Fixes to layout/nav issues

#### 2D. Playbook Detail Page Structure [4-6 hours]
- Create unified release detail route
- Layout: Request section → Readiness → Playbook → Risk → Approval → Execution → Validation → Evidence → Closure
- Progressive disclosure (What/Attention/Changed)
- Unify existing components
- Add state transition visualization

#### 2E. Clean-Host Desktop Test [1 hour]
- After v0.1.12 succeeds
- Download installer
- Install on clean machine
- Test full pairing flow
- Verify no deviceFingerprint errors

---

### PHASE 3: MEDIUM TERM (Next 1-2 Weeks)
**Goal:** Real integrations tested, visual consistency complete

#### 3A. GitHub Integration End-to-End Test [2 hours]
- Create free test GitHub org
- Register real GitHub App
- Test full consent → validation → evidence flow
- Verify repository scoping works
- Document setup for future testing

#### 3B. Website Visual Consistency [4-6 hours]
- Review all pages for dark Axiom identity
- Replace any Cursor-inspired layouts/text
- Verify original scenic imagery on all pages
- Calm typography (review Home, Product, Capabilities)
- Remove grid/check-line noise
- Edge-to-edge content review
- Background style consistency

#### 3C. Playbook Features & Polish [6-8 hours]
- State transition controls
- Approval workflow integration
- Rollback context display
- Evidence pack linking
- Audit trail visibility
- Revision history
- Progressive closure workflow

#### 3D. Slack & Teams Real Setup [3-4 hours]
- Slack: obtain app ID, secret, scopes
- Microsoft: obtain app ID, secret, tenant
- Configure callback URLs
- Test consent flow
- Test validation (encrypted, state-bound)
- Test revocation

#### 3E. AWS Read-Only Health [2-3 hours]
- Set up test AWS account
- Create minimal IAM role (read-only EC2, CloudWatch)
- Implement health check endpoint
- Test validation + audit trail
- Document setup limitations

---

### PHASE 4: LONGER TERM (2-4 Weeks)
**Goal:** Full feature set, comprehensive testing

#### 4A. Observability Integration (CloudWatch / Sentry / Datadog) [3-4 hours]
- Choose one (CloudWatch for AWS pilot)
- Implement read-only health probe
- Link to post-release validation
- Audit trail

#### 4B. Deployment Rehearsal Investigation [2-3 hours]
- Research Docker approach for Terraform/policy checks
- Design truthful "validation" (not "production sandbox")
- Implement harmless checks
- Clearly separate from actual deployment

#### 4C. Usage & Budget Controls [2-3 hours]
- Implement AI provider usage tracking
- Add spend alerts/budgets per workspace
- Audit logging for policy violations
- Dashboard display

#### 4D. Full Test Suite [4-6 hours]
- GitHub integration tests (real GitHub flow)
- AI policy enforcement tests
- Desktop pairing validation tests
- Release workflow state tests
- Mobile/accessibility tests

#### 4E. Performance & UX Optimization [2-3 hours]
- Identify slow endpoints
- Optimize manifests/queries
- Verify all images optimized
- Test on slow networks/devices

---

## Blocked Items (Require User Action / External Credentials)

| Item | Blocker | Action Needed |
|------|---------|---------------|
| Desktop v0.1.12 publish | Build failure, no logs | Retry build or request admin logs |
| GitHub real testing | Needs test org + app | Create free GH org, register app |
| Slack integration | Needs app credentials | Register Slack app, get credentials |
| Teams integration | Needs Azure app + tenant | Register Microsoft app, get credentials |
| AWS health | Needs test account | Create AWS account with test role |
| Cloud integrations | Needs GCP/Azure accounts | Create if pilot needs them |

---

## Definition of Done (Each Requirement)

### 1. Playbook-First Product
- [ ] Unified release detail view
- [ ] Request → Closure journey visible on one page
- [ ] Progressive disclosure working (What/Attention/Changed)
- [ ] All existing release ops merged into playbook view
- [ ] Tested with real release scenario

### 2. Real Release Story
- [ ] Visual flow with icons/stages
- [ ] Desktop/mobile responsive
- [ ] No feature walls, clean cards
- [ ] Tested on real data

### 3. Website Visual Consistency
- [ ] All pages use dark Axiom canvas
- [ ] Original scenic imagery (no Cursor copies)
- [ ] Calm, smaller typography reviewed
- [ ] No grid/check-line noise
- [ ] No edge-to-edge stretching
- [ ] Consistent background styles
- [ ] Tested on desktop/mobile

### 4. Signed-In Web Companion
- [ ] Persistent shell (nav + settings area)
- [ ] Integrations, Settings, Help inside
- [ ] Account display (email, pilot, usage)
- [ ] Sign-out working
- [ ] No unsafe setting edits
- [ ] Mobile layout intentional
- [ ] Tested user flows

### 5. Mobile Experience
- [ ] Full hamburger nav (not just Product)
- [ ] Scenic/product preview responsive
- [ ] Touch targets 44px+
- [ ] No overflowing panels
- [ ] Focus management, scroll lock
- [ ] Keyboard nav working
- [ ] Reduced motion respected
- [ ] Accessibility audit passed

### 6. Website Content Truthfulness
- [ ] No exaggerated AI claims
- [ ] No false certifications
- [ ] No invented pricing tiers
- [ ] No fake integrations
- [ ] Clear read-only boundaries
- [ ] Download page honest
- [ ] Changelog structure correct
- [ ] Docs separated properly

### 7. Real Integrations: GitHub
- [ ] End-to-end test with real org
- [ ] Repository scoping verified
- [ ] Evidence collection working
- [ ] Validation fresh/stale states correct
- [ ] Revocation working
- [ ] Audit trail complete
- [ ] **Then: Slack & Teams**
- [ ] **Then: AWS health**

### 8. AI Control Plane
- [ ] Provider policy UI working
- [ ] Usage tracking visible
- [ ] Budget controls (if time)
- [ ] Audit history visible
- [ ] Settings safe (no key exposure)
- [ ] Fallback order clear
- [ ] Tested with real provider

### 9. Deployment Rehearsal
- [ ] Docker checks identified
- [ ] Truthful scoping (not "prod sandbox")
- [ ] Limitations documented
- [ ] Not marketed as equivalent to real deploy
- [ ] Safe checks only (no mutations)

### 10. Security Baseline
- [ ] All 11 principles verified in code review
- [ ] Tenant isolation audit passed
- [ ] No default production mutation
- [ ] Credentials never exposed
- [ ] Fail-closed behavior confirmed

### 11. Release-Quality Verification
- [ ] v0.1.12 build succeeds
- [ ] Clean-host desktop test passed
- [ ] Workflow version validation works
- [ ] Web tests passing
- [ ] Desktop/mobile nav verified
- [ ] Accessibility audit passed
- [ ] Performance acceptable
- [ ] Real integration test (GitHub)

---

## Time Estimates

| Phase | Duration | Work |
|-------|----------|------|
| **Phase 1** | 3.5 hours | Desktop build, website audit, playbook design |
| **Phase 2** | 13-17 hours | Web companion, playbook detail, mobile, content fixes |
| **Phase 3** | 18-22 hours | Visual consistency, GitHub test, Slack/Teams, AWS |
| **Phase 4** | 13-17 hours | Observability, rehearsal investigation, tests, perf |
| **TOTAL** | **47.5-61 hours** | Complete product |

---

## Daily Cadence

### Today (Now)
1. v0.1.12 build retry (0.5h)
2. Website audit (2h)
3. Playbook design spec (1h)

### Tomorrow
4. Web companion shell (4h)
5. Mobile audit (2h)
6. Content fixes (2h)

### This Week
7. GitHub real test (2h)
8. Playbook detail page (6h)
9. Visual consistency review (3h)

### Following Week
10. Slack/Teams setup (3h)
11. AWS health (2h)
12. Feature polish & tests (4h)

---

## Success Criteria

At the end of this work, Axiom will be:

✓ **Technically complete:** GitHub, AI, Desktop pairing verified secure  
✓ **Visually cohesive:** Dark, original, calm, no copied design  
✓ **Truthful:** No exaggerated claims, clear limitations  
✓ **Playbook-centered:** One unified release journey  
✓ **Tested:** Real GitHub integration, clean-host desktop, mobile accessible  
✓ **Secure:** Tenant isolation, no credential exposure, audit trails  
✓ **Premium:** Intentional UX, progressive disclosure, no feature walls  

A genuine, secure, governed release-management product—ready for real pilots.
