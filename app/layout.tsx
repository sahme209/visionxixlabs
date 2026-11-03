import {AXIOM_FAVICON_URL,AXIOM_APP_ICON_URL,AXIOM_APPLE_ICON_URL} from '@/lib/brandAssets';
import type { Metadata, Viewport } from "next";
import "./globals.css";
import "../styles/axiom-theme.css";
import "../styles/local-fonts.css";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import AIChatWidget from "@/components/AIChatWidget";
import { AxiomPanelProvider } from "@/lib/contexts/AxiomPanelContext";
import { Providers } from "@/components/Providers";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { CommandPalette } from "@/components/CommandPalette";
import { SITE_URL, defaultOgImage, primaryKeywords, secondaryKeywords } from "@/lib/seo";
import { PrivacyConsent } from "@/components/PrivacyConsent";
import { RouteAnnouncer } from "@/components/a11y/RouteAnnouncer";

// Original variable font subsets and fallback metrics are packaged locally.
// Preserve OpenType feature settings in globals.css; no build-time font fetch.

export const viewport: Viewport = {
  themeColor: "#141414",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Axiom Agent | Governed cloud operations",
    template: "%s | Vision XIX Labs",
  },
  description:
    "Download Axiom Agent for governed cloud operations, including deployment intake, approvals, guided execution, validation evidence, audit history, and reusable runbooks.",
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
      { url: AXIOM_FAVICON_URL, sizes: "32x32", type: "image/png" },
      { url: AXIOM_APP_ICON_URL, sizes: "512x512", type: "image/png" },
    ],
    shortcut: AXIOM_FAVICON_URL,
    apple: AXIOM_APPLE_ICON_URL,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "Vision XIX Labs",
    title: "Axiom Agent | Governed cloud operations",
    description:
      "A downloadable application for deployment intake, approvals, guided execution, validation evidence, audit history, and reusable runbooks.",
    images: [{ url: defaultOgImage, width: 512, height: 512, alt: "Vision XIX Labs" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Axiom Agent | Governed cloud operations",
    description: "Download Axiom Agent for deployment intake, approvals, guided execution, evidence, audit history, and reusable runbooks.",
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
      <head>
        <link rel="preload" href="/fonts/e4af272ccee01ff0-s.p.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/bb3ef058b751a6ad-s.p.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="axiom-font-inter axiom-font-mono antialiased">
        <Providers>
          <AxiomPanelProvider>
            <OrganizationJsonLd />
            <WebSiteJsonLd />
            <RouteAnnouncer />
            <ScrollProgress />
            <CommandPalette />
            <div>{children}</div>
            <AIChatWidget />
            <PrivacyConsent />
          </AxiomPanelProvider>
        </Providers>
      </body>
    </html>
  );
}
