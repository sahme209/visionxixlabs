import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import "../styles/axiom-theme.css";
import { Analytics } from "@vercel/analytics/next";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/JsonLd";
import AIChatWidget from "@/components/AIChatWidget";
import { AxiomPanelProvider } from "@/lib/contexts/AxiomPanelContext";
import { Providers } from "@/components/Providers";
import { StickyMobileCTA } from "@/components/StickyMobileCTA";
import { ScrollProgress } from "@/components/motion/ScrollProgress";
import { SITE_URL, defaultOgImage, primaryKeywords, secondaryKeywords } from "@/lib/seo";

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
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${inter.className} antialiased`}>
        <Providers>
          <AxiomPanelProvider>
            <OrganizationJsonLd />
            <WebSiteJsonLd />
            <ScrollProgress />
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
