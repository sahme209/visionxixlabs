import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";
import { ContactClient } from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact Axiom Agent",
  description: "Ask about Axiom Agent downloads, supported integrations, deployment workflows, or production requirements.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: "Contact Axiom Agent",
    description: "Ask about Axiom Agent deployment or production requirements.",
    url: `${SITE_URL}/contact`,
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
