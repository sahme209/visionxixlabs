import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Vision XIX Labs AI — Production AI Chatbots for Your Site",
  description:
    "AI that knows your business. Production-ready chatbots trained on your site — 24/7 support, lead capture, enterprise security. Better than SiteGPT.",
  openGraph: {
    title: "Vision XIX Labs AI | Production AI for Your Business",
    description: "AI chatbots trained on your content. Lead capture, analytics, escalate to human.",
    url: "https://visionxixlabs.com/visionxix-ai",
  },
};

export default function VisionXIXAILayout({ children }: { children: React.ReactNode }) {
  return children;
}
