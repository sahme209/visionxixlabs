import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Engineering & LLM Systems",
  description:
    "We engineer AI systems for production environments: secure, scalable, and cost-aware AI deployment inside your cloud.",
  openGraph: {
    title: "AI Engineering & LLM Systems | Vision XIX Labs",
    description:
      "Cloud-native AI infrastructure and LLM systems. Secure, scalable, and cost-aware AI deployment inside your cloud.",
    url: "https://visionxixlabs.com/ai-engineering",
  },
  alternates: { canonical: "https://visionxixlabs.com/ai-engineering" },
};

export default function AIEngineeringLayout({ children }: { children: React.ReactNode }) {
  return children;
}
