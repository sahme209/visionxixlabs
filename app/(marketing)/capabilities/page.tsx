import type { Metadata } from "next";
import { CapabilitiesClient } from "./CapabilitiesClient";

export const metadata: Metadata = {
  title: "Capabilities — the AGI Engineers behind Axiom",
  description: "Every AGI Engineer kernel Axiom ships, mapped to the lib/ module that proves it. Approval-only-no-execution applies to every one.",
};

export default function CapabilitiesPage() {
  return <CapabilitiesClient />;
}
