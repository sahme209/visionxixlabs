import type { Metadata } from "next";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy policy for Vision XIX Labs. How we collect, use, and protect your information.",
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE_URL}/privacy` },
};

export default function PrivacyLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
