import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Vision XIX Labs - Innovative Mobile Apps & Solutions",
  description:
    "Vision XIX Labs creates innovative mobile applications including VisaNova (USCIS Case Tracker) and RecallEase (Health & Reminder App). Building the future of digital experiences.",
  keywords: [
    "Vision XIX Labs",
    "mobile apps",
    "iOS apps",
    "Android apps",
    "VisaNova",
    "RecallEase",
    "USCIS tracker",
    "immigration apps",
    "health apps",
  ],
  authors: [{ name: "Vision XIX Labs LLC" }],
  openGraph: {
    title: "Vision XIX Labs - Innovative Mobile Apps & Solutions",
    description:
      "Creating innovative mobile applications that make life easier. Discover VisaNova and RecallEase.",
    type: "website",
    url: "https://visionxixlabs.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
