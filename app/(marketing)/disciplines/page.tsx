import type { Metadata } from "next";
import { DisciplinesClient } from "./DisciplinesClient";

export const metadata: Metadata = {
  title: "Disciplines — the million-dollar team Axiom replaces",
  description: "Every engineering, IT, security, and platform discipline Axiom covers — with a direct link to the kernel module that powers it.",
};

export default function DisciplinesPage() {
  return <DisciplinesClient />;
}
