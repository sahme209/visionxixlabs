import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plans & Membership — One plan, full stack",
  description:
    "Cloud, AI, and automation unified. Axiom, chatbots, website builder, cloud guidance — one membership. Production-ready, white-label included.",
  openGraph: {
    title: "Plans & Membership | Vision XIX Labs",
    description:
      "One membership, full stack. Axiom, AI chatbots, website builder, cloud solutions — all included.",
    url: "https://visionxixlabs.com/visionxix-ai/pricing",
  },
  alternates: { canonical: "https://visionxixlabs.com/visionxix-ai/pricing" },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
