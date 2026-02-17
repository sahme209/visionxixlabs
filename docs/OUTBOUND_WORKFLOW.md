# Outbound Assistance System

Structured workflow for outbound lead development. **Limit automation; prioritize personalization.**

---

## Weekly cadence

- **Target:** Identify and work **10 companies per week** (not more — quality over volume).
- **Outputs per company:** Personalized analysis, outreach message, custom demo outline.
- **Tracking:** Log responses and next steps (spreadsheet or CRM).

---

## Step 1 — Identify 10 companies weekly

- Use a consistent set of criteria (ICP: company size, industry, cloud/AI adoption signals).
- Sources: LinkedIn, job boards, tech news, existing network, inbound form data.
- Record: Company name, domain, key contacts (if known), why they fit ICP, source.

**No bulk scraping.** Manual or semi-manual selection so each company is a deliberate choice.

---

## Step 2 — Generate personalized analysis

For each company (before outreach):

- **What we know:** Size, tech stack hints, recent news, job postings (cloud/AI roles), funding or growth signals.
- **Relevant pain points:** Based on ICP (e.g. security, cost, DevOps maturity, AI adoption).
- **One-sentence hook:** Why our offer (e.g. Free Cloud & AI Review) is relevant to them specifically.

Keep it to a short paragraph or bullet list. This is for internal prep and for personalizing the message.

---

## Step 3 — Generate outreach message

- **One primary contact** per company (or one channel, e.g. LinkedIn or email).
- Message should:
  - Reference something specific about them (from the analysis).
  - State the offer clearly (e.g. Free Cloud & AI Infrastructure Review).
  - One clear CTA (e.g. reply to schedule, or link to `/free-review`).
  - Short (a few lines). No hype, no fake urgency.
- **Do not** use the same template for everyone; vary the opener and the “why you” line.

---

## Step 4 — Prepare custom demo outline

- Use the [Demo Framework](./DEMO_FRAMEWORK.md) (8 slides).
- Fill in what we know or assume: their stage, cloud maturity, likely security gaps, DevOps improvements, AI opportunity, cost governance.
- This document is for **our** use on the call — not sent in the first email. It ensures we’re prepared when they say yes.

---

## Step 5 — Track responses

- Log: Company, date contacted, channel, response (none / positive / negative / meeting set).
- Follow-up: One or two polite follow-ups if no response; then pause for that company.
- No automation of sending. Each message is reviewed before it goes.

---

## Tools (suggested, not required)

- **Spreadsheet:** Columns = Company, Contact, Source, Date contacted, Message (link or summary), Response, Demo outline (link).
- **CRM:** If you use one, same fields. Pipeline stages: Identified → Contacted → Replied → Meeting set → Done / Lost.
- **Drafts:** Use `scripts/outbound_leads.py` for draft generation only; send manually after editing.

---

## Summary

| Step | Action | Output |
|------|--------|--------|
| 1 | Identify 10 companies/week | List with company, contact, source |
| 2 | Personalized analysis | Short brief per company |
| 3 | Outreach message | One personalized message per company |
| 4 | Demo outline | Custom 8-slide outline (internal) |
| 5 | Track | Response and next steps logged |

**Principle:** Fewer, better-targeted touches beat high-volume generic outreach.
