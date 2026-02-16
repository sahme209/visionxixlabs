import { organization, SITE_URL } from "@/lib/seo";

export function OrganizationJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: organization.name,
    legalName: organization.legalName,
    url: organization.url,
    logo: organization.logo,
    description: organization.description,
    foundingDate: organization.foundingDate,
    sameAs: organization.sameAs,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebSiteJsonLd() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: organization.name,
    url: SITE_URL,
    description: organization.description,
    publisher: {
      "@type": "Organization",
      name: organization.name,
      logo: { "@type": "ImageObject", url: organization.logo },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
