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

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string; question?: string }> }) {
  const { topic, question } = await searchParams;
  // Ask Axiom hand-off: a bounded, plain-text question the visitor still reviews and sends themselves.
  const prefill = topic === "ask-axiom" && typeof question === "string" ? question.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500) : undefined;
  return <ContactClient intent={topic === "axiom-production-access" ? "production-access" : prefill ? "ask-axiom" : undefined} prefill={prefill} />;
}
