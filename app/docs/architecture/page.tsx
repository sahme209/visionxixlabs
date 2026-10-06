import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Architecture overview — Axiom Documentation",
  description: "How Axiom Agent is built: web platform, desktop ecosystem, provider adapters, reasoning engine, execution orchestration, governance, audit, operational memory, and ReleaseOps.",
};

export default function ArchitecturePage() {
  // The original architecture page described a browser command center and
  // local execution surfaces, plus future-dated roadmap claims (Azure/GCP
  // reasoning, Windows/Linux desktop) that are stale now that those dates
  // have passed without shipping. Keep the route stable for old links, but
  // make the ReleaseOps trust boundary canonical rather than leaving the
  // stale content as dead code someone could accidentally re-enable.
  redirect("/docs/releaseops");
}
