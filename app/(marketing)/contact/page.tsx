import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";
import { ContactClient } from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact — Axiom",
  description: "Book a 30-minute walkthrough or send a question. The cockpit's audit row will record the conversation.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: "Contact — Axiom",
    description: "Book a 30-minute walkthrough or send a question.",
    url: `${SITE_URL}/contact`,
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
