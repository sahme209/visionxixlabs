import type { Metadata } from "next";
import { CapabilitiesClient } from "./CapabilitiesClient";

export const metadata: Metadata = {
  title: "Capabilities — the AI agent kernels behind Axiom",
  description: "Every agent kernel Axiom ships, mapped to the lib/ module that implements it. Human approval is required before any action runs.",
};

export default function CapabilitiesPage() {
  return <CapabilitiesClient />;
}
