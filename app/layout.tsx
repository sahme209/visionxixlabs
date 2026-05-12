import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "../styles/axiom-theme.css";
import { Analytics } from "@vercel/analytics/next";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import AIChatWidget from "@/components/AIChatWidget";
import { AxiomPanelProvider } from "@/lib/contexts/AxiomPanelContext";
import { Providers } from "@/components/Providers";
import { StickyMobileCTA } from "@/components/StickyMobileCTA";
import { SITE_URL, defaultOgImage, primaryKeywords, secondaryKeywords } from "@/lib/seo";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Vision XIX Labs | Axiom — Autonomous Cloud Operations",
    template: "%s | Vision XIX Labs",
  },
  description:
    "Axiom is an autonomous cloud operations agent. It scans your infrastructure, reasons about what to fix, generates execution plans, and applies approved changes — with governance, rollback, and full audit trail.",
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
    title: "Vision XIX Labs | Axiom — Autonomous Cloud Operations",
    description:
      "Axiom scans your cloud, reasons about what to fix, and applies approved changes. Governance, rollback, and full audit trail.",
    images: [{ url: defaultOgImage, width: 512, height: 512, alt: "Vision XIX Labs" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vision XIX Labs | Axiom — Autonomous Cloud Operations",
    description: "Autonomous cloud operations agent. Scan, reason, plan, execute — with governance and audit trail.",
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
        <Providers>
          <AxiomPanelProvider>
            <OrganizationJsonLd />
            <WebSiteJsonLd />
            <div className="pb-20 md:pb-0">{children}</div>
            <StickyMobileCTA />
            <AIChatWidget />
            <Analytics />
          </AxiomPanelProvider>
        </Providers>
      </body>
    </html>
  );
}
