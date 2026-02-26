import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Subscribe — Premium USCIS Case Tracking & Timeline",
  description:
    "Unlock premium USCIS case tracking, I-130 and I-129F timeline estimates, queue position, and real-time processing data.",
  openGraph: {
    title: "Subscribe | VisaNova",
    description: "Premium immigration case tracking and timeline estimates.",
    url: "https://visanova.app/subscribe",
  },
};

export default function SubscribeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
