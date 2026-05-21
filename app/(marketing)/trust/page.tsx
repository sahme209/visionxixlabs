import type { Metadata } from "next";
import { TrustClient } from "./TrustClient";

export const metadata: Metadata = {
  title: "Trust — Axiom",
  description: "Approval-only-no-execution. Free AI providers with deterministic fallback. Closed-union safety contracts end-to-end.",
};

export default function TrustPage() {
  return <TrustClient />;
}
