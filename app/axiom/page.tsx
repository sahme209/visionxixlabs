import { redirect } from "next/navigation";

// This route used to host a detailed "12-step autonomous loop" product
// page with present-tense claims (cost-reduction percentages, "Real SDK
// execution with rollback", a scripted terminal labeled "Live scan
// simulation") that don't match what's actually built and reachable via
// the desktop app today. The page had already been disabled behind a
// hardcoded `legacySurfaceEnabled = false` flag client-side, but the
// overclaiming JSX stayed in the repo as a flag-flip away from going
// live again without ever being rewritten to match reality. Several
// internal links (Footer, enterprise-readiness, services, press,
// AIChatWidget) still point at /axiom expecting it to resolve, so this
// keeps the route as a plain, permanent, server-side redirect instead
// of deleting it outright.
export default function AxiomPage(): never {
  redirect("/product");
}
