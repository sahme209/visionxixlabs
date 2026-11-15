import type { Metadata } from "next";
import { CompareClient } from "./CompareClient";

export const metadata: Metadata = {
  title: "Compare workflow evidence — V19",
  description: "Concrete questions to evaluate V19 alongside a team, an AI tool or a configured SaaS stack. Verify current support, permissions and outcomes.",
};

export default function ComparePage() {
  return <CompareClient />;
}
