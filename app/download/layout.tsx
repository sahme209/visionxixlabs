import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Download V19",
  description: "Review V19 desktop installers, platform availability, installation guidance and release verification.",
  alternates: { canonical: "/download" },
};

export default function DownloadLayout({ children }: { children: ReactNode }) {
  return children;
}
