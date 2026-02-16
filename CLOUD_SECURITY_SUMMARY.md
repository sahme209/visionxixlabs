# Cloud Security & Infrastructure Hardening — Implementation Summary

## Pages created

| Route | Description |
|-------|-------------|
| **/cloud-security** | Dedicated page: hero "Secure-by-Design Cloud Engineering", 4 security service cards, "How we access your environment" (we operate using + what we are not + we focus on), trust principles block, FAQ accordion, CTA. |

**Homepage:** New section *"Secure-by-Design Cloud Engineering"* added after Growing Teams, with short blurb and link to `/cloud-security`.

---

## Components created

| Component | Purpose |
|-----------|---------|
| **SecurityServiceCard** | Card for each security offering: name, description, includes (bullets), best for, "Discuss this service" link. Uses `SecurityService` type from content. |
| **SecurityPrinciplesBlock** | Section with optional title and list of trust statements (e.g. "Security is embedded in architecture decisions."). |
| **AccessModelSection** | Two-column layout: "We operate using" (bullets) and "What we are not" + "We focus on" (bullets). Reassures clients about access and sets boundaries. |
| **FAQAccordion** | Existing component; used with `cloudSecurityFAQ` from content. |

---

## Content — where to update

All copy lives in **`lib/cloudSecurityContent.ts`**:

| Export | Contents |
|--------|----------|
| **cloudSecurityHero** | `title`, `subtitle` for page hero. |
| **cloudSecurityServices** | Array of 4 services: Cloud Security Baseline, Deployment & DevOps Hardening, AI Infrastructure Security Review, Cloud Visibility & Monitoring Setup. Each has `id`, `name`, `description`, `includes[]`, `bestFor`. |
| **accessModelItems** | "We operate using" bullets (role-based IAM, federated auth, no shared credentials, etc.). |
| **whatWeAreNot** | "What we are not" bullets (SOC2 audit firm, pentest service, compliance-only). |
| **whatWeFocusOnSecurity** | "We focus on" bullets (practical hardening, infrastructure protection, etc.). |
| **securityPrinciples** | Trust statements for the principles block. |
| **cloudSecurityFAQ** | FAQ items (`question`, `answer`) for the accordion. |

To add or change a security offering, edit `cloudSecurityServices`. To change access or positioning copy, edit the corresponding arrays in the same file.

---

## Navigation and footer

- **Nav:** "Cloud Security" link added (desktop and mobile) → `/cloud-security`.
- **Footer:** "Cloud Security" added under Solutions (after Cloud Solutions).

---

## Tone and positioning

- Calm, professional, technical. No fear-based marketing or exaggerated stats.
- Clear "what we are not" to avoid being mistaken for an audit or pentest firm.
- Access model and trust language reinforce secure-by-design positioning.
