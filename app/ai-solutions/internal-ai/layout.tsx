import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Internal AI Assistants",
  description:
    "Company knowledge copilots, document search, ticket triage, and Slack/Teams AI bots. Deploy internal AI assistants securely in your cloud.",
  openGraph: { url: "https://visionxixlabs.com/ai-solutions/internal-ai" },
  alternates: { canonical: "https://visionxixlabs.com/ai-solutions/internal-ai" },
};

export default function InternalAILayout({ children }: { children: React.ReactNode }) {
  return children;
}
