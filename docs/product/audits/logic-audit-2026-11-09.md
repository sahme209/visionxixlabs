# Site and app logic audit (2026-11-09)

User request: "go very deeply through site and app logic; fix what doesn't make sense; make it fluent and smooth". Three read-only audits ran: public website, signed-in web app and APIs, and desktop app. Each finding was checked in code before it was fixed.

## Fixed in this batch

| Area | Problem | Fix |
|---|---|---|
| Web app | `/dashboard/*` always redirects to `/download` (proxy.ts), so the new Agent gateway and Trust tools pages were unreachable | Moved both to `/control/agent-gateway` and `/control/trust-tools`, added them to the Control navigation, sign-in returns to the page, and every link was updated (webhook reviewUrl, demo, support answers) |
| Support | FAQ claimed authenticated `/dashboard` redirects to download (wrong in two ways) | The FAQ now names `/control` for signed-in web pages and the desktop app for operations |
| Website | "Company" (nav) and "About" (footer) went to `/axiom`, which redirects to Product | Nav shows "Contact" (the open help path for signed-out visitors); footer About removed; the duplicate footer Security link removed |
| Website | Changelog links bounced to Product | Status links to GitHub release notes; Capabilities links to current releases; the unreachable changelog client was deleted |
| Website | Two FAQs with opposite pricing answers | `/faq` redirects (in the page) to `/docs/faq`, the single FAQ shared with Ask Axiom |
| Website | `/platforms` claims mobile apps that are not offered | Redirects (in the page) to `/download`. `/how-it-works` is kept: its claims are covered by the truthfulness test, and it has no inbound links |

| Website | Compare page claimed a "single fixed contract" and linked `/disciplines` (which redirects) | Reworded to the real model; reference removed |
| Website | The Plans "Buy prepaid credits" button went to `/dashboard/billing/add-ons` (redirects to download) | Goes through sign-in to `/control/usage-billing` |
| Website | Product "Get started" went to a guide, while "Get started" elsewhere means /plans | Relabelled "Read the setup guide" |
| Legal | "Last Updated" was `new Date()`, so it showed today on every visit | Fixed to the real last content change (October 13, 2026) |
| Demo | Step links into `/dashboard/*` bounced; `/dashboard/api-keys` did not exist | Desktop steps say "in the desktop app"; `/control` steps go through sign-in and are labelled; the key step says keys are issued on request today |
| Supporters | A paid buyer without a badge secret saw no explanation | Shows "your badge will be emailed when it is ready" |
| Desktop | Tray "Open in window" sent `view:approvals`, which no view handles | Opens Releases |
| Desktop | "Plugins & Skills" in the menu vs "Apps & skills" everywhere else; Docs CTAs "Open deployment requests" and "Open Airflow" vs Releases and Batches | One name each |

## Still open (recorded, not fixed here)

1. **Legal pages need a rewrite for Axiom** (owner and legal review). Privacy and Terms still describe VisaNova, RecallEase, consulting SOWs, retainers and late fees, and omit Axiom, prepaid AI credits, credit refunds and Founding Supporter purchases. Not rewritten automatically because these are legal terms.
2. ~~**Self-service API keys.**~~ Done in #248: `/control/api-keys`.
3. **The `/dashboard` tree is unreachable in the browser** (about 100 pages). Decide: delete it, or port the useful pages to `/control`. There are also duplicate approval surfaces (approvals, approval-packets, remediation-proposals, policy-proposals, agent-proposals); the canonical one should be `/control/governance`.
4. **Desktop dormant views.** About 50 view files in `desktop/src/views` are never rendered; move them out so nothing deep-links to them by mistake. The tray approval hooks are not mounted in the live app.
5. **Desktop focus re-verify.** A brief network drop on window focus can lock the workspace. Kept as is (fail-closed) pending a decision.
6. **Desktop shortcut order and "Log in" vs "Sign in" wording.** Low priority.
7. **Orphan marketing pages** `/capabilities` and `/trust` are reachable only indirectly. Link or retire them.
8. **Support vs Supporters naming.** `/support` is Founding Supporters while help is `/account/help`. Consider `/supporters` plus a public help hub.

9. `next.config.ts` is pinned by the owned-website build checks, so redirects there need that review. The `/products` double hop is left for it.
10. Desktop dormant views: about 40 tests import them directly, so they are kept as tested modules rather than moved.
