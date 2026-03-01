/**
 * Website Builder — separate product pricing (display only).
 * @deprecated Use MEMBERSHIP_PLANS from @/lib/pricing/membership for entitlements.
 * Display-only; UI still uses BUILDER_PLANS for /builder/pricing page.
 * Track: builder
 * Plans: Starter (Website only), Pro (Website + Chatbot), Business (Website + Chatbot + Advanced Deploy)
 */

export type BuilderPlanId = "starter" | "pro" | "business";

export interface BuilderPlan {
  id: BuilderPlanId;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  description: string;
  popular?: boolean;
  features: string[];
  /** Has chatbot add-on */
  chatbot: boolean;
  /** Has advanced deploy (CI/CD, custom domain, etc.) */
  advancedDeploy: boolean;
}

export const BUILDER_PLANS: Record<BuilderPlanId, BuilderPlan> = {
  starter: {
    id: "starter",
    name: "Starter",
    monthlyPrice: 29,
    yearlyPrice: 210,
    description: "Website only",
    popular: false,
    chatbot: false,
    advancedDeploy: false,
    features: [
      "AI website generation",
      "Real preview (iframe render)",
      "One-click deploy",
      "Up to 3 sites",
      "3 revisions per site",
      "CDN + SSL",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthlyPrice: 59,
    yearlyPrice: 426,
    description: "Website + Chatbot",
    popular: true,
    chatbot: true,
    advancedDeploy: false,
    features: [
      "Everything in Starter",
      "Chatbot add-on (1 bot)",
      "Up to 10k messages/month",
      "White-label embed",
      "Lead capture",
      "Up to 10 sites",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    monthlyPrice: 149,
    yearlyPrice: 1074,
    description: "Website + Chatbot + Advanced Deploy",
    popular: false,
    chatbot: true,
    advancedDeploy: true,
    features: [
      "Everything in Pro",
      "Advanced deploy (CI/CD)",
      "Custom domain support",
      "Priority deploy",
      "Unlimited revisions",
      "Up to 25 sites",
    ],
  },
};
