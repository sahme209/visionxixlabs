import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Immigration & USCIS News",
  description: "Latest immigration news, USCIS updates, and visa processing changes affecting your case.",
  keywords: ["immigration news", "USCIS news", "visa updates"],
  openGraph: { title: "Immigration News | VisaNova", url: "https://visanova.app/news" },
};

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
