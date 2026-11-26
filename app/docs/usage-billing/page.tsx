import type { Metadata } from "next";
import { Callout, DocFooterNav, DocHeader, DocSection, DocFigure } from "@/components/docs/DocPrimitives";
export const metadata: Metadata = {
 title: "Usage and billing — V19 Documentation",
 description: "Read AI usage, allowances, credit records and invoices on Control → Usage & billing.",
 alternates: { canonical: "/docs/usage-billing" },
};
export default function UsageBillingDocsPage() {
 return <>
  <DocHeader kicker="Workspace · Billing" title="See what you used and what it cost."
   summary="Control → Usage & billing has three tabs: Overview, Usage and Invoices. Missing records are shown as unavailable, never estimated." />
  <DocFigure src="/docs/cockpit/usage-billing.webp" alt="The Usage & billing page in the V19 cockpit in a browser" caption="Usage & billing in the cockpit (browser), shown for a new synthetic workspace. Your workspace shows its own records and the controls your role allows." width={1600} height={1000} />
  <DocSection id="overview" kicker="01" title="Overview">
   <p>Shows your plan, the AI allowance remaining, seats, counted deployments and gateway calls, plus AI usage for the current UTC month. AI cost is settled from the gateway&apos;s generation cost; calls still awaiting settlement are counted as pending, never as free. Credits increase only from payment records verified by Stripe.</p>
   <Callout variant="info" title="Top-ups are paused">Buying AI credit top-ups is currently unavailable while one-time payment fulfillment, refunds and replay handling are verified. The page states this; no charge can start while it is off.</Callout>
  </DocSection>
  <DocSection id="usage" kicker="02" title="Usage records">
   <p>Every member can browse AI usage records for the last 12 months, 50 per page, filter by settled or pending, and export the current page. Times are in UTC.</p>
  </DocSection>
  <DocSection id="invoices" kicker="03" title="Invoices and payment details">
   <p>Owners and admins see invoices and can open the secure Stripe billing portal with <em>Manage billing</em> when billing is enabled for the workspace. Other members see who manages billing instead.</p>
  </DocSection>
  <DocFooterNav prev={{href:"/docs/governance-approvals",label:"Governance approvals"}} next={{href:"/docs/settings",label:"Settings and sessions"}} />
 </>;
}
