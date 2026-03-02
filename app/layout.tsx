import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import OnboardingWrapper from "@/components/OnboardingWrapper";
import VisaPauseBanner from "@/components/VisaPauseBanner";
import AIChatWidget from "@/components/AIChatWidget";
import BackToTop from "@/components/BackToTop";
import { Analytics } from "@vercel/analytics/next";
import {
  SITE_URL,
  SITE_NAME,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  SEO_KEYWORDS,
  OG_IMAGE_URL,
} from "@/lib/seo";

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover", // Safe area insets for notched devices
};

export const metadata: Metadata = {
  title: {
    default: DEFAULT_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: DEFAULT_DESCRIPTION,
  keywords: SEO_KEYWORDS,
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [{ url: OG_IMAGE_URL, width: 512, height: 512, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [OG_IMAGE_URL],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: "/icon.png",
  },
  appleWebApp: {
    capable: true,
    title: SITE_NAME,
  },
  category: "technology",
  classification: "USCIS case tracking, immigration timeline, visa processing",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.visionxixlabs.com/#organization",
      name: "VisionXIX Labs",
      url: "https://www.visionxixlabs.com",
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: OG_IMAGE_URL },
      description: DEFAULT_DESCRIPTION,
      parentOrganization: { "@id": "https://www.visionxixlabs.com/#organization" },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DEFAULT_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-US",
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased surface-light">
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){document.documentElement.classList.remove('dark');})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(new URLSearchParams(window.location.search).get('debug-theme')==='true'){document.body.setAttribute('data-debug-theme','true');}})();`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <script
          data-noptimize="1"
          data-cfasync="false"
          data-wpfc-render="false"
          dangerouslySetInnerHTML={{
            __html: `(function(){var s=document.createElement("script");s.async=1;s.src='https://emrldco.com/NTAxNDY0.js?t=501464';document.head.appendChild(s);})();`,
          }}
        />
        <a href="#main-content" className="skip-to-main">
          Skip to main content
        </a>
        <LanguageProvider>
          <AuthProvider>
            <VisaPauseBanner />
            <OnboardingWrapper>
              <main id="main-content">{children}</main>
            </OnboardingWrapper>
          </AuthProvider>
        </LanguageProvider>
        <AIChatWidget />
        <BackToTop />
        <Analytics />
      </body>
    </html>
  );
}
