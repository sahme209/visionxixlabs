import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Immigration Tools — Case Tracking, Queue Position, Expedite",
  description:
    "USCIS case tools: check case status, queue position, expedite request, action plan, timeline alerts, and document checklists for your immigration case.",
  keywords: [
    "USCIS case tools",
    "queue position",
    "expedite request",
    "case status check",
    "timeline alerts",
  ],
  openGraph: {
    title: "Immigration Tools | VisaNova",
    url: "https://visanova.app/tools/case-tools",
  },
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
