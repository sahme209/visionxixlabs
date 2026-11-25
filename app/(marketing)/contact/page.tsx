import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";
import { ContactClient } from "./ContactClient";

export const metadata: Metadata = {
  title: "V19 support",
  description: "Get help with V19 downloads, accounts, supported integrations, security, or an existing installation.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: "V19 support",
    description: "Get help after the self-service documentation or in-product recovery path leaves you blocked.",
    url: `${SITE_URL}/contact`,
  },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  const intent = topic === "axiom-production-access" ? "production-access"
    : topic === "security" ? "security"
    : topic === "ask-axiom" ? "ask-axiom" : undefined;
  return <ContactClient intent={intent} />;
}
