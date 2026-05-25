/**
 * /operator/pricing — server-side redirect to /plans.
 *
 * The site used to have four different pricing pages with inconsistent
 * shells (one under (marketing), one at /pricing, one at /axiom/pricing,
 * one here). The Footer linked to this one, the main Navigation linked
 * to /plans, so clicking 'Pricing' in different places dropped users
 * into visually different experiences.
 *
 * /plans is now the single canonical pricing route. This file (and
 * /pricing) just redirect there so any external link or old footer
 * cache still works.
 */

import { redirect } from "next/navigation";

export default function OperatorPricingRedirect(): never {
  redirect("/plans");
}
