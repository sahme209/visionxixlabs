/**
 * /pricing — server-side redirect to /plans (canonical pricing route).
 *
 * Consolidated under /plans so the main Navigation 'Pricing' link,
 * the Footer 'Pricing' link, and any external link/old marketing
 * material all resolve to the same visual experience under the
 * shared Navigation + Footer shell.
 *
 * The previous /pricing implementation lived in this file as a
 * standalone shell. Now it just bounces to /plans which renders
 * under the marketing route group (which itself was just
 * re-platformed onto the main Navigation/Footer).
 */

import { redirect } from "next/navigation";

export default function PricingRedirect(): never {
  redirect("/plans");
}
