import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Products",
  description:
    "VisaNova (USCIS case tracker) and RecallEase (health & reminders). Mobile apps by Vision XIX Labs.",
  openGraph: {
    title: "Products | VisaNova & RecallEase | Vision XIX Labs",
    url: `${SITE_URL}/apps`,
  },
  alternates: { canonical: `${SITE_URL}/apps` },
};

export default function AppsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
