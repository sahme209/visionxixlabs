import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/seo";

export const metadata: Metadata = {
  title: "USCIS Form Guides — I-130, I-129F, I-485, I-765 Step-by-Step",
  description:
    "Step-by-step guides for USCIS forms: I-130 Petition for Alien Relative, I-129F Fiancé(e), I-485 Adjustment of Status, I-765 Work Permit, and more. How to file and track your case.",
  keywords: [
    "I-130 guide",
    "I-129F guide",
    "I-485 guide",
    "USCIS form instructions",
    "how to file I-130",
    "immigration form guide",
    "green card application",
  ],
  openGraph: {
    title: "USCIS Form Guides | VisaNova",
    description: "Step-by-step guides for I-130, I-129F, I-485, and other USCIS immigration forms.",
    url: "https://visanova.app/guides",
  },
};

export default function GuidesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
