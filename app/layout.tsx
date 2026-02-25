import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import AIChatWidget from "@/components/AIChatWidget";
import { SITE_URL, defaultOgImage, primaryKeywords, secondaryKeywords } from "@/lib/seo";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Vision XIX Labs | Cloud & AI Engineering – AWS, Azure, GCP",
    template: "%s | Vision XIX Labs",
  },
  description:
    "Cloud & AI engineering for modern infrastructure. We design, automate, optimize, and secure cloud platforms across AWS, Azure, and GCP—with production-grade AI and DevOps automation.",
  keywords: [...primaryKeywords, ...secondaryKeywords],
  authors: [{ name: "Vision XIX Labs LLC", url: SITE_URL }],
  creator: "Vision XIX Labs",
  publisher: "Vision XIX Labs LLC",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/vision-xix-logo.png", sizes: "any", type: "image/png" },
    ],
    shortcut: "/favicon-32x32.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Vision XIX Labs",
    title: "Vision XIX Labs | Cloud & AI Engineering – AWS, Azure, GCP",
    description:
      "Engineering cloud platforms that scale. Multi-cloud consulting on AWS, Azure, and GCP. Infrastructure, CI/CD, FinOps, security, AI.",
    images: [{ url: defaultOgImage, width: 512, height: 512, alt: "Vision XIX Labs" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vision XIX Labs | Cloud & AI Engineering",
    description: "Multi-cloud engineering across AWS, Azure, and GCP. Reliable, secure, cost-effective.",
  },
  alternates: { canonical: SITE_URL },
  category: "technology",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <OrganizationJsonLd />
        <WebSiteJsonLd />
        {children}
        <AIChatWidget />
      </body>
    </html>
  );
}
