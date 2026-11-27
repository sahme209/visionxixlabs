/**
 * Starting blueprint for VisionXIX Labs: the departments of the company and a first draft of the steps
 * in each. Steps that V19 already records are marked live and watch a live signal; the rest are drafts
 * for the founder to edit. Costs start at zero until the founder enters them.
 */
import { BLUEPRINT_KIND, BLUEPRINT_VERSION, type Blueprint, type BlueprintStep } from "./blueprint";
import { defaultAutomationFor } from "./automationDefaults";

type S = Partial<BlueprintStep> & Pick<BlueprintStep, "id" | "departmentId" | "title" | "col" | "row">;
const step = (s: S): BlueprintStep => ({ kind: "step", status: "draft", owner: "", roles: [], notes: "", cost: { minutesPerRun: 0, runsPerMonth: 0, hourlyRate: 0 }, tools: [], signal: null, automation: defaultAutomationFor(s.id), ...s });

export const DEFAULT_BLUEPRINT: Blueprint = {
  kind: BLUEPRINT_KIND,
  version: BLUEPRINT_VERSION,
  departments: [
    { id: "revops", name: "Revenue", group: "Business", description: "Money in: credits, usage billing, plans, renewals and at-risk accounts." },
    { id: "inbound", name: "Customers", group: "Business", description: "Visitors to signed-up, activated and active workspaces." },
    { id: "product-support", name: "Support", group: "Business", description: "Questions and feedback from intake to answer, with doc gaps closed by agents." },
    { id: "product-development", name: "Product", group: "Business", description: "From customer signal and parity items to merged change." },
    { id: "ai-operations", name: "Agents and AI", group: "Business", description: "Agents customers run, models, cost and margin." },
    { id: "finance", name: "Finance", group: "Business", description: "Costs, budgets and payouts." },
    { id: "gtm", name: "GTM", group: "Growth", description: "Positioning, website and launch." },
    { id: "outbound", name: "Outbound", group: "Growth", description: "Targeted outreach to engineering leaders." },
    { id: "partnerships", name: "Partnerships", group: "Growth", description: "Integrations, plugins and marketplace partners." },
    { id: "release", name: "Release and deployment", group: "Engineering", description: "Website and desktop releases through V19's own gates." },
    { id: "incidents", name: "Incident response", group: "Engineering", description: "Detect, stop the line, recover and learn." },
  ],
  autopilot: { paused: false },
  steps: [
    // GTM
    step({ id: "gtm-position", departmentId: "gtm", title: "Positioning and messaging", col: 0, row: 0 }),
    step({ id: "gtm-website", departmentId: "gtm", title: "Website and docs update", col: 0, row: 1, status: "live" }),
    step({ id: "gtm-launch", departmentId: "gtm", title: "Launch announcement", col: 0, row: 2 }),
    step({ id: "gtm-content", departmentId: "gtm", title: "Weekly content and video", col: 1, row: 1 }),
    // Inbound
    step({ id: "in-visit", departmentId: "inbound", title: "Visitor reads site or docs", col: 0, row: 0, kind: "start" }),
    step({ id: "in-signup", departmentId: "inbound", title: "Signs up and creates a workspace", col: 0, row: 1, status: "live", signal: "workspaces_new_30d" }),
    step({ id: "in-activated", departmentId: "inbound", title: "First governed deployment?", col: 0, row: 2, kind: "decision" }),
    step({ id: "in-nurture", departmentId: "inbound", title: "Onboarding reminder", col: 1, row: 2, status: "live" }),
    step({ id: "in-active", departmentId: "inbound", title: "Active workspace", col: 0, row: 3, kind: "end", signal: "workspaces_total" }),
    // Outbound
    step({ id: "out-list", departmentId: "outbound", title: "Build target account list", col: 0, row: 0, signal: "leads_30d" }),
    step({ id: "out-enrich", departmentId: "outbound", title: "Enrich leads", col: 0, row: 1, status: "testing" }),
    step({ id: "out-reach", departmentId: "outbound", title: "Personal outreach", col: 0, row: 2 }),
    step({ id: "out-demo", departmentId: "outbound", title: "Demo booked?", col: 0, row: 3, kind: "decision" }),
    // RevOps
    step({ id: "rev-eval", departmentId: "revops", title: "Enterprise evaluation", col: 0, row: 0 }),
    step({ id: "rev-credits", departmentId: "revops", title: "Prepaid AI credits", col: 0, row: 1, status: "testing" }),
    step({ id: "rev-renew", departmentId: "revops", title: "Renewal and expansion", col: 0, row: 2 }),
    step({ id: "rev-collected", departmentId: "revops", title: "Revenue collected", col: 1, row: 1, status: "live", signal: "revenue_30d_cents" }),
    step({ id: "rev-health", departmentId: "revops", title: "Customer health check", col: 1, row: 2, status: "live", signal: "at_risk_workspaces" }),
    // Product support
    step({ id: "sup-intake", departmentId: "product-support", title: "Feedback or ticket received", col: 0, row: 0, kind: "start", status: "live", signal: "feedback_30d" }),
    step({ id: "sup-docs", departmentId: "product-support", title: "Answered by docs?", col: 0, row: 1, kind: "decision", status: "testing" }),
    step({ id: "sup-ai", departmentId: "product-support", title: "Ask V19 reply with sources", col: 1, row: 1, status: "testing" }),
    step({ id: "sup-human", departmentId: "product-support", title: "Founder reviews and replies", col: 0, row: 2 }),
    step({ id: "sup-gaps", departmentId: "product-support", title: "Unanswered questions become docs", col: 1, row: 2, status: "live", signal: "unanswered_questions_30d" }),
    step({ id: "sup-close", departmentId: "product-support", title: "Resolved and doc gap logged", col: 0, row: 3, kind: "end" }),
    // Product development
    step({ id: "dev-idea", departmentId: "product-development", title: "Idea or parity item", col: 0, row: 0, kind: "start" }),
    step({ id: "dev-build", departmentId: "product-development", title: "Build locally with Claude", col: 0, row: 1, status: "live" }),
    step({ id: "dev-checks", departmentId: "product-development", title: "Tests, types, build, harness", col: 0, row: 2, status: "live" }),
    step({ id: "dev-pr", departmentId: "product-development", title: "One larger PR, CI green?", col: 0, row: 3, kind: "decision", status: "live" }),
    step({ id: "dev-merge", departmentId: "product-development", title: "Merged to main", col: 0, row: 4, kind: "end", status: "live" }),
    // Release
    step({ id: "rel-ready", departmentId: "release", title: "Release candidate on main", col: 0, row: 0, kind: "start", status: "live" }),
    step({ id: "rel-gates", departmentId: "release", title: "Gates: window, freeze, checks", col: 0, row: 1, status: "live", signal: "freezes_active" }),
    step({ id: "rel-approve", departmentId: "release", title: "Founder approves deploy?", col: 0, row: 2, kind: "decision", status: "live" }),
    step({ id: "rel-deploy", departmentId: "release", title: "Deploy and promote", col: 0, row: 3, status: "live", signal: "deployments_7d" }),
    step({ id: "rel-verify", departmentId: "release", title: "Verify health", col: 0, row: 4, status: "live", signal: "deployments_failed_7d" }),
    step({ id: "rel-rollback", departmentId: "release", title: "Roll back to last good", col: 1, row: 4, status: "live" }),
    // Incidents
    step({ id: "inc-detect", departmentId: "incidents", title: "Incident detected", col: 0, row: 0, kind: "start", status: "live", signal: "incidents_open" }),
    step({ id: "inc-freeze", departmentId: "incidents", title: "Freeze production", col: 0, row: 1, status: "live", signal: "freezes_active" }),
    step({ id: "inc-mitigate", departmentId: "incidents", title: "Mitigated?", col: 0, row: 2, kind: "decision" }),
    step({ id: "inc-review", departmentId: "incidents", title: "Postmortem and fixes", col: 0, row: 3, kind: "end" }),
    // Partnerships
    step({ id: "par-plugins", departmentId: "partnerships", title: "Plugin manifest review", col: 0, row: 0, status: "testing" }),
    step({ id: "par-list", departmentId: "partnerships", title: "List in the catalog", col: 0, row: 1 }),
    // Finance
    step({ id: "fin-costs", departmentId: "finance", title: "Monthly cost review", col: 0, row: 0 }),
    step({ id: "fin-budget", departmentId: "finance", title: "Vercel and cloud budgets", col: 0, row: 1, status: "live", tools: [{ name: "Vercel", monthlyCost: 10, oneTimeCost: 0, active: true }] }),
    step({ id: "fin-billing", departmentId: "finance", title: "Billing and payouts", col: 0, row: 2 }),
    // AI operations
    step({ id: "ai-requests", departmentId: "ai-operations", title: "Agent requests reviewed", col: 0, row: 0, status: "live", signal: "agent_requests_pending" }),
    step({ id: "ai-cost", departmentId: "ai-operations", title: "AI cost by task", col: 0, row: 1, status: "live", signal: "ai_cost_30d_cents" }),
    step({ id: "ai-webhooks", departmentId: "ai-operations", title: "Notifications delivered", col: 0, row: 2, status: "live", signal: "webhook_failures_7d" }),
  ],
  links: [
    { from: "rev-credits", to: "rev-collected", label: "" }, { from: "rev-health", to: "rev-renew", label: "at risk" }, { from: "sup-ai", to: "sup-gaps", label: "no answer" },
    { from: "gtm-position", to: "gtm-website", label: "" }, { from: "gtm-website", to: "gtm-launch", label: "" },
    { from: "in-visit", to: "in-signup", label: "" }, { from: "in-signup", to: "in-activated", label: "" }, { from: "in-activated", to: "in-active", label: "yes" }, { from: "in-activated", to: "in-nurture", label: "no" },
    { from: "out-list", to: "out-enrich", label: "" }, { from: "out-enrich", to: "out-reach", label: "" }, { from: "out-reach", to: "out-demo", label: "" },
    { from: "rev-eval", to: "rev-credits", label: "" }, { from: "rev-credits", to: "rev-renew", label: "" },
    { from: "sup-intake", to: "sup-docs", label: "" }, { from: "sup-docs", to: "sup-ai", label: "yes" }, { from: "sup-docs", to: "sup-human", label: "no" }, { from: "sup-human", to: "sup-close", label: "" },
    { from: "dev-idea", to: "dev-build", label: "" }, { from: "dev-build", to: "dev-checks", label: "" }, { from: "dev-checks", to: "dev-pr", label: "" }, { from: "dev-pr", to: "dev-merge", label: "yes" },
    { from: "rel-ready", to: "rel-gates", label: "" }, { from: "rel-gates", to: "rel-approve", label: "" }, { from: "rel-approve", to: "rel-deploy", label: "yes" }, { from: "rel-deploy", to: "rel-verify", label: "" }, { from: "rel-verify", to: "rel-rollback", label: "unhealthy" },
    { from: "inc-detect", to: "inc-freeze", label: "" }, { from: "inc-freeze", to: "inc-mitigate", label: "" }, { from: "inc-mitigate", to: "inc-review", label: "yes" },
    { from: "par-plugins", to: "par-list", label: "" },
    { from: "fin-costs", to: "fin-budget", label: "" }, { from: "fin-budget", to: "fin-billing", label: "" },
    { from: "ai-requests", to: "ai-cost", label: "" },
  ],
};
