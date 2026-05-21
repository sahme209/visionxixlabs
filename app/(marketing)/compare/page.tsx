import type { Metadata } from "next";
import { CompareClient } from "./CompareClient";

export const metadata: Metadata = {
  title: "Compare — Axiom vs the alternatives",
  description: "Axiom versus hiring the team, versus point AI tools, versus the SaaS stack you'd stitch together. Side-by-side coverage matrix.",
};

export default function ComparePage() {
  return <CompareClient />;
}
