import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Secure AI Infrastructure & AI Applications",
  description:
    "Private LLM deployments, API-based AI integration, cloud model hosting, and AI-powered applications. Production-grade secure AI infrastructure.",
  openGraph: { url: "https://visionxixlabs.com/ai-solutions/ai-infrastructure" },
  alternates: { canonical: "https://visionxixlabs.com/ai-solutions/ai-infrastructure" },
};

export default function AIInfrastructureLayout({ children }: { children: React.ReactNode }) {
  return children;
}
