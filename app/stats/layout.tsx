import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "USCIS Processing Statistics & I-130 I-129F Approval Data",
  description:
    "Real USCIS processing statistics, I-130 and I-129F approval trends, processing times by service center, and live immigration data. Track where you stand.",
  keywords: [
    "USCIS statistics",
    "I-130 processing times",
    "I-129F processing times",
    "USCIS approval data",
    "immigration statistics",
    "processing times by center",
    "visa bulletin",
  ],
  openGraph: {
    title: "USCIS Processing Statistics | VisaNova",
    description: "Real USCIS processing statistics, I-130 and I-129F approval trends and processing times.",
    url: "https://visanova.app/stats",
  },
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
