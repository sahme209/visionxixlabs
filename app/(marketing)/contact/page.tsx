import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";
import { ContactClient } from "./ContactClient";

export const metadata: Metadata = {
  title: "Axiom Agent support",
  description: "Get help with Axiom Agent downloads, accounts, supported integrations, security, or an existing installation.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: "Axiom Agent support",
    description: "Get help after the self-service documentation or in-product recovery path leaves you blocked.",
    url: `${SITE_URL}/contact`,
  },
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const topic = (await searchParams).topic;
  return <ContactClient intent={topic === "axiom-production-access" ? "production-access" : undefined} />;
}
