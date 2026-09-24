import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";
import { ContactClient } from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact TAURI",
  description: "Ask about TAURI web access, supported integrations, deployment workflows, or production requirements.",
  alternates: { canonical: `${SITE_URL}/contact` },
  openGraph: {
    title: "Contact TAURI",
    description: "Ask about TAURI web access or production requirements.",
    url: `${SITE_URL}/contact`,
  },
};

export default function ContactPage() {
  return <ContactClient />;
}
