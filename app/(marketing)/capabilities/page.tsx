import type { Metadata } from "next";
import { CapabilitiesClient } from "./CapabilitiesClient";

export const metadata: Metadata = {
  title: "Capabilities — governed deployment operations | Axiom Agent",
  description: "See how Axiom helps teams understand a change, prepare a governed playbook, require authority, and preserve evidence without overstating live automation.",
};

export default function CapabilitiesPage() {
  return <CapabilitiesClient />;
}
