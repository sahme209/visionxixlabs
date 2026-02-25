import type { LeadFormData } from "./leadSchema";

export interface PricingEstimate {
  min: number;
  max: number;
  breakdown: { label: string; min: number; max: number }[];
}

const MAX_TOTAL = 9000;

const BASE_PRICES = {
  new_website: { min: 2500, max: 6000 },
  redesign: { min: 2000, max: 5000 },
  landing_page: { min: 1200, max: 3000 },
} as const;

const PAGE_RATE = { perPage: 250, maxPages: 20 };
const ADDONS = {
  copywriting: { min: 400, max: 1500 },
  ecommerce: { min: 1200, max: 4000 },
  blog: { min: 400, max: 1200 },
  seo: { min: 400, max: 1500 },
  hostingManagement: { min: 250, max: 600 },
} as const;

export function estimatePricing(payload: LeadFormData): PricingEstimate {
  const breakdown: { label: string; min: number; max: number }[] = [];
  const base = BASE_PRICES[payload.projectType];
  breakdown.push({
    label: `${payload.projectType.replace(/_/g, " ")} (base)`,
    min: base.min,
    max: base.max,
  });

  let totalMin: number = base.min;
  let totalMax: number = base.max;

  const extraPages = Math.max(0, payload.numberOfPages - 5);
  if (extraPages > 0) {
    const pagesToCharge = Math.min(extraPages, PAGE_RATE.maxPages);
    const pageCost = pagesToCharge * PAGE_RATE.perPage;
    breakdown.push({
      label: `Additional pages (${pagesToCharge} × $${PAGE_RATE.perPage})`,
      min: pageCost,
      max: pageCost * 1.5,
    });
    totalMin += pageCost;
    totalMax += pageCost * 1.5;
  }

  if (payload.copywritingNeeded) {
    breakdown.push({ label: "Copywriting", ...ADDONS.copywriting });
    totalMin += ADDONS.copywriting.min;
    totalMax += ADDONS.copywriting.max;
  }

  const hasEcommerce = payload.projectGoals?.includes("ecommerce");
  if (hasEcommerce) {
    breakdown.push({ label: "E-commerce", ...ADDONS.ecommerce });
    totalMin += ADDONS.ecommerce.min;
    totalMax += ADDONS.ecommerce.max;
  }

  const hasBlog = payload.requiredSections?.toLowerCase().includes("blog");
  if (hasBlog) {
    breakdown.push({ label: "Blog / CMS", ...ADDONS.blog });
    totalMin += ADDONS.blog.min;
    totalMax += ADDONS.blog.max;
  }

  const hasSeo = payload.projectGoals?.some(
    (g) => g === "lead_generation" || g === "brand_awareness"
  );
  if (hasSeo) {
    breakdown.push({ label: "SEO setup", ...ADDONS.seo });
    totalMin += ADDONS.seo.min;
    totalMax += ADDONS.seo.max;
  }

  if (payload.hostingDomainStatus === "need_hosting") {
    breakdown.push({ label: "Hosting & domain setup", ...ADDONS.hostingManagement });
    totalMin += ADDONS.hostingManagement.min;
    totalMax += ADDONS.hostingManagement.max;
  }

  totalMin = Math.round(totalMin);
  totalMax = Math.round(Math.min(totalMax, MAX_TOTAL));

  return { min: totalMin, max: totalMax, breakdown };
}
