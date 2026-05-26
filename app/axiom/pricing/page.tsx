/**
 * /axiom/pricing — server-side redirect to the canonical /plans route.
 *
 * Phase 438: the prior standalone Axiom pricing page rendered fixed
 * monthly numbers + Stripe Payment Links for an Axiom-specific tier
 * ladder. The new pricing model is usage-aware (cloud cost +
 * VisionXIXLabs ops layer), so a single canonical /plans page now
 * drives every public pricing entry-point.
 *
 * Leaving the route in place (just redirecting) so any external link,
 * cached marketing material, or product-page button still resolves
 * cleanly.
 */

import { redirect } from "next/navigation";

export default function AxiomPricingRedirect(): never {
  redirect("/plans");
}
