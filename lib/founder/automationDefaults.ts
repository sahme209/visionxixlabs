/**
 * Default automation for blueprint steps (pure). New steps and steps saved before automation existed
 * take these defaults, so the map starts autonomous without overwriting a choice the founder made.
 */
import type { AutomationMode } from "./blueprint";

/**
 * Who runs each step. Every step is autonomous by default: V19's autopilot and agents run it and
 * record what they did. Steps that spend money, contact people outside the company or are hard to
 * undo wait for the founder's approval.
 */
const AUTOPILOT = "V19 autopilot";
const AUTOMATION: Record<string, { mode: AutomationMode; agent: string }> = {
  "in-signup": { mode: "autonomous", agent: "V19 sign-up" },
  "in-nurture": { mode: "autonomous", agent: "V19 onboarding email" },
  "sup-ai": { mode: "autonomous", agent: "Ask V19" },
  "dev-build": { mode: "autonomous", agent: "Claude" },
  "dev-checks": { mode: "autonomous", agent: "GitHub Actions" },
  "dev-pr": { mode: "autonomous", agent: "Claude" },
  "rel-gates": { mode: "autonomous", agent: "V19 gates" },
  "rel-verify": { mode: "autonomous", agent: "V19 health checks" },
  "rel-rollback": { mode: "autonomous", agent: "V19 agent" },
  "inc-detect": { mode: "autonomous", agent: "V19 monitors" },
  "inc-freeze": { mode: "autonomous", agent: "V19 agent" },
  "ai-cost": { mode: "autonomous", agent: "V19 metering" },
  "ai-webhooks": { mode: "autonomous", agent: "V19 delivery" },
  // Money, outside contact or hard to undo: the founder approves.
  "rel-approve": { mode: "approval", agent: AUTOPILOT },
  "rel-deploy": { mode: "approval", agent: "Claude" },
  "rev-credits": { mode: "approval", agent: "V19 billing" },
  "rev-renew": { mode: "approval", agent: AUTOPILOT },
  "fin-billing": { mode: "approval", agent: "V19 billing" },
  "out-reach": { mode: "approval", agent: "Claude" },
  "gtm-launch": { mode: "approval", agent: "Claude" },
  "ai-requests": { mode: "approval", agent: "Workspace agents" },
};

export function defaultAutomationFor(stepId: string): { mode: AutomationMode; agent: string } {
  return { ...(AUTOMATION[stepId] ?? { mode: "autonomous", agent: AUTOPILOT }) };
}
