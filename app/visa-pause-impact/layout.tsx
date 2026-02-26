import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CLINIC v. Rubio — Visa Pause Impact & 75-Country Delay",
  description:
    "Track the CLINIC v. Rubio lawsuit and visa pause impact. See how the 75-country immigrant visa freeze affects your case, recovery timeline, and what the lawsuit seeks.",
  keywords: [
    "visa pause",
    "CLINIC v Rubio",
    "75 country visa freeze",
    "immigrant visa delay",
    "visa freeze impact",
    "State Department visa",
  ],
  openGraph: {
    title: "Visa Pause Impact | VisaNova",
    description: "CLINIC v. Rubio case updates and how the visa pause affects your immigration timeline.",
    url: "https://visanova.app/visa-pause-impact",
  },
};

export default function VisaPauseImpactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
