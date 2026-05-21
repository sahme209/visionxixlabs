import type { Metadata } from "next";
import { ChangelogClient } from "./ChangelogClient";

export const metadata: Metadata = {
  title: "Changelog — Axiom",
  description: "Every phase Axiom has shipped. A platform that moves like a team because — internally — it is one.",
};

export default function ChangelogPage() {
  return <ChangelogClient />;
}
