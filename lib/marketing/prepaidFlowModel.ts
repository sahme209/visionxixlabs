/**
 * Get started page pipe flow: how one AI action is paid for from prepaid credit.
 * Pure data for the shared PipeFlow kit, derived from the rate card's stated rules
 * (lib/billing/aiRateCard.ts): minimum top-up, credits never expire, a hold before the call,
 * final debit = margin × actual provider cost and never more than the hold, failed actions
 * released, never below zero, no automatic top-up.
 */
import type { PipeFlowStage } from "@/components/marketing/pipeKit/PipeFlow";
import { AI_RATE_CARD } from "@/lib/billing/aiRateCard";

const minUsd = `$${(AI_RATE_CARD.minimumTopUpCents / 100).toFixed(0)}`;
const margin = `${AI_RATE_CARD.marginMultiplier}x`;

export const PREPAID_FLOW_STAGES: readonly PipeFlowStage[] = [
  {
    id: "top_up",
    title: "Top up once",
    summary: `Add prepaid credit, from ${minUsd}, through Stripe Checkout.`,
    parts: [
      { title: "One-time payment", detail: "No subscription is created." },
      { title: "Never expires", detail: "Prepaid credit stays until you use it." },
      { title: "Refundable", detail: `Unused balance is refundable on request within ${AI_RATE_CARD.refundWindowDays} days of purchase.` },
    ],
    guarantee: "There is no automatic top-up and no post-use billing.",
    onFailure: "If checkout doesn't complete, no credit is added.",
    passesOn: { label: "prepaid balance", detail: "The credit your workspace can spend on AI actions." },
    tone: "sky",
  },
  {
    id: "quote",
    title: "See the cost first",
    summary: "Before an AI action runs, Axiom shows what it may cost.",
    parts: [
      { title: "Your AI level", detail: "Inspect, Engineer or DeepOps sets how many steps it can take." },
      { title: "Model rate", detail: `Provider rate × ${margin}, the same for every level.` },
      { title: "Estimated range", detail: "Shown on this page, by level." },
    ],
    guarantee: "The cost of an AI action is shown before it runs.",
    onFailure: "You can decide not to run it; nothing is held until you do.",
    passesOn: { label: "accepted action", detail: "The action you chose to run, at a cost you saw." },
    tone: "teal",
  },
  {
    id: "hold",
    title: "Hold credit",
    summary: "A conservative hold is placed on your balance before the call.",
    parts: [
      { title: "Hold, not a price", detail: "Sized for the maximum output, so it's larger than expected." },
      { title: "Hard stop", detail: "If your balance can't cover the hold, nothing runs." },
      { title: "Never below zero", detail: "You are never charged beyond what you prepaid." },
    ],
    guarantee: "No AI call starts without a held credit.",
    onFailure: "If your balance is too low, no call is made.",
    passesOn: { label: "held credit", detail: "Reserved balance that the action may use." },
    tone: "violet",
  },
  {
    id: "run",
    title: "Run",
    summary: "The governed AI action runs and the provider reports actual usage.",
    parts: [
      { title: "Workspace policy", detail: "Only the models your workspace allows." },
      { title: "Actual usage", detail: "The provider reports the tokens really used." },
      { title: "Failure released", detail: "A failed action is released in full." },
    ],
    guarantee: "You are not charged for a failed action.",
    onFailure: "If the call fails, the whole hold returns to your balance.",
    passesOn: { label: "actual usage", detail: "What the action really cost at provider rates." },
    tone: "amber",
  },
  {
    id: "settle",
    title: "Settle and release",
    summary: `You pay ${margin} the actual provider cost; the rest of the hold is released.`,
    parts: [
      { title: "Final debit", detail: `${margin} the actual provider cost, never more than the hold.` },
      { title: "Unused released", detail: "The rest of the hold returns to your balance." },
      { title: "Margin once", detail: "The margin is applied once, at debit time." },
    ],
    guarantee: "The final debit never exceeds the hold you saw placed.",
    onFailure: "The balance can never go below zero.",
    passesOn: null,
    tone: "emerald",
  },
];
