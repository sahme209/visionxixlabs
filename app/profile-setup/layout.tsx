import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile Setup — Add Your Case Details",
  description: "Add your priority date, form type, and country to get your personalized USCIS timeline and queue position.",
  robots: { index: false, follow: true },
};

export default function ProfileSetupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
