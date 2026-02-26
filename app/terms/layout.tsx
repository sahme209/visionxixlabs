import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "VisaNova terms of service for immigration case tracking and timeline estimates.",
  openGraph: { url: "https://visanova.app/terms" },
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
