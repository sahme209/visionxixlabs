import type { Metadata } from "next";
import { PricingClient } from "./PricingClient";

export const metadata: Metadata = {
  title: "Pricing — Axiom",
  description: "Free starter. Growth. Scale. Enterprise. Approval-only-no-execution at every tier.",
};

export default function PricingPage() {
  return <PricingClient />;
}
