/**
 * /how-it-works — animated walkthrough of the 10-agent council.
 */

import type { Metadata } from "next";
import { HowItWorksClient } from "./HowItWorksClient";

export const metadata: Metadata = {
  title: "How Axiom works — the 10-agent council",
  description: "Detector → reasoner → simulator → policy → boundary → council → approver → verifier → auditor → improver. Preparation, review and execution are separate. Supported actions require their operation-specific checks.",
};

export default function HowItWorksPage() {
  return <HowItWorksClient />;
}
