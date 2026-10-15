import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Download Axiom Agent",
  description: "Review Axiom Agent desktop installers, platform availability, installation guidance and release verification.",
  alternates: { canonical: "/download" },
};

export default function DownloadLayout({ children }: { children: ReactNode }) {
  return children;
}
