import type { Metadata } from "next";
import { DisciplinesClient } from "./DisciplinesClient";

export const metadata: Metadata = {
  title: "Disciplines — engineering coverage across Axiom",
  description: "Engineering, IT, security, and platform disciplines Axiom assists with — each linked to the kernel module that powers it. Human approval required for every action.",
};

export default function DisciplinesPage() {
  return <DisciplinesClient />;
}
