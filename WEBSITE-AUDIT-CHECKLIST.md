# Website Visual Consistency Audit Checklist

**Status:** In progress  
**Date:** 2026-10-03  
**Purpose:** Verify visual consistency across public pages and audit claims

## Design System Baseline

**Color Palette:**
- Primary: Violet (#a78bfa, #7c3aed)
- Success: Emerald (#10b981, #34d399)
- Warning: Amber (#f59e0b)
- Error: Rose (#f43f5e, #e11d48)
- Neutral: Zinc (#27272a → #fafafa)

**Typography:**
- Headings: Bold, tracking-tight (h1: 32px, h2: 24px, h3: 18px)
- Body: 13px, leading-relaxed
- Mono: 12px for code/technical
- Line heights: 1.5 (body) to 1.2 (headings)

**Spacing:**
- Grid: 4px base unit
- Padding: 16px (interior), 24px (sections)
- Gaps: 12px (inline), 24px (block)
- Border radius: 12px (default), 16px (large cards)

**Borders:**
- Default: `border-white/[0.06]`
- Highlight: `border-white/[0.12]`
- Colored: `border-{color}-500/[0.25]`

---

## Key Pages to Audit

### [ ] 1. `/` — Homepage

**Content Verification:**
- [ ] Hero section clearly states what Axiom is
- [ ] Value proposition is clear without exaggeration
- [ ] CTA buttons are visible and functional
- [ ] Navigation to key sections (Product, Pricing, Security)

**Visual Consistency:**
- [ ] Header matches `/dashboard` style
- [ ] Color palette consistent (violet accents)
- [ ] Typography scales correctly
- [ ] Spacing aligned to 4px grid
- [ ] Border radius 12px for cards
- [ ] Dark mode rendering correct
- [ ] Mobile responsive (375px, 768px, 1280px)

**False Claim Check:**
- [ ] No "production-ready" claims while desktop build fails
- [ ] No "perfect security" claims
- [ ] No "infinitely scalable" claims
- [ ] Deployment timeline realistic

---

### [ ] 2. `/product` — Product Capabilities

**Content Verification:**
- [ ] Features are honest and accurate
- [ ] AI/automation claims are truthful
- [ ] No feature duplication with docs
- [ ] Links to relevant pages work

**Feature Claims to Verify:**
- [ ] "Release governance" — Verified in code ✓
- [ ] "Approval chains" — AxiomApprovalChain exists ✓
- [ ] "Readiness scoring" — ReleaseReadinessSnapshot exists ✓
- [ ] "Desktop application" — exists but v0.1.12 build failing ⚠️
- [ ] "AI engineers" — workforce features exist ✓
- [ ] "Audit trail" — AuditEvent table exists ✓

**Visual Consistency:**
- [ ] Typography consistent with `/`
- [ ] Color usage matches system
- [ ] No inline styles (use classes)
- [ ] Feature cards have consistent padding
- [ ] Icons from Heroicons only

---

### [ ] 3. `/pricing` — Pricing & Plans

**Content Verification:**
- [ ] Plans accurately reflect product
- [ ] No impossible claims about included features
- [ ] Feature comparisons are truthful

**Plan Limits to Verify:**
- [ ] "Unlimited releases" — check planRegistry.ts
- [ ] "5 approval chains" — check if enforced
- [ ] "Real-time sync" — check actual behavior
- [ ] Support tiers match product capability

**Visual Consistency:**
- [ ] Price formatting consistent
- [ ] Feature comparison table aligned
- [ ] CTA buttons prominent
- [ ] Mobile wrapping correct

---

### [ ] 4. `/security` — Security & Compliance

**Content Verification:**
- [ ] Security features match implementation
- [ ] Compliance certifications are current
- [ ] No false compliance claims
- [ ] Incident disclosure policy honest

**Claims to Verify:**
- [ ] "End-to-end encryption" — Verify cryptographic signatures ✓
- [ ] "SOC2 audit trail" — AuditEvent/corr ID handling ✓
- [ ] "Zero-knowledge pairing" — Desktop pairing device binding ✓
- [ ] "Role-based access" — AuthZ checks in code ✓

**Visual Consistency:**
- [ ] Security icons professional
- [ ] Trust badges authentic
- [ ] Compliance logos properly sized
- [ ] No exaggerated visual claims

---

### [ ] 5. `/download` — Desktop App

**Content Verification:**
- [ ] Installation steps are accurate
- [ ] System requirements listed
- [ ] v0.1.12 build status documented ⚠️

**Links:**
- [ ] Download links point to correct releases repo
- [ ] Release notes link works
- [ ] Build status is current

**Visual Consistency:**
- [ ] Platform icons (macOS/Windows/Linux) correct
- [ ] Version numbers accurate
- [ ] File sizes displayed
- [ ] Checksums available

---

### [ ] 6. `/docs` — Documentation

**Content Verification:**
- [ ] Quick start guide is complete
- [ ] API reference matches implemented endpoints
- [ ] Code examples work
- [ ] Links to resources valid

**Visual Consistency:**
- [ ] Code blocks properly highlighted
- [ ] Sidebar navigation scrolls correctly
- [ ] Breadcrumbs work
- [ ] Search functions

---

## Audit Summary Template

For each page, use this template:

```
## Page: [URL]

### Visual Consistency: [✓/✗/⚠️]
- Header/Footer: [consistent/inconsistent/notes]
- Typography: [correct/issues]
- Colors: [match system/needs adjustment]
- Spacing: [aligned/off]
- Responsive: [passes/fails at X viewport]

### Content Verification: [✓/✗/⚠️]
- Accuracy: [all claims verified/issues found]
- Missing links: [list any broken]
- Images: [all load/missing]

### False Claims Check: [✓/✗/⚠️]
- Claims: [list checked]
- Issues: [any exaggerations]

### Notes:
[Any additional findings]
```

---

## Blockers & Known Issues

1. **v0.1.12 desktop build:** All platforms failing — cannot claim "production-ready"
2. **Website build:** Must run `npm run build` to validate type safety
3. **Mobile testing:** Requires actual device or proper emulation
4. **SSL/TLS:** Must verify on production domain, not localhost

---

## Next Steps

1. **Immediate (30 min):** Run through all 6 pages with above checklist
2. **Quick fixes (30 min):** Address any obvious visual inconsistencies
3. **Content audit (1 hour):** Verify claims against codebase and docs
4. **Responsive test (20 min):** Test at 3 viewport sizes
5. **Regression test (15 min):** Verify no links broken

---

## Pass Criteria

- ✓ All 6 pages pass visual consistency check
- ✓ All content claims verified against code
- ✓ No false claims remain on site
- ✓ Responsive design works at 375px, 768px, 1280px
- ✓ No broken links
- ✓ Build succeeds with no TypeScript errors
