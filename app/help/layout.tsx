import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Immigration & USCIS Help Center — Case Tracking, Timelines, FAQ",
  description:
    "Help with USCIS case tracking, immigration timelines, I-130 and I-129F process, document checklists, interview prep, and visa FAQs. Get answers for your immigration case.",
  keywords: [
    "USCIS help",
    "immigration help",
    "case tracking help",
    "I-130 FAQ",
    "visa timeline",
    "immigration interview",
    "NVC process",
  ],
  openGraph: {
    title: "Immigration Help Center | VisaNova",
    description: "Help with USCIS case tracking, timelines, and immigration FAQs.",
    url: "https://visanova.app/help",
  },
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return children;
}
