import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "../styles/axiom-theme.css";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import AIChatWidget from "@/components/AIChatWidget";
import { AxiomPanelProvider } from "@/lib/contexts/AxiomPanelContext";
import { Providers } from "@/components/Providers";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { CommandPalette } from "@/components/CommandPalette";
import { SITE_URL, defaultOgImage, primaryKeywords, secondaryKeywords } from "@/lib/seo";
import { PrivacyConsent } from "@/components/PrivacyConsent";
import { RouteAnnouncer } from "@/components/a11y/RouteAnnouncer";

// Inter with the SF-Pro-leaning OpenType features baked in:
// - `cv02` rounded 'g'  - `cv11` single-storey 'a'  - `ss03` shorter '8'
// gives Inter the tightened, hardware-grade character of SF Pro Display
// without shipping a new font payload.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// JetBrains Mono for spec-sheet numerals + monospace labels — tighter
// rhythm than IBM Plex, more presence than SF Mono on the web.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#0a0a0d",
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
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${inter.className} antialiased`}>
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
