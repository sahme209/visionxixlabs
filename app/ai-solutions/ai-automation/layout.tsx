import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workflow Automation with AI",
  description:
    "Email classification, support automation, CRM enrichment, and report generation. AI-powered workflow automation in your cloud.",
  openGraph: { url: "https://visionxixlabs.com/ai-solutions/ai-automation" },
  alternates: { canonical: "https://visionxixlabs.com/ai-solutions/ai-automation" },
};

export default function AIAutomationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
