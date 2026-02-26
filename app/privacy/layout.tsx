import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "VisaNova privacy policy. How we collect, use, and protect your data for USCIS case tracking.",
  openGraph: { url: "https://visanova.app/privacy" },
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
