import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About VisaNova",
  description: "VisaNova helps families track USCIS immigration cases, I-130 and I-129F processing times, and plan with real data.",
  openGraph: { title: "About Us | VisaNova", url: "https://visanova.app/about" },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
