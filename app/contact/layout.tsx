import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Contact | Cloud & AI Engineering",
  description:
    "Get in touch with Vision XIX Labs for cloud engineering on AWS, Azure, and GCP. Discuss your project, assessment, or engagement.",
  openGraph: {
    title: "Contact | Vision XIX Labs",
    description: "Get in touch for cloud and AI engineering. AWS, Azure, GCP consulting.",
    url: `${SITE_URL}/contact`,
  },
  alternates: { canonical: `${SITE_URL}/contact` },
};

export default function ContactLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
