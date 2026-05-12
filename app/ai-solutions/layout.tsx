import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Solutions",
  description:
    "Cloud-native AI implementation, secure AI integration, and production-grade AI deployment. Enterprise AI consulting on AWS, Azure, and GCP.",
  keywords: [
    "AI consulting",
    "Cloud AI deployment",
    "Secure AI infrastructure",
    "AI automation",
    "Internal AI assistant",
    "Enterprise AI integration",
    "AI DevOps",
    "production AI",
    "LLM deployment",
  ],
  openGraph: {
    title: "AI Solutions | Production AI | Vision XIX Labs",
    description: "Secure AI integration and production AI deployment. Enterprise AI on AWS, Azure, GCP.",
    url: "https://visionxixlabs.com/ai-solutions",
  },
  alternates: { canonical: "https://visionxixlabs.com/ai-solutions" },
};

export default function AISolutionsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
